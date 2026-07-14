import { describe, it, expect } from 'vitest';
import type { TimeSlot } from '../../data/loader';
import {
  validateCustomerOrderProfile,
  validateTechnicianAcceptProfile,
  validateTechnicianCanAcceptJob,
  normalizePhoneForDial,
  normalizePhone,
  validatePhoneUniqueness,
  phoneUniquenessErrorMessage,
  validateServiceTime,
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

describe('validateTechnicianCanAcceptJob', () => {
  it('allows a matching specialty to accept the job', () => {
    const result = validateTechnicianCanAcceptJob({
      technicianWorkCategory: 'repair',
      jobServiceCategory: 'repair',
    });
    expect(result.isValid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('blocks a repair technician from accepting a cleaning job', () => {
    const result = validateTechnicianCanAcceptJob({
      technicianWorkCategory: 'repair',
      jobServiceCategory: 'cleaning',
    });
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('cleaning');
  });

  it('allows a universal ("all") technician to accept any category', () => {
    const result = validateTechnicianCanAcceptJob({
      technicianWorkCategory: 'all',
      jobServiceCategory: 'cleaning',
    });
    expect(result.isValid).toBe(true);
  });

  it('allows a technician with no specialty set to accept any category', () => {
    const result = validateTechnicianCanAcceptJob({
      technicianWorkCategory: null,
      jobServiceCategory: 'beauty',
    });
    expect(result.isValid).toBe(true);
  });

  it('fails closed when the job category is missing', () => {
    const result = validateTechnicianCanAcceptJob({
      technicianWorkCategory: 'repair',
      jobServiceCategory: null,
    });
    expect(result.isValid).toBe(false);
    expect(result.reason).toBeTruthy();
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

describe('normalizePhone', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizePhone('  555-0101  ')).toBe('555-0101');
  });

  it('collapses internal whitespace runs into a single space', () => {
    expect(normalizePhone('555  -  0101')).toBe('555 - 0101');
  });

  it('returns empty string for null/undefined/empty input', () => {
    expect(normalizePhone('')).toBe('');
    expect(normalizePhone('   ')).toBe('');
    expect(normalizePhone(null)).toBe('');
    expect(normalizePhone(undefined)).toBe('');
  });
});

describe('validatePhoneUniqueness', () => {
  it('allows empty input (no phone on file) without a network check', () => {
    const result = validatePhoneUniqueness('');
    expect(result.isValid).toBe(true);
    expect(result.normalized).toBe('');
    expect(result.error).toBeUndefined();
  });

  it('allows whitespace-only input as "no phone"', () => {
    const result = validatePhoneUniqueness('   \t  ');
    expect(result.isValid).toBe(true);
    expect(result.normalized).toBe('');
  });

  it('returns the trimmed value for a real number and stays valid', () => {
    const result = validatePhoneUniqueness('  (415) 555-0132 ');
    expect(result.isValid).toBe(true);
    expect(result.normalized).toBe('(415) 555-0132');
  });
});

describe('phoneUniquenessErrorMessage', () => {
  const EXPECTED =
    'This phone number is already used by other. Please enter a real phone number or cancel the last account first. If you meet a difficult, please feel free to find customer service.';

  it('returns the fixed message for a customer', () => {
    expect(phoneUniquenessErrorMessage('customer')).toBe(EXPECTED);
  });

  it('returns the same fixed message for a technician', () => {
    expect(phoneUniquenessErrorMessage('technician')).toBe(EXPECTED);
  });
});

describe('validateServiceTime', () => {
  // Slot windows mirror service-config.json (24h local hours).
  const SLOTS: TimeSlot[] = [
    { key: 'morning', label: 'Morning', time: '8 AM - 12 PM', icon: 'sunny', startHour: 8, endHour: 12 },
    { key: 'afternoon', label: 'Afternoon', time: '12 PM - 5 PM', icon: 'partly-sunny', startHour: 12, endHour: 17 },
    { key: 'evening', label: 'Evening', time: '5 PM - 9 PM', icon: 'moon', startHour: 17, endHour: 21 },
  ];

  // A fixed reference "today" so tests don't depend on the wall clock.
  const today = (h: number, m = 0) => new Date(2026, 6, 14, h, m, 0, 0);
  const onDay = (y: number, mo: number, d: number) => new Date(y, mo, d, 9, 0, 0, 0);

  it('allows any slot on a future date', () => {
    const result = validateServiceTime({
      date: onDay(2026, 6, 20),
      timeSlotKey: 'morning',
      timeSlots: SLOTS,
      now: today(15), // 3 PM today, but the booking is next week
    });
    expect(result.status).toBe('ok');
  });

  it('blocks "Today Morning" once it is 12:00 PM or later (Rule 1)', () => {
    const result = validateServiceTime({
      date: today(13), // 1 PM
      timeSlotKey: 'morning',
      timeSlots: SLOTS,
      now: today(13),
    });
    expect(result.status).toBe('past');
    expect(result.message).toContain('Morning');
  });

  it('still allows "Today Morning" at 11:30 AM (window open until noon)', () => {
    const result = validateServiceTime({
      date: today(11, 30),
      timeSlotKey: 'morning',
      timeSlots: SLOTS,
      now: today(11, 30),
    });
    expect(result.status).toBe('ok');
  });

  it('blocks "Today Afternoon" once it is 5:00 PM or later (general past, Rule 3)', () => {
    const result = validateServiceTime({
      date: today(18), // 6 PM
      timeSlotKey: 'afternoon',
      timeSlots: SLOTS,
      now: today(18),
    });
    expect(result.status).toBe('past');
  });

  it('allows "Today Afternoon" at 4:00 PM (before the late threshold)', () => {
    const result = validateServiceTime({
      date: today(16), // 4 PM
      timeSlotKey: 'afternoon',
      timeSlots: SLOTS,
      now: today(16),
    });
    expect(result.status).toBe('ok');
  });

  it('flags a late-afternoon confirmation at exactly 4:30 PM (Rule 2)', () => {
    const result = validateServiceTime({
      date: today(16, 30),
      timeSlotKey: 'afternoon',
      timeSlots: SLOTS,
      now: today(16, 30),
    });
    expect(result.status).toBe('late-warning');
    expect(result.message).toBe(
      'The time may not be enough to provide service in the afternoon, are you sure you want to proceed?'
    );
  });

  it('does NOT warn for a future-day afternoon slot at 4:30 PM today', () => {
    const result = validateServiceTime({
      date: onDay(2026, 6, 20),
      timeSlotKey: 'afternoon',
      timeSlots: SLOTS,
      now: today(16, 30),
    });
    expect(result.status).toBe('ok');
  });

  it('blocks "Today Evening" once it is 9:00 PM or later (general past, Rule 3)', () => {
    const result = validateServiceTime({
      date: today(22), // 10 PM
      timeSlotKey: 'evening',
      timeSlots: SLOTS,
      now: today(22),
    });
    expect(result.status).toBe('past');
  });

  it('treats a past date as unavailable', () => {
    const result = validateServiceTime({
      date: onDay(2026, 6, 10),
      timeSlotKey: 'morning',
      timeSlots: SLOTS,
      now: today(9),
    });
    expect(result.status).toBe('past');
  });

  it('does not block an unknown slot key (defensive)', () => {
    const result = validateServiceTime({
      date: today(9),
      timeSlotKey: 'night-owl',
      timeSlots: SLOTS,
      now: today(9),
    });
    expect(result.status).toBe('ok');
  });
});
