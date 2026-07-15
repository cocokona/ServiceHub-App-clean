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
 * Result of the role/permission gate for job acceptance.
 */
export interface JobAcceptanceValidation {
  /** True only when the technician is permitted to accept the job. */
  isValid: boolean;
  /** Human-readable reason when `isValid` is false (for Alert copy). */
  reason?: string;
}

/**
 * Role/permission gate for job acceptance.
 *
 * A technician may accept a job only when their specialty (`workCategory`)
 * matches the job's `serviceCategory`. A universal technician — one whose
 * `workCategory` is unset or explicitly `'all'` — may take any job.
 *
 * This is the client-side counterpart of the `accept_order_in_progress`
 * database guard: it gives an immediate, friendly error *before* we ever hit
 * the network, while the DB function remains the authoritative backstop
 * against any client-side bypass.
 *
 * Fails closed: if the job's category is unknown/missing we block, because
 * `order_in_progress.service_category` is NOT NULL with a fixed CHECK set and
 * an accepted job must always carry a verifiable category.
 */
export function validateTechnicianCanAcceptJob(params: {
  technicianWorkCategory?: string | null;
  jobServiceCategory?: string | null;
}): JobAcceptanceValidation {
  const tech = params.technicianWorkCategory;
  const job = params.jobServiceCategory;

  // Universal technicians (no specialty or explicitly 'all') can take any job.
  if (!tech || tech === 'all') return { isValid: true };

  if (!job) {
    return {
      isValid: false,
      reason:
        'This job has no category assigned, so it cannot be accepted safely.',
    };
  }

  if (tech === job) return { isValid: true };

  return {
    isValid: false,
    reason: `Your specialty is "${tech}" but this job is in the "${job}" category.`,
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

// ---------------------------------------------------------------------------
// Phone number uniqueness (within a role group)
// ---------------------------------------------------------------------------

/**
 * Defensive type for the two profile roles. Kept local to validation so the
 * uniqueness helpers stay decoupled from the Supabase Row/User types.
 */
export type ProfileRole = 'customer' | 'technician';

/**
 * Normalize a phone number for storage and for uniqueness comparison.
 *
 * Trims surrounding whitespace and collapses any run of internal whitespace
 * into a single space, so `"  555 - 0101  "` and `"555 - 0101"` compare equal
 * while still preserving the human-readable formatting the app displays.
 * Returns `''` for null/undefined/whitespace-only input — the caller's signal
 * that "no phone is set" and the uniqueness rule does NOT apply.
 *
 * NOTE: we intentionally do NOT strip digits/punctuation here. The DB partial
 * unique index compares the exact stored value, and the app always normalizes
 * (trims) before writing, so raw comparisons stay consistent.
 */
export function normalizePhone(raw?: string | null): string {
  if (!raw) return '';
  return raw.replace(/\s+/g, ' ').trim();
}

export interface PhoneUniquenessValidation {
  /** True when the phone may be stored. */
  isValid: boolean;
  /** Friendly, user-safe message when `isValid` is false. */
  error?: string;
  /** Trimmed phone ready to persist; '' when the input is empty. */
  normalized: string;
}

/**
 * Client-side gate for the phone-uniqueness rule.
 *
 * Empty / whitespace-only input is ALWAYS allowed (the user simply has no
 * phone on file) — it returns `isValid: true` with `normalized: ''` so callers
 * skip the network round-trip entirely. The actual cross-row duplicate check
 * is performed by `checkPhoneUniquenessWithinRole` (DB-backed) and the
 * authoritative DB partial unique index; this function only resolves the edge
 * cases that need no network call.
 */
export function validatePhoneUniqueness(
  raw?: string | null
): PhoneUniquenessValidation {
  const normalized = normalizePhone(raw);
  if (!normalized) {
    return { isValid: true, normalized: '' };
  }
  return { isValid: true, normalized };
}

/**
 * Build the friendly, user-facing message shown when a phone number is already
 * registered to another profile of the SAME role.
 *
 * The message names the role group so the user understands *why* the number was
 * rejected (two customers cannot share a number, but a customer and a
 * technician can). Called both from the client-side pre-check and as the
 * fallback when the DB partial unique index rejects an insert/update.
 */
export function phoneUniquenessErrorMessage(_role: ProfileRole): string {
  return 'This phone number is already used by other. Please enter a real phone number or cancel the last account first. If you meet a difficult, please feel free to find customer service.';
}

// ---------------------------------------------------------------------------
// Order rejection reason validation
// ---------------------------------------------------------------------------

export interface RejectionValidation {
  /** True only when a non-empty reason was supplied. */
  isValid: boolean;
  /** Friendly, user-safe message when `isValid` is false. */
  error?: string;
}

/**
 * Validate the reason a technician chose when declining an order.
 *
 * The reason vocabulary is data-driven (see `rejection-reasons.json`) and
 * intentionally open-ended — new reasons can be added without code changes —
 * so we only enforce that a reason was actually selected. The empty case is
 * blocked up front so the UI never sends a blank decline to the server.
 */
export function validateRejectionReason(reason?: string | null): RejectionValidation {
  if (!reason || !reason.trim()) {
    return {
      isValid: false,
      error: 'Please select a reason for declining this order.',
    };
  }
  return { isValid: true };
}

// ---------------------------------------------------------------------------
// Display name (profile name) validation
// ---------------------------------------------------------------------------

/** Minimum allowed display-name length (after trimming). */
export const DISPLAY_NAME_MIN = 2;
/** Maximum allowed display-name length (after trimming). */
export const DISPLAY_NAME_MAX = 50;

/**
 * Result of validating a user-supplied display name.
 *
 * `normalized` is the trimmed, storage-ready value (empty string when the
 * input is null/undefined/whitespace). `error` carries a friendly,
 * user-facing message for the first failed rule — callers should surface it
 * verbatim in an `Alert` or inline hint, never the raw validation internals.
 */
export interface DisplayNameValidation {
  /** True only when the name passes every rule. */
  isValid: boolean;
  /** Friendly, user-safe message describing the first failure (or undefined). */
  error?: string;
  /** Trimmed name ready to persist; '' when the input is empty. */
  normalized: string;
}

/**
 * Validate a display name before it is written to `profiles.name`.
 *
 * Rules (fail closed — any ambiguity is rejected rather than stored):
 *  - Non-empty after trimming.
 *  - Length between `DISPLAY_NAME_MIN` and `DISPLAY_NAME_MAX` characters.
 *  - Contains at least one letter (so a name is never only punctuation/spaces).
 *  - Composed only of letters (any language via `\p{L}`), spaces, hyphens,
 *    and apostrophes — matching the product's "letters, spaces, hyphens,
 *    apostrophes only" requirement while staying inclusive of international
 *    names.
 *
 * This is the single source of truth for name validation; both the UI (for
 * instant feedback) and the service layer (authoritative gate) reuse it, so
 * the rules can never drift between client and server.
 */
export function validateDisplayName(raw: string | null | undefined): DisplayNameValidation {
  const normalized = (raw ?? '').trim();

  if (!normalized) {
    return {
      isValid: false,
      error: 'Please enter your name.',
      normalized: '',
    };
  }

  if (normalized.length < DISPLAY_NAME_MIN) {
    return {
      isValid: false,
      error: `Name must be at least ${DISPLAY_NAME_MIN} characters.`,
      normalized,
    };
  }

  if (normalized.length > DISPLAY_NAME_MAX) {
    return {
      isValid: false,
      error: `Name must be ${DISPLAY_NAME_MAX} characters or fewer.`,
      normalized,
    };
  }

  // At least one letter — rejects names made of only spaces/hyphens/apostrophes.
  if (!/[\p{L}]/u.test(normalized)) {
    return {
      isValid: false,
      error: 'Name must include at least one letter.',
      normalized,
    };
  }

  // Allowed characters only: letters (any language), spaces, hyphens, apostrophes.
  if (!/^[\p{L}\s'-]+$/u.test(normalized)) {
    return {
      isValid: false,
      error:
        "Name can only contain letters, spaces, hyphens, and apostrophes.",
      normalized,
    };
  }

  return { isValid: true, error: undefined, normalized };
}

// ---------------------------------------------------------------------------
// Service time / time-slot validation
// ---------------------------------------------------------------------------

import type { TimeSlot } from '../data/loader';

/**
 * Outcome of checking a chosen service date + time slot against the clock.
 *
 *  - `'ok'`           — the selection is bookable, proceed to the next step.
 *  - `'past'`         — the slot's window has already fully elapsed *today*, so
 *                       the customer can no longer be served in it. This is a
 *                       hard block: the Next button must NOT advance.
 *  - `'late-warning'` — a softer, confirm-only gate: it's still technically
 *                       possible to be served, but very late in the afternoon,
 *                       so we surface a confirmation dialog before proceeding.
 */
export type ServiceTimeStatus = 'ok' | 'past' | 'late-warning';

export interface ServiceTimeValidation {
  status: ServiceTimeStatus;
  /** User-safe copy for the `'past'` (error) or `'late-warning'` (confirm) case. */
  message?: string;
}

/** 4:30 PM, the threshold at/after which a same-day afternoon booking is risky. */
const LATE_AFTERNOON_MINUTES = 16 * 60 + 30;

/**
 * True when `a` and `b` fall on the same local calendar day.
 * Uses local Y/M/D so we don't drift across timezones via `toISOString()`.
 */
function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Validate a chosen service date + time slot against the current time.
 *
 * Rules enforced:
 *  1. Past-time block (general): a slot whose window has fully elapsed today is
 *     rejected. We anchor the check to the slot's *end* hour, so "Morning"
 *     (ends 12 PM) is correctly blocked once it's 12:00 PM or later — exactly
 *     the explicit "Today Morning after noon" rule — and Afternoon/Evening are
 *     blocked once their own windows close. A window that is still partially
 *     open (e.g. it's 10 AM, Morning runs until noon) remains bookable.
 *  2. Late-afternoon warning: when it's 4:30 PM or later AND the customer
 *     picked the "Afternoon" slot for *today*, we return `'late-warning'`
 *     instead of blocking — the caller shows a confirmation dialog (Yes/No).
 *  3. Future dates always pass: choosing any slot on a later day is fine, and
 *     past dates are rejected defensively (the date picker already blocks them).
 *
 * `now` is injectable for deterministic unit tests; defaults to `new Date()`.
 */
export function validateServiceTime(params: {
  date: Date;
  timeSlotKey: string;
  timeSlots: TimeSlot[];
  now?: Date;
}): ServiceTimeValidation {
  const { date, timeSlotKey, timeSlots } = params;
  const now = params.now ?? new Date();

  const slot = timeSlots.find((s) => s.key === timeSlotKey);

  // Defensive: if the slot is unknown we can't evaluate it, so don't block.
  if (!slot) return { status: 'ok' };

  // Compare at day granularity so we only apply the time rules to *today*.
  if (date.getTime() < startOfLocalDay(now).getTime()) {
    return {
      status: 'past',
      message: `The ${slot.label} time slot (${slot.time}) is in the past. Please choose a future date.`,
    };
  }

  // Only same-day selections can be "already passed" or "too late".
  if (!isSameLocalDay(date, now)) return { status: 'ok' };

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const endMinutes = (slot.endHour ?? 24) * 60;

  // Rule 1 + general Rule 3: the whole window has elapsed today.
  if (nowMinutes >= endMinutes) {
    return {
      status: 'past',
      message: `The ${slot.label} time slot (${slot.time}) has already passed for today. Please choose another time.`,
    };
  }

  // Rule 2: late-afternoon confirmation gate (today's Afternoon slot only).
  if (nowMinutes >= LATE_AFTERNOON_MINUTES && slot.key === 'afternoon') {
    return {
      status: 'late-warning',
      message:
        'The time may not be enough to provide service in the afternoon, are you sure you want to proceed?',
    };
  }

  return { status: 'ok' };
}

/** Midnight (00:00:00.000) of the local day containing `d`. */
function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
