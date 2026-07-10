import { describe, it, expect, vi, beforeEach } from 'vitest';

const { supabase } = vi.hoisted(() => ({
  supabase: {
    from: vi.fn(),
    auth: { getSession: vi.fn() },
  },
}));

vi.mock('../../lib/supabase', () => ({ supabase }));

import {
  detectCardBrand,
  luhnValid,
  formatCardNumber,
  normalizeExpiry,
  isExpiryValid,
  getPaymentMethods,
  addPaymentMethod,
  deletePaymentMethod,
  setDefaultPaymentMethod,
} from '../payment.service';

/** Chainable, thenable Supabase query-builder mock that resolves to the
 *  supplied { data, error } and records the insert payload. */
function makeBuilder(result: { data: any; error: any }) {
  const builder: any = {};
  const chained = [
    'select', 'eq', 'is', 'order', 'limit', 'update', 'delete', 'upsert', 'or', 'single', 'maybeSingle', 'neq',
  ];
  chained.forEach((m) => {
    builder[m] = vi.fn(() => builder);
  });
  builder.__insert = null;
  builder.insert = vi.fn((payload: any) => {
    builder.__insert = payload;
    return builder;
  });
  builder.then = (resolve: any) => Promise.resolve(result).then(resolve);
  return builder;
}

const SESSION = {
  data: { session: { user: { id: 'u1', email: 'u1@test.com' } } },
  error: null,
};

describe('payment.service — pure validators', () => {
  it('detectCardBrand identifies major networks', () => {
    expect(detectCardBrand('4242424242424242')).toBe('visa');
    expect(detectCardBrand('5555555555554444')).toBe('mastercard');
    expect(detectCardBrand('378282246310005')).toBe('amex');
    expect(detectCardBrand('6011111111111117')).toBe('discover');
    expect(detectCardBrand('1234')).toBe('unknown');
  });

  it('luhnValid accepts valid numbers and rejects invalid ones', () => {
    expect(luhnValid('4242424242424242')).toBe(true);
    expect(luhnValid('4242424242424241')).toBe(false);
    expect(luhnValid('')).toBe(false);
  });

  it('formatCardNumber groups digits in fours', () => {
    expect(formatCardNumber('4242424242424242')).toBe('4242 4242 4242 4242');
  });

  it('normalizeExpiry parses MM/YY, returns null when incomplete', () => {
    expect(normalizeExpiry('12/28')).toEqual({ month: 12, year: 28 });
    expect(normalizeExpiry('1228')).toEqual({ month: 12, year: 28 });
    expect(normalizeExpiry('12')).toBeNull();
  });

  it('isExpiryValid checks month bounds and not-in-past deterministically', () => {
    expect(isExpiryValid(12, 2099)).toBe(true);
    expect(isExpiryValid(1, 2000)).toBe(false);
    expect(isExpiryValid(13, 2099)).toBe(false);
    expect(isExpiryValid(0, 2099)).toBe(false);
  });
});

describe('payment.service — data access', () => {
  beforeEach(() => {
    supabase.from.mockReset();
    supabase.auth.getSession.mockResolvedValue(SESSION);
  });

  it('getPaymentMethods maps DB rows to SavedPaymentMethod', async () => {
    supabase.from.mockReturnValue(
      makeBuilder({
        data: [
          {
            id: 'p1', profile_id: 'u1', brand: 'visa', last4: '4242',
            exp_month: 12, exp_year: 2028, cardholder_name: 'Jane Doe',
            token: 'pm_x', is_default: true, created_at: '2026-01-01',
          },
        ],
        error: null,
      })
    );

    const result = await getPaymentMethods();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'p1', brand: 'visa', last4: '4242', isDefault: true, cardholderName: 'Jane Doe',
    });
  });

  it('getPaymentMethods returns [] when unauthenticated', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    const result = await getPaymentMethods();
    expect(result).toEqual([]);
  });

  it('addPaymentMethod saves a tokenized record and marks first card default', async () => {
    const row = {
      id: 'p1', profile_id: 'u1', brand: 'visa', last4: '4242',
      exp_month: 12, exp_year: 2028, cardholder_name: 'Jane Doe',
      token: 'pm_token', is_default: true, created_at: '2026-01-01',
    };
    // Call order inside addPaymentMethod: ensureProfile (profiles select)
    // first, then getPaymentMethods (payment_methods select, empty), then insert.
    supabase.from
      .mockImplementationOnce(() => makeBuilder({ data: { id: 'u1' }, error: null })) // ensureProfile select
      .mockImplementationOnce(() => makeBuilder({ data: [], error: null })) // getPaymentMethods (empty)
      .mockImplementationOnce(() => makeBuilder({ data: row, error: null })); // insert

    const result = await addPaymentMethod({
      cardNumber: '4242424242424242',
      cardholderName: 'Jane Doe',
      expiryMonth: 12,
      expiryYear: 2028,
      cvv: '123',
    });

    expect(result.last4).toBe('4242');
    expect(result.isDefault).toBe(true);

    const insertBuilder = supabase.from.mock.results[2].value;
    const payload = insertBuilder.__insert;
    expect(payload.profile_id).toBe('u1');
    expect(payload.last4).toBe('4242');
    expect(payload.is_default).toBe(true);
    expect(payload.token).toMatch(/^pm_/);
    // CRITICAL: full PAN and CVV must never be persisted.
    expect(payload).not.toHaveProperty('cardNumber');
    expect(payload).not.toHaveProperty('cvv');
    expect(JSON.stringify(payload)).not.toContain('4242424242424242');
  });

  it('addPaymentMethod rejects an invalid number without touching the DB', async () => {
    await expect(
      addPaymentMethod({
        cardNumber: '1234567890123456',
        cardholderName: 'Jane Doe',
        expiryMonth: 12,
        expiryYear: 2030,
        cvv: '123',
      })
    ).rejects.toThrow(/valid card number/i);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('deletePaymentMethod deletes by id scoped to the owner', async () => {
    supabase.from.mockReturnValue(makeBuilder({ data: null, error: null }));
    await deletePaymentMethod('p1');

    expect(supabase.from).toHaveBeenCalledWith('payment_methods');
    const builder = supabase.from.mock.results[0].value;
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith('id', 'p1');
    expect(builder.eq).toHaveBeenCalledWith('profile_id', 'u1');
  });

  it('setDefaultPaymentMethod clears all then sets the chosen one', async () => {
    supabase.from.mockReturnValue(makeBuilder({ data: null, error: null }));
    await setDefaultPaymentMethod('p2');

    expect(supabase.from).toHaveBeenCalledTimes(2);
    const clearBuilder = supabase.from.mock.results[0].value;
    expect(clearBuilder.update).toHaveBeenCalledWith({ is_default: false });
    expect(clearBuilder.eq).toHaveBeenCalledWith('profile_id', 'u1');

    const setBuilder = supabase.from.mock.results[1].value;
    expect(setBuilder.update).toHaveBeenCalledWith({ is_default: true });
    expect(setBuilder.eq).toHaveBeenCalledWith('profile_id', 'u1');
    expect(setBuilder.eq).toHaveBeenCalledWith('id', 'p2');
  });
});
