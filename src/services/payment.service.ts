/**
 * payment.service.ts — Customer payment-method management.
 *
 * SECURITY MODEL (read before touching this file):
 *   - We store ONLY a tokenized record: card brand, last 4 digits, expiry,
 *     cardholder name, and a payment token. The full card number (PAN) and the
 *     CVV are NEVER persisted — doing so would be a PCI-DSS violation. The raw
 *     `cardNumber`/`cvv` in `AddPaymentMethodInput` exist only transiently for
 *     client-side validation and are discarded after `addPaymentMethod` returns.
 *   - Every row is private to its owner: the `payment_methods` table has RLS
 *     policies scoped to `profile_id = auth.uid()`, so a customer can only ever
 *     see / modify / delete their own methods.
 *   - `addPaymentMethod` calls `ensureProfile()` before writing so a brand-new
 *     account (which may not yet have a `profiles` row) can still save a card
 *     without hitting a foreign-key violation. Like `createOrderInProgress`, it
 *     retries once on a 23503 FK error.
 */

import { supabase } from '../lib/supabase';
import type { SavedPaymentMethod, CardBrand, AddPaymentMethodInput } from '../types';
import { logger } from './logger';
import { logAndThrow, isForeignKeyViolation } from './errors';
import { ensureProfile } from './database.service';

// ---------------------------------------------------------------------------
// Pure helpers (exported for reuse + unit testing)
// ---------------------------------------------------------------------------

/** Detect the card brand from the number's IIN range. */
export function detectCardBrand(cardNumber: string): CardBrand {
  const n = cardNumber.replace(/\D/g, '');
  if (/^4/.test(n)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'mastercard';
  if (/^3[47]/.test(n)) return 'amex';
  if (/^(6011|65|64[4-9])/.test(n)) return 'discover';
  return 'unknown';
}

/** Luhn checksum validation — the industry-standard card-number sanity check. */
export function luhnValid(cardNumber: string): boolean {
  const n = cardNumber.replace(/\D/g, '');
  if (n.length === 0) return false;
  let sum = 0;
  let alternate = false;
  for (let i = n.length - 1; i >= 0; i--) {
    let digit = parseInt(n[i], 10);
    if (alternate) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

/** Format a raw number into grouped digits (e.g. "4242 4242 4242 4242"). */
export function formatCardNumber(cardNumber: string): string {
  const n = cardNumber.replace(/\D/g, '');
  return n.replace(/(.{4})/g, '$1 ').trim();
}

/** Parse a raw "MMYY" / "MM/YY" string into month/year, or null if incomplete. */
export function normalizeExpiry(value: string): { month: number; year: number } | null {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length < 4) return null;
  const month = parseInt(cleaned.slice(0, 2), 10);
  const year = parseInt(cleaned.slice(2), 10);
  if (Number.isNaN(month) || Number.isNaN(year)) return null;
  return { month, year };
}

/** True when the expiry is a real month and not in the past. */
export function isExpiryValid(month: number, year: number): boolean {
  if (month < 1 || month > 12) return false;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const fullYear = year < 100 ? 2000 + year : year;
  if (fullYear < currentYear) return false;
  if (fullYear === currentYear && month < currentMonth) return false;
  return true;
}

/** Generate a placeholder payment token. In production this comes from the
 *  PCI-compliant processor (e.g. Stripe) — never generate/store real PANs. */
function generateToken(): string {
  const rand = Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `pm_${rand}`;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function mapRow(row: any): SavedPaymentMethod {
  return {
    id: row.id,
    profileId: row.profile_id,
    brand: row.brand,
    last4: row.last4,
    expMonth: row.exp_month,
    expYear: row.exp_year,
    cardholderName: row.cardholder_name,
    token: row.token,
    isDefault: row.is_default,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Data access
// ---------------------------------------------------------------------------

/** List the current user's saved payment methods, default first. */
export async function getPaymentMethods(): Promise<SavedPaymentMethod[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return [];

  const { data, error } = await supabase
    .from('payment_methods')
    .select('*')
    .eq('profile_id', session.user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) logAndThrow('getPaymentMethods', error);
  return (data || []).map(mapRow);
}

/**
 * Validate and save a new card. Persists ONLY a tokenized record — the raw
 * card number and CVV are never written to the database.
 */
export async function addPaymentMethod(input: AddPaymentMethodInput): Promise<SavedPaymentMethod> {
  const cardNumber = input.cardNumber.replace(/\D/g, '');

  // 1) Validate locally BEFORE any DB work (no PAN leaves this function).
  if (!luhnValid(cardNumber)) {
    throw new Error('Please enter a valid card number.');
  }
  const brand = detectCardBrand(cardNumber);
  if (brand === 'unknown') {
    throw new Error('Unsupported card type. We accept Visa, Mastercard, Amex, and Discover.');
  }
  if (!isExpiryValid(input.expiryMonth, input.expiryYear)) {
    throw new Error('Card expiry is invalid or in the past.');
  }
  if (!/^\d{3,4}$/.test(input.cvv)) {
    throw new Error('Please enter a valid CVV.');
  }
  if (!input.cardholderName.trim()) {
    throw new Error('Please enter the cardholder name.');
  }

  // 2) Authenticated?
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) throw new Error('Not authenticated');

  // 3) Make sure the owning profile row exists (brand-new accounts).
  await ensureProfile();

  // 4) First saved card becomes the default automatically.
  const existing = await getPaymentMethods();
  const isFirst = existing.length === 0;

  const payload = {
    profile_id: user.id,
    brand,
    last4: cardNumber.slice(-4),
    exp_month: input.expiryMonth,
    exp_year: input.expiryYear < 100 ? 2000 + input.expiryYear : input.expiryYear,
    cardholder_name: input.cardholderName.trim(),
    token: generateToken(),
    is_default: isFirst,
  };

  const insertOnce = () =>
    supabase.from('payment_methods').insert(payload).select('*').single();

  let result = await insertOnce();
  if (result.error) {
    // Recover from a missing profile FK, then retry once.
    if (isForeignKeyViolation(result.error)) {
      await ensureProfile();
      result = await insertOnce();
    }
    if (result.error) logAndThrow('addPaymentMethod', result.error);
  }

  logger.info('[payment:addPaymentMethod] payment method saved (tokenized)');
  return mapRow(result.data);
}

/** Delete a saved payment method (RLS ensures only the owner can). */
export async function deletePaymentMethod(id: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('payment_methods')
    .delete()
    .eq('id', id)
    .eq('profile_id', session.user.id); // belt-and-suspenders with RLS

  if (error) logAndThrow('deletePaymentMethod', error);
  logger.info('[payment:deletePaymentMethod] deleted', { id });
}

/**
 * Mark a payment method as the customer's default. Two scoped updates keep the
 * operation safe under RLS (both bound to the owner's profile_id).
 */
export async function setDefaultPaymentMethod(id: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) throw new Error('Not authenticated');

  const { error: clearError } = await supabase
    .from('payment_methods')
    .update({ is_default: false })
    .eq('profile_id', user.id);
  if (clearError) logAndThrow('setDefaultPaymentMethod', clearError);

  const { error: setError } = await supabase
    .from('payment_methods')
    .update({ is_default: true })
    .eq('id', id)
    .eq('profile_id', user.id);
  if (setError) logAndThrow('setDefaultPaymentMethod', setError);

  logger.info('[payment:setDefaultPaymentMethod] set default', { id });
}
