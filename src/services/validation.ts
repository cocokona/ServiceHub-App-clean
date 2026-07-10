/**
 * Profile Validation — Mandatory field enforcement
 *
 * Centralizes the rules that gate order placement and order acceptance:
 *  - A customer must have a non-empty `address` and `phone` before placing an
 *    order.
 *  - A technician must have a non-empty `phone` before accepting an order.
 *
 * Keeping these rules in one place (instead of inlining checks across screens)
 * makes the enforcement consistent for customers and technicians and lets us
 * unit-test the exact "missing field" behavior the product requires.
 */

export interface ProfileValidation {
  /** True only when every required field is present and non-empty. */
  isValid: boolean;
  /** Machine-readable list of missing field keys (e.g. ['address', 'phone']). */
  missing: string[];
  /** Human-readable field names for the missing fields, for Alert copy. */
  errors: string[];
}

/**
 * Validate the fields a customer needs before placing an order.
 * Both `address` and `phone` are mandatory.
 */
export function validateCustomerOrderProfile(profile: {
  address?: string | null;
  phone?: string | null;
}): ProfileValidation {
  const missing: string[] = [];

  if (!profile.address || !profile.address.trim()) missing.push('address');
  if (!profile.phone || !profile.phone.trim()) missing.push('phone');

  return {
    isValid: missing.length === 0,
    missing,
    errors: missing.map((field) =>
      field === 'address' ? 'service address' : 'phone number'
    ),
  };
}

/**
 * Validate the fields a technician needs before accepting an order.
 * Only `phone` is mandatory (technician location is not required to take work).
 */
export function validateTechnicianAcceptProfile(profile: {
  phone?: string | null;
}): ProfileValidation {
  const missing: string[] = [];

  if (!profile.phone || !profile.phone.trim()) missing.push('phone');

  return {
    isValid: missing.length === 0,
    missing,
    errors: missing.map(() => 'phone number'),
  };
}

/**
 * Normalize a phone number for use in a `tel:` deep link.
 *
 * Strips everything except digits and a single leading '+', so values like
 * "+1 (415) 555-0132" or "415-555-0132" become dialable strings
 * ("+14155550132" / "4155550132"). Returns '' when there is nothing to dial.
 */
export function normalizePhoneForDial(phone?: string | null): string {
  if (!phone) return '';
  const normalized = phone.replace(/[^\d+]/g, '');
  return normalized;
}
