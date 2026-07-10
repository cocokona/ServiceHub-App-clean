import { describe, it, expect } from 'vitest';
import {
  validateCustomerOrderProfile,
  validateTechnicianAcceptProfile,
  normalizePhoneForDial,
} from '../validation';

describe('validateCustomerOrderProfile', () => {
  it('passes when both address and phone are present', () => {
    const result = validateCustomerOrderProfile({ address: '123 Main St', phone: '4155550132' });
    expect(result.isValid).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it('fails when address is missing', () => {
    const result = validateCustomerOrderProfile({ address: '', phone: '4155550132' });
    expect(result.isValid).toBe(false);
    expect(result.missing).toEqual(['address']);
    expect(result.errors).toEqual(['service address']);
  });

  it('fails when phone is missing', () => {
    const result = validateCustomerOrderProfile({ address: '123 Main St', phone: '' });
    expect(result.isValid).toBe(false);
    expect(result.missing).toEqual(['phone']);
    expect(result.errors).toEqual(['phone number']);
  });

  it('fails when both are missing and lists both errors', () => {
    const result = validateCustomerOrderProfile({ address: '   ', phone: null });
    expect(result.isValid).toBe(false);
    expect(result.missing).toEqual(['address', 'phone']);
    expect(result.errors).toEqual(['service address', 'phone number']);
  });
});

describe('validateTechnicianAcceptProfile', () => {
  it('passes when phone is present', () => {
    const result = validateTechnicianAcceptProfile({ phone: '+1 415 555 0132' });
    expect(result.isValid).toBe(true);
  });

  it('fails when phone is missing', () => {
    const result = validateTechnicianAcceptProfile({ phone: '' });
    expect(result.isValid).toBe(false);
    expect(result.missing).toEqual(['phone']);
    expect(result.errors).toEqual(['phone number']);
  });
});

describe('normalizePhoneForDial', () => {
  it('strips formatting from a US number', () => {
    expect(normalizePhoneForDial('(415) 555-0132')).toBe('4155550132');
  });

  it('preserves a leading plus', () => {
    expect(normalizePhoneForDial('+1 415 555 0132')).toBe('+14155550132');
  });

  it('returns empty string for null/undefined/empty', () => {
    expect(normalizePhoneForDial('')).toBe('');
    expect(normalizePhoneForDial(null)).toBe('');
    expect(normalizePhoneForDial(undefined)).toBe('');
  });
});
