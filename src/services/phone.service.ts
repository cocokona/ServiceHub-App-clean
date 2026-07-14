/**
 * phone.service.ts — Phone-number uniqueness within a role group.
 *
 * Enforces the product rule: no two profiles of the SAME role may share a
 * phone number, while a customer and a technician are free to share one.
 *
 * The database is the authoritative backstop (two partial unique indexes on
 * `profiles.phone`, see migration 00018). This service adds a fast, friendly
 * PRE-CHECK so the UI can reject a duplicate BEFORE the network write and show
 * a clear message instead of a raw constraint error. The two layers agree
 * because the app always stores a trimmed phone and the DB index compares the
 * raw (trimmed) value.
 */

import { supabase } from '../lib/supabase';
import { logger } from './logger';
import { normalizePhone, type ProfileRole } from './validation';

export interface PhoneUniquenessCheck {
  /** True when a DIFFERENT profile of the same role already uses this phone. */
  isDuplicate: boolean;
  /** Id of the conflicting profile, when known. */
  existingProfileId?: string;
}

/**
 * Check whether `phone` is already taken by another ACTIVE profile of the same
 * role.
 *
 * Behavior:
 *  - Empty / whitespace-only phone -> never a duplicate (no constraint; the
 *    user simply has no phone on file).
 *  - Unknown role -> returns not-a-duplicate (fail open) rather than blocking,
 *    because the DB index is the authoritative gate.
 *  - `excludeProfileId` (the caller's own id) is excluded, so updating your own
 *    phone to its current value never trips the rule.
 *  - A phone used by the OTHER role is explicitly allowed (cross-role overlap).
 *
 * On a query error we FAIL OPEN and report not-a-duplicate. The DB partial
 * unique index still catches any genuine conflict at write time (mapped to a
 * friendly message in `updateProfile`), so a transient lookup failure can
 * never silently corrupt data or block a valid save.
 */
export async function checkPhoneUniquenessWithinRole(params: {
  phone: string | null | undefined;
  role: ProfileRole;
  excludeProfileId?: string | null;
}): Promise<PhoneUniquenessCheck> {
  const phone = normalizePhone(params.phone);
  if (!phone) return { isDuplicate: false };

  if (params.role !== 'customer' && params.role !== 'technician') {
    // Unknown role: let the DB index be the authoritative gate.
    return { isDuplicate: false };
  }

  let query = supabase
    .from('profiles')
    .select('id')
    .eq('role', params.role)
    .eq('phone', phone)
    .is('deleted_at', null)
    .limit(1);

  if (params.excludeProfileId) {
    query = query.neq('id', params.excludeProfileId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    logger.warn('[phone:checkUniqueness] lookup failed; failing open', {
      code: (error as any)?.code,
      message: error.message,
    });
    return { isDuplicate: false };
  }

  return { isDuplicate: !!data, existingProfileId: data?.id };
}
