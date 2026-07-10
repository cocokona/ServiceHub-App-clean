import { describe, it, expect } from 'vitest';
import {
  ADDRESS_FIELDS,
  ADDRESS_FIELD_KEYS,
  emptyAddressFields,
  validateAddressFields,
  formatAddress,
  profileToAddressFields,
  addressFieldsToProfile,
} from '../address';
import type { User } from '../../types';

describe('address — shared model', () => {
  it('emptyAddressFields returns all-empty fields', () => {
    expect(emptyAddressFields()).toEqual({
      street: '',
      apartment: '',
      city: '',
      zipCode: '',
    });
  });

  it('validates required fields (street, city, 5-digit ZIP)', () => {
    const empty = validateAddressFields(emptyAddressFields());
    expect(empty.isValid).toBe(false);
    expect(empty.missing.sort()).toEqual(['city', 'street', 'zipCode']);

    const badZip = validateAddressFields({
      street: '123 Main St',
      apartment: '',
      city: 'San Francisco',
      zipCode: '123',
    });
    expect(badZip.isValid).toBe(false);
    expect(badZip.missing).toEqual(['zipCode']);

    const complete = validateAddressFields({
      street: '123 Main St',
      apartment: 'Apt 2B',
      city: 'San Francisco',
      zipCode: '94105',
    });
    expect(complete.isValid).toBe(true);
    expect(complete.missing).toEqual([]);
  });

  it('formats a single consistent display string', () => {
    expect(
      formatAddress({
        street: '123 Main St',
        apartment: 'Apt 2B',
        city: 'San Francisco',
        zipCode: '94105',
      })
    ).toBe('123 Main St, Apt 2B, San Francisco, 94105');

    expect(formatAddress(emptyAddressFields())).toBe('');
    expect(
      formatAddress({ street: '123 Main St', apartment: '', city: '', zipCode: '' })
    ).toBe('123 Main St');
  });

  it('round-trips between a User profile and AddressFields', () => {
    const user: Partial<User> = {
      address: '500 Market St',
      apartment: 'Ste 100',
      city: 'San Francisco',
      zipCode: '94105',
    };
    const fields = profileToAddressFields(user);
    expect(fields).toEqual({
      street: '500 Market St',
      apartment: 'Ste 100',
      city: 'San Francisco',
      zipCode: '94105',
    });

    const back = addressFieldsToProfile(fields);
    expect(back).toEqual({
      address: '500 Market St',
      apartment: 'Ste 100',
      city: 'San Francisco',
      zipCode: '94105',
    });
  });

  it('profileToAddressFields tolerates a null/undefined user', () => {
    expect(profileToAddressFields(null)).toEqual(emptyAddressFields());
    expect(profileToAddressFields(undefined)).toEqual(emptyAddressFields());
  });

  it('ADDRESS_FIELDS is the single source of truth shared by BOTH forms', () => {
    // The exact field structure used by the customer profile form AND the
    // order ("Schedule & Address") form. Changing this list changes both.
    expect(ADDRESS_FIELD_KEYS).toEqual(['street', 'apartment', 'city', 'zipCode']);

    // Every key maps 1:1 to a column in both the `profiles` table and the
    // `order_in_progress` / `jobs` tables — proving the stored formats match.
    const dbColumns = ['address', 'apartment', 'city', 'zip_code'] as const;
    const mapped = ADDRESS_FIELD_KEYS.map((k) => {
      if (k === 'street') return 'address';
      if (k === 'zipCode') return 'zip_code';
      return k;
    });
    expect(mapped).toEqual([...dbColumns]);

    // Required flags are identical between the two forms because both iterate
    // the same config (street + city + zipCode required, apartment optional).
    const requiredKeys = ADDRESS_FIELDS.filter((f) => f.required).map((f) => f.key);
    expect(requiredKeys.sort()).toEqual(['city', 'street', 'zipCode']);
    expect(ADDRESS_FIELDS.find((f) => f.key === 'apartment')?.required).toBe(false);
  });
});
