import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
    from: vi.fn(),
  },
}));

vi.mock('../../lib/supabase', () => ({ supabase: hoisted.supabase }));

import { updateDisplayName } from '../auth.service';
import {
  validateDisplayName,
  DISPLAY_NAME_MIN,
  DISPLAY_NAME_MAX,
} from '../validation';

function makeBuilder(result: { data: any; error: any }) {
  const builder: any = {};
  const methods = [
    'select',
    'eq',
    'is',
    'order',
    'limit',
    'insert',
    'update',
    'delete',
    'upsert',
    'or',
    'single',
    'maybeSingle',
    'neq',
  ];
  methods.forEach((m) => {
    builder[m] = vi.fn(() => builder);
  });
  builder.then = (resolve: any) => Promise.resolve(result).then(resolve);
  return builder;
}

describe('validateDisplayName', () => {
  it('rejects empty / whitespace-only input', () => {
    expect(validateDisplayName('').isValid).toBe(false);
    expect(validateDisplayName('   ').isValid).toBe(false);
    expect(validateDisplayName(null).isValid).toBe(false);
    expect(validateDisplayName(undefined).isValid).toBe(false);
  });

  it('enforces the minimum length', () => {
    const res = validateDisplayName('a');
    expect(res.isValid).toBe(false);
    expect(res.error).toContain(String(DISPLAY_NAME_MIN));
  });

  it('enforces the maximum length', () => {
    const tooLong = 'a'.repeat(DISPLAY_NAME_MAX + 1);
    const res = validateDisplayName(tooLong);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain(String(DISPLAY_NAME_MAX));
  });

  it('rejects names with unsupported characters', () => {
    expect(validateDisplayName('John123').isValid).toBe(false); // digits
    expect(validateDisplayName('John@Doe').isValid).toBe(false); // symbol
    expect(validateDisplayName('Jean#').isValid).toBe(false); // symbol
  });

  it('rejects names without any letter', () => {
    expect(validateDisplayName('---').isValid).toBe(false);
    expect(validateDisplayName("'  '").isValid).toBe(false);
  });

  it('accepts letters, spaces, hyphens, and apostrophes', () => {
    expect(validateDisplayName('John').isValid).toBe(true);
    expect(validateDisplayName("O'Brien").isValid).toBe(true);
    expect(validateDisplayName('Mary-Jane').isValid).toBe(true);
    expect(validateDisplayName('José María').isValid).toBe(true); // unicode
    expect(validateDisplayName("Jean D'Arc").isValid).toBe(true);
  });

  it('trims the returned normalized value', () => {
    const res = validateDisplayName('  Jane Doe  ');
    expect(res.isValid).toBe(true);
    expect(res.normalized).toBe('Jane Doe');
  });
});

describe('updateDisplayName', () => {
  beforeEach(() => {
    hoisted.supabase.auth.getSession.mockReset();
    hoisted.supabase.from.mockReset();
  });

  it('returns a friendly error without hitting the DB when invalid', async () => {
    const res = await updateDisplayName('a');
    expect(res.user).toBeNull();
    expect(res.error).toContain(String(DISPLAY_NAME_MIN));
    expect(hoisted.supabase.from).not.toHaveBeenCalled();
  });

  it('updates the database first, then returns the refreshed user', async () => {
    hoisted.supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
    });

    const profile = {
      id: 'u1',
      email: 'a@b.com',
      name: 'Jane Doe',
      role: 'customer',
      avatar_url: null,
      work_category: null,
      bio: null,
      phone: null,
      hourly_rate: null,
      address: null,
      apartment: null,
      city: null,
      zip_code: null,
      rating: null,
      reviews_count: null,
    };
    hoisted.supabase.from.mockReturnValue(
      makeBuilder({ data: profile, error: null })
    );

    const res = await updateDisplayName('  Jane Doe  ');
    expect(res.error).toBeNull();
    expect(res.user).not.toBeNull();
    expect(res.user!.name).toBe('Jane Doe'); // normalized + persisted

    // The DB write must have been issued with the normalized name.
    expect(hoisted.supabase.from).toHaveBeenCalledWith('profiles');
    const updateCall = hoisted.supabase.from.mock.results[0].value;
    expect(updateCall.update).toHaveBeenCalledWith({ name: 'Jane Doe' });
    expect(updateCall.eq).toHaveBeenCalledWith('id', 'u1');
  });

  it('surfaces a DB error as a friendly message', async () => {
    hoisted.supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
    });
    hoisted.supabase.from.mockReturnValue(
      makeBuilder({ data: null, error: { message: 'boom' } })
    );

    const res = await updateDisplayName('Valid Name');
    expect(res.user).toBeNull();
    expect(res.error).toBe('boom');
  });
});
