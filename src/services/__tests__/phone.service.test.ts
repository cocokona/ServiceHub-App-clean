import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('../../lib/supabase', () => ({ supabase: hoisted.supabase }));

import { checkPhoneUniquenessWithinRole } from '../phone.service';

function makeBuilder(result: { data: any; error: any }) {
  const builder: any = {};
  const methods = [
    'select',
    'eq',
    'is',
    'limit',
    'neq',
    'maybeSingle',
    'single',
  ];
  methods.forEach((m) => {
    builder[m] = vi.fn(() => builder);
  });
  builder.then = (resolve: any) => Promise.resolve(result).then(resolve);
  return builder;
}

describe('checkPhoneUniquenessWithinRole', () => {
  beforeEach(() => {
    hoisted.supabase.from.mockReset();
  });

  function mock(result: { data: any; error: any }) {
    hoisted.supabase.from.mockReturnValue(makeBuilder(result));
  }

  it('treats empty/whitespace input as never a duplicate', async () => {
    const result = await checkPhoneUniquenessWithinRole({
      phone: '   ',
      role: 'customer',
    });
    expect(result.isDuplicate).toBe(false);
    expect(hoisted.supabase.from).not.toHaveBeenCalled();
  });

  it('flags a phone already used by another profile of the SAME role', async () => {
    mock({ data: { id: 'other' }, error: null });
    const result = await checkPhoneUniquenessWithinRole({
      phone: '555-0101',
      role: 'customer',
      excludeProfileId: 'me',
    });
    expect(result.isDuplicate).toBe(true);
    expect(result.existingProfileId).toBe('other');
  });

  it('allows the SAME phone when it belongs only to the caller (self excluded)', async () => {
    // The DB applies neq('id', 'me'), so only *other* profiles are considered;
    // a self-only match resolves to no row.
    mock({ data: null, error: null });
    const result = await checkPhoneUniquenessWithinRole({
      phone: '555-0101',
      role: 'customer',
      excludeProfileId: 'me',
    });
    expect(result.isDuplicate).toBe(false);
  });

  it('permits a phone used by the OTHER role (cross-role overlap)', async () => {
    // No *customer* row carries this phone (the only holder is a technician).
    mock({ data: null, error: null });
    const result = await checkPhoneUniquenessWithinRole({
      phone: '555-0101',
      role: 'customer',
      excludeProfileId: 'me',
    });
    expect(result.isDuplicate).toBe(false);
  });

  it('fails open (not a duplicate) on a lookup error so the DB index stays authoritative', async () => {
    mock({ data: null, error: { code: 'PGRST', message: 'boom' } });
    const result = await checkPhoneUniquenessWithinRole({
      phone: '555-0101',
      role: 'technician',
      excludeProfileId: 'me',
    });
    expect(result.isDuplicate).toBe(false);
  });

  it('fails open for an unknown role rather than blocking', async () => {
    mock({ data: { id: 'x' }, error: null });
    const result = await checkPhoneUniquenessWithinRole({
      phone: '555-0101',
      // @ts-expect-error intentionally invalid role to exercise the guard
      role: 'admin',
      excludeProfileId: 'me',
    });
    expect(result.isDuplicate).toBe(false);
  });
});
