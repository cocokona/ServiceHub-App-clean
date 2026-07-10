import { describe, it, expect, vi, beforeEach } from 'vitest';

const { supabase } = vi.hoisted(() => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getSession: vi.fn(),
      getUser: vi.fn(),
    },
  },
}));

vi.mock('../../lib/supabase', () => ({ supabase }));

import {
  submitReview,
  fetchTopReview,
  fetchReviewForJob,
  fetchTechnicianStats,
} from '../review.service';

/** Chainable, thenable Supabase query-builder mock. */
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
    'not',
  ];
  methods.forEach((m) => {
    builder[m] = vi.fn(() => builder);
  });
  builder.then = (resolve: any) => Promise.resolve(result).then(resolve);
  return builder;
}

describe('review.service', () => {
  beforeEach(() => {
    supabase.from.mockReset();
    supabase.rpc.mockReset();
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'cust-1' } },
      error: null,
    });
  });

  it('submitReview inserts using the current user as customer_id', async () => {
    const builder = makeBuilder({
      data: {
        id: 'r1',
        job_id: 'j1',
        customer_id: 'cust-1',
        technician_id: 't1',
        rating: 5,
        comment: 'Great!',
        created_at: '2026-01-01',
      },
      error: null,
    });
    supabase.from.mockReturnValue(builder);

    const review = await submitReview({
      jobId: 'j1',
      technicianId: 't1',
      rating: 5,
      comment: 'Great!',
    });

    expect(supabase.from).toHaveBeenCalledWith('reviews');
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        job_id: 'j1',
        customer_id: 'cust-1',
        technician_id: 't1',
        rating: 5,
        comment: 'Great!',
      })
    );
    expect(review.rating).toBe(5);
    expect(review.comment).toBe('Great!');
  });

  it('submitReview trims a blank comment to null', async () => {
    const builder = makeBuilder({
      data: { id: 'r1', job_id: 'j1', customer_id: 'cust-1', technician_id: 't1', rating: 3, comment: null, created_at: '2026-01-01' },
      error: null,
    });
    supabase.from.mockReturnValue(builder);

    await submitReview({ jobId: 'j1', technicianId: 't1', rating: 3, comment: '   ' });

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ comment: null })
    );
  });

  it('submitReview throws when not signed in', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(
      submitReview({ jobId: 'j1', technicianId: 't1', rating: 4 })
    ).rejects.toThrow(/signed in/i);
  });

  it('submitReview throws on out-of-range rating', async () => {
    await expect(
      submitReview({ jobId: 'j1', technicianId: 't1', rating: 0 })
    ).rejects.toThrow(/1.*5/i);
  });

  it('submitReview maps a unique violation (23505) to a friendly message', async () => {
    const builder = makeBuilder({
      data: null,
      error: { code: '23505', message: 'duplicate key value' },
    });
    supabase.from.mockReturnValue(builder);
    await expect(
      submitReview({ jobId: 'j1', technicianId: 't1', rating: 4 })
    ).rejects.toThrow(/already reviewed/i);
  });

  it('fetchTopReview returns the highest-rated written review', async () => {
    const builder = makeBuilder({
      data: { id: 'r2', rating: 5, comment: 'Best ever', created_at: '2026-01-02' },
      error: null,
    });
    supabase.from.mockReturnValue(builder);

    const top = await fetchTopReview('t1');

    expect(top?.comment).toBe('Best ever');
    expect(builder.order).toHaveBeenCalledWith('rating', { ascending: false });
    expect(builder.not).toHaveBeenCalledWith('comment', 'is', null);
  });

  it('fetchReviewForJob returns null when none exists', async () => {
    const builder = makeBuilder({ data: null, error: null });
    supabase.from.mockReturnValue(builder);

    const rev = await fetchReviewForJob('j1');

    expect(rev).toBeNull();
  });

  it('fetchTechnicianStats aggregates profile rating/count with top review', async () => {
    const topBuilder = makeBuilder({
      data: { id: 'r9', rating: 5, comment: 'Amazing', created_at: 'x' },
      error: null,
    });
    const profileBuilder = makeBuilder({
      data: { rating: 4.5, reviews_count: 12 },
      error: null,
    });
    // fetchTopReview hits `reviews` first; the stats query hits `profiles` second.
    supabase.from
      .mockReturnValueOnce(topBuilder)
      .mockReturnValueOnce(profileBuilder);

    const stats = await fetchTechnicianStats('t1');

    expect(stats.averageRating).toBe(4.5);
    expect(stats.reviewCount).toBe(12);
    expect(stats.topReview?.comment).toBe('Amazing');
  });
});
