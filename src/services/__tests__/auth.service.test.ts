import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      resend: vi.fn(),
      getSession: vi.fn(),
    },
    from: vi.fn(),
  },
}));

vi.mock('../../lib/supabase', () => ({ supabase: hoisted.supabase }));

import {
  signUp,
  signIn,
  signOut,
  getCurrentUser,
  updateProfile,
} from '../auth.service';

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

describe('auth.service', () => {
  beforeEach(() => {
    hoisted.supabase.auth.signUp.mockReset();
    hoisted.supabase.auth.signInWithPassword.mockReset();
    hoisted.supabase.auth.signOut.mockReset();
    hoisted.supabase.auth.getSession.mockReset();
    hoisted.supabase.from.mockReset();
  });

  function mockProfile(profile: any) {
    hoisted.supabase.from.mockReturnValue(makeBuilder({ data: profile, error: null }));
  }

  // Returns queued results one-per-`from()` call (round-robin). Needed because
  // updateProfile may issue several sequential queries (role lookup, duplicate
  // check, then the update itself).
  function mockSequence(results: { data: any; error: any }[]) {
    const queue = [...results];
    hoisted.supabase.from.mockImplementation(() =>
      makeBuilder(queue.length ? queue.shift()! : { data: null, error: null })
    );
  }

  it('signUp returns a mapped user on success (with session + profile)', async () => {
    hoisted.supabase.auth.signUp.mockResolvedValue({
      data: { user: { id: 'u1' }, session: {} },
      error: null,
    });
    mockProfile({ id: 'u1', email: 'a@b.com', name: 'Al', role: 'customer', hourly_rate: 40 });

    const res = await signUp({ email: 'A@B.COM', password: 'x', name: 'Al', role: 'customer' });
    expect(res.error).toBeNull();
    expect(res.user?.id).toBe('u1');
    expect(res.user?.hourlyRate).toBe(40);
    expect(res.user?.email).toBe('a@b.com'); // normalized to lower-case
  });

  it('signUp returns the error message on auth failure', async () => {
    hoisted.supabase.auth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'email taken' },
    });

    const res = await signUp({ email: 'a@b.com', password: 'x', name: 'Al', role: 'customer' });
    expect(res.user).toBeNull();
    expect(res.error).toBe('email taken');
  });

  it('signIn returns a mapped user on success', async () => {
    hoisted.supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'u1' } },
      error: null,
    });
    mockProfile({ id: 'u1', email: 'a@b.com', name: 'Al', role: 'customer' });

    const res = await signIn('a@b.com', 'x');
    expect(res.user?.id).toBe('u1');
  });

  it('getCurrentUser returns null when there is no session', async () => {
    hoisted.supabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    expect(await getCurrentUser()).toBeNull();
  });

  it('getCurrentUser returns a mapped user when session + profile exist', async () => {
    hoisted.supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
      error: null,
    });
    mockProfile({ id: 'u1', email: 'a@b.com', name: 'Al', role: 'technician' });

    const user = await getCurrentUser();
    expect(user?.id).toBe('u1');
    expect(user?.role).toBe('technician');
  });

  it('updateProfile returns an error when not authenticated', async () => {
    hoisted.supabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    const res = await updateProfile({ name: 'X' });
    expect(res.user).toBeNull();
    expect(res.error).toBe('Not authenticated');
  });

  it('updateProfile returns the mapped user on success', async () => {
    hoisted.supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
      error: null,
    });
    hoisted.supabase.from.mockReturnValue(
      makeBuilder({ data: { id: 'u1', email: 'a@b.com', name: 'Updated', role: 'customer' }, error: null }),
    );

    const res = await updateProfile({ name: 'Updated' });
    expect(res.user?.name).toBe('Updated');
    expect(res.error).toBeNull();
  });

  it('signOut delegates to supabase.auth.signOut', async () => {
    hoisted.supabase.auth.signOut.mockResolvedValue(undefined);
    await signOut();
    expect(hoisted.supabase.auth.signOut).toHaveBeenCalled();
  });

  it('updateProfile blocks a phone already used by another customer (same role)', async () => {
    hoisted.supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
      error: null,
    });
    // 1) role lookup -> customer; 2) duplicate check -> another customer found.
    mockSequence([
      { data: { role: 'customer' }, error: null },
      { data: { id: 'u2' }, error: null },
    ]);

    const res = await updateProfile({ phone: '555-0101' });

    expect(res.user).toBeNull();
    expect(res.error).toContain('This phone number is already used by other');
    expect(res.error).toContain('cancel the last account first');
  });

  it('updateProfile allows a phone used by a technician when the user is a customer (cross-role overlap)', async () => {
    hoisted.supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
      error: null,
    });
    // 1) role lookup -> customer; 2) no *customer* has this phone; 3) update ok.
    mockSequence([
      { data: { role: 'customer' }, error: null },
      { data: null, error: null },
      { data: { id: 'u1', email: 'a@b.com', name: 'Al', role: 'customer', phone: '555-0101' }, error: null },
    ]);

    const res = await updateProfile({ phone: '555-0101' });

    expect(res.error).toBeNull();
    expect(res.user?.phone).toBe('555-0101');
  });

  it('updateProfile allows clearing the phone (empty/whitespace) without a uniqueness check', async () => {
    hoisted.supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
      error: null,
    });
    // Only the update call happens (empty phone -> no role lookup, no dup check).
    hoisted.supabase.from.mockReturnValue(
      makeBuilder({ data: { id: 'u1', email: 'a@b.com', name: 'Al', role: 'customer', phone: '' }, error: null }),
    );

    const res = await updateProfile({ phone: '   ' });

    expect(res.error).toBeNull();
    expect(res.user?.phone).toBe('');
  });

  it('maps a DB unique-violation (23505) to the friendly, role-aware message', async () => {
    hoisted.supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
      error: null,
    });
    // 1) role -> customer; 2) pre-check missed it (e.g. race); 3) update 23505.
    mockSequence([
      { data: { role: 'customer' }, error: null },
      { data: null, error: null },
      {
        data: null,
        error: {
          code: '23505',
          message:
            'duplicate key value violates unique constraint "idx_profiles_customer_phone_unique"',
        },
      },
    ]);

    const res = await updateProfile({ phone: '555-0101' });

    expect(res.user).toBeNull();
    expect(res.error).toContain('This phone number is already used by other');
    expect(res.error).toContain('cancel the last account first');
  });
});
