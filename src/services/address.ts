/**
 * Shared Address Model
 * =====================
 *
 * The customer profile form and the order ("Schedule & Address") form must
 * capture the SAME address shape, with the SAME validation rules and the SAME
 * display formatting. To guarantee they can never drift apart, BOTH screens
 * render their inputs from `ADDRESS_FIELDS` and validate/format through the
 * helpers in this module.
 *
 * Storage alignment (this is what makes the two "exactly match"):
 *   - profiles table:             address, apartment, city, zip_code
 *   - order_in_progress / jobs:    address, apartment, city, zip_code
 * The field keys below map 1:1 to those columns (`zipCode` <-> `zip_code`).
 */

import type { User } from '../types';

export interface AddressFields {
  /** Street line — stored in the `address` column. Required. */
  street: string;
  /** Apt / Suite / Floor — optional. */
  apartment: string;
  /** City — required. */
  city: string;
  /** 5-digit ZIP — required. */
  zipCode: string;
}

export interface AddressFieldConfig {
  key: keyof AddressFields;
  label: string;
  placeholder: string;
  required: boolean;
  keyboardType?: 'default' | 'numeric';
  maxLength?: number;
}

/**
 * Single source of truth for the address inputs. Both the profile form and the
 * order form iterate over this list, so adding/renaming a field (or changing a
 * required flag) updates both forms at once.
 */
export const ADDRESS_FIELDS: AddressFieldConfig[] = [
  {
    key: 'street',
    label: 'Street Address',
    placeholder: 'Street Address *',
    required: true,
  },
  {
    key: 'apartment',
    label: 'Apt / Suite / Floor',
    placeholder: 'Apt / Suite / Floor',
    required: false,
  },
  {
    key: 'city',
    label: 'City',
    placeholder: 'City *',
    required: true,
  },
  {
    key: 'zipCode',
    label: 'ZIP',
    placeholder: 'ZIP *',
    required: true,
    keyboardType: 'numeric',
    maxLength: 5,
  },
];

/** The canonical set of field keys — used by the consistency test to prove
 *  the profile form and the order form share an identical structure. */
export const ADDRESS_FIELD_KEYS = ADDRESS_FIELDS.map((f) => f.key);

export function emptyAddressFields(): AddressFields {
  return { street: '', apartment: '', city: '', zipCode: '' };
}

export interface AddressValidation {
  isValid: boolean;
  /** Keys of the fields that failed validation (same keys used by both forms). */
  missing: (keyof AddressFields)[];
  /** Human-readable reasons, for Alert copy. */
  errors: string[];
}

const ZIP_PATTERN = /^\d{5}$/;

/**
 * Validate an address the same way in both forms. Required: street, city, and
 * a 5-digit ZIP. `apartment` is optional. Returns the failing field keys so a
 * form can highlight exactly which inputs are incomplete.
 */
export function validateAddressFields(fields: AddressFields): AddressValidation {
  const missing: (keyof AddressFields)[] = [];

  if (!fields.street.trim()) missing.push('street');
  if (!fields.city.trim()) missing.push('city');

  if (!fields.zipCode.trim()) {
    missing.push('zipCode');
  } else if (!ZIP_PATTERN.test(fields.zipCode.trim())) {
    missing.push('zipCode');
  }

  return {
    isValid: missing.length === 0,
    missing,
    errors: missing.map((key) => {
      if (key === 'street') return 'street address';
      if (key === 'city') return 'city';
      return 'a valid 5-digit ZIP code';
    }),
  };
}

/**
 * Single display formatter shared by both forms. Produces one consistent
 * "Street, Apt, City, ZIP" line regardless of which form produced the data.
 */
export function formatAddress(fields: AddressFields): string {
  const parts: string[] = [];

  if (fields.street.trim()) parts.push(fields.street.trim());
  if (fields.apartment.trim()) parts.push(fields.apartment.trim());

  const tail = [fields.city.trim(), fields.zipCode.trim()].filter(Boolean).join(', ');
  if (tail) parts.push(tail);

  return parts.join(', ');
}

/** Map a User/profile row into the shared AddressFields shape. */
export function profileToAddressFields(
  user?: Partial<User> | null
): AddressFields {
  if (!user) return emptyAddressFields();
  return {
    street: user.address ?? '',
    apartment: user.apartment ?? '',
    city: user.city ?? '',
    zipCode: user.zipCode ?? '',
  };
}

/** Map shared AddressFields back into the keys accepted by `updateProfile`. */
export function addressFieldsToProfile(fields: AddressFields) {
  return {
    address: fields.street || undefined,
    apartment: fields.apartment || undefined,
    city: fields.city || undefined,
    zipCode: fields.zipCode || undefined,
  };
}
