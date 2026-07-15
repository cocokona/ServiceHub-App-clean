import { describe, it, expect, vi, beforeEach } from 'vitest';

const { supabase } = vi.hoisted(() => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: { getSession: vi.fn() },
  },
}));

vi.mock('../../lib/supabase', () => ({ supabase }));

import {
  fetchJobsByCustomer,
  createOrderInProgress,
  acceptOrderInProgress,
  fetchTechnicians,
  updateJobStatus,
  fetchAllOrdersInProgress,
  fetchOrdersInProgress,
  rejectOrderInProgress,
  seedTechnicianAvailability,
  setOrderInProgressStatus,
} from '../database.service';

/** Builds a chainable, thenable Supabase query-builder mock that resolves to
 *  the supplied { data, error } result. Mirrors the subset of the builder API
 *  the data layer actually uses. */
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

describe('database.service', () => {
  beforeEach(() => {
    supabase.from.mockReset();
    supabase.rpc.mockReset();
    supabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: 'u1', email: 'u1@test.com', user_metadata: {} },
        },
      },
      error: null,
    });
  });

  describe('fetchJobsByCustomer', () => {
    it('maps DB rows to Job with nested checklist/material collections', async () => {
      supabase.from.mockReturnValue(
        makeBuilder({
          data: [
            {
              id: 'j1',
              service_type: 'Cleaning',
              service_category: 'cleaning',
              customer_name: 'A',
              status: 'pending',
              base_rate: '50',
              total_price: '70',
              job_checklists: [{ text: 't1', completed: false }],
              job_materials: [{ name: 'm1', quantity: 2 }],
            },
          ],
          error: null,
        }),
      );

      const jobs = await fetchJobsByCustomer('u1');
      expect(jobs).toHaveLength(1);
      expect(jobs[0].id).toBe('j1');
      expect(jobs[0].checklist).toEqual([{ text: 't1', completed: false }]);
      expect(jobs[0].materials).toEqual([{ name: 'm1', quantity: 2 }]);
      expect(jobs[0].baseRate).toBe(50);
      expect(jobs[0].totalPrice).toBe(70);
    });

    it('throws a plain Error carrying the DB message on failure (interface-compatible)', async () => {
      supabase.from.mockReturnValue(makeBuilder({ data: null, error: { message: 'boom' } }));
      await expect(fetchJobsByCustomer('u1')).rejects.toThrow('boom');
    });
  });

  describe('createOrderInProgress', () => {
    const baseOrder = {
      customerId: 'u1',
      serviceType: 'Repair',
      serviceCategory: 'repair',
    } as any;

    it('returns the mapped Job on success', async () => {
      supabase.from.mockReturnValue(
        makeBuilder({
          data: { id: 'o1', service_type: 'Repair', service_category: 'repair', total_price: '99' },
          error: null,
        }),
      );

      const job = await createOrderInProgress(baseOrder);
      expect(job?.id).toBe('o1');
      expect(job?.status).toBe('pending');
      expect(job?.totalPrice).toBe(99);
    });

    it('persists the assigned technician_id with the order record', async () => {
      const builder = makeBuilder({
        data: {
          id: 'o1',
          service_type: 'Repair',
          service_category: 'repair',
          total_price: '99',
          technician_id: 't-assigned',
        },
        error: null,
      });
      supabase.from.mockReturnValue(builder);

      const job = await createOrderInProgress({ ...baseOrder, technicianId: 't-assigned' });

      // The FK reference must be written to the row...
      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ technician_id: 't-assigned' })
      );
      // ...and mapped back onto the returned Job so it survives in app state.
      expect(job?.technicianId).toBe('t-assigned');
    });

    it('throws a friendly message on a foreign-key violation (SQLSTATE 23503)', async () => {
      supabase.from.mockReturnValue(
        makeBuilder({ data: null, error: { message: 'violates foreign key', code: '23503' } }),
      );
      await expect(createOrderInProgress(baseOrder)).rejects.toThrow(
        'Your profile was not found',
      );
    });

    it('throws the raw DB message on any other error', async () => {
      supabase.from.mockReturnValue(makeBuilder({ data: null, error: { message: 'db down' } }));
      await expect(createOrderInProgress(baseOrder)).rejects.toThrow('db down');
    });
  });

  describe('acceptOrderInProgress', () => {
    it('returns the new job id returned by the RPC', async () => {
      supabase.rpc.mockReturnValue(makeBuilder({ data: 'new-job', error: null }));
      const id = await acceptOrderInProgress('o1', 't1');
      expect(id).toBe('new-job');
    });

    it('throws on RPC error', async () => {
      supabase.rpc.mockReturnValue(makeBuilder({ data: null, error: { message: 'rpc fail' } }));
      await expect(acceptOrderInProgress('o1', 't1')).rejects.toThrow('rpc fail');
    });
  });

  describe('fetchTechnicians', () => {
    it('maps profile rows to Technician and defaults the hourly rate', async () => {
      supabase.from.mockReturnValue(
        makeBuilder({
          data: [
            {
              id: 't1',
              name: 'Bob',
              avatar_url: 'http://x/a.png',
              rating: 4.5,
              reviews_count: 10,
              work_category: 'cleaning',
              hourly_rate: null,
            },
          ],
          error: null,
        }),
      );

      const techs = await fetchTechnicians();
      expect(techs[0].name).toBe('Bob');
      expect(techs[0].ratePerHour).toBe(45); // default when hourly_rate is null
      expect(techs[0].specialty).toBe('cleaning');
      expect(techs[0].reviewsCount).toBe(10);
    });

    it('only returns ACTIVE technicians (is_active = true filter applied)', async () => {
      const builder = makeBuilder({ data: [], error: null });
      supabase.from.mockReturnValue(builder);

      await fetchTechnicians('cleaning');

      // Must scope to technician role AND active accounts only.
      expect(builder.eq).toHaveBeenCalledWith('role', 'technician');
      expect(builder.eq).toHaveBeenCalledWith('is_active', true);
      // Category filter should target the requested work_category or 'all'.
      expect(builder.or).toHaveBeenCalledWith(
        'work_category.eq.cleaning,work_category.eq.all'
      );
    });
  });

  describe('updateJobStatus', () => {
    it('resolves on success', async () => {
      supabase.from.mockReturnValue(makeBuilder({ data: null, error: null }));
      await expect(updateJobStatus('j1', { status: 'completed' })).resolves.toBeUndefined();
    });

    it('throws on error', async () => {
      supabase.from.mockReturnValue(makeBuilder({ data: null, error: { message: 'nope' } }));
      await expect(updateJobStatus('j1', { status: 'completed' })).rejects.toThrow('nope');
    });
  });

  describe('fetchAllOrdersInProgress', () => {
    it('excludes orders a technician has already rejected (technicianId passed)', async () => {
      const rejBuilder = makeBuilder({ data: [{ order_id: 'o-rej' }], error: null });
      const ordersBuilder = makeBuilder({
        data: [
          { id: 'o1', service_type: 'Cleaning', service_category: 'cleaning', total_price: '10' },
          { id: 'o-rej', service_type: 'Repair', service_category: 'repair', total_price: '20' },
        ],
        error: null,
      });

      // First .from() call reads this technician's rejections; second reads orders.
      supabase.from.mockImplementation((table: string) =>
        table === 'order_rejections' ? rejBuilder : ordersBuilder
      );

      await fetchAllOrdersInProgress('all', 't1');

      // The browse query must filter out the rejected order id.
      expect(ordersBuilder.not).toHaveBeenCalledWith('id', 'in', '(o-rej)');
    });

    it('does not apply the exclusion filter when no technicianId is given', async () => {
      const ordersBuilder = makeBuilder({ data: [], error: null });
      supabase.from.mockReturnValue(ordersBuilder);

      await fetchAllOrdersInProgress('cleaning');

      expect(ordersBuilder.not).not.toHaveBeenCalled();
      expect(ordersBuilder.eq).toHaveBeenCalledWith('service_category', 'cleaning');
    });
  });

  describe('fetchOrdersInProgress', () => {
    it('maps last_rejection_reason onto the Job.rejectionReason field', async () => {
      supabase.from.mockReturnValue(
        makeBuilder({
          data: [
            {
              id: 'o1',
              service_type: 'Cleaning',
              service_category: 'cleaning',
              total_price: '10',
              last_rejection_reason: 'too_far',
            },
          ],
          error: null,
        }),
      );

      const orders = await fetchOrdersInProgress('c1');
      expect(orders).toHaveLength(1);
      expect(orders[0].rejectionReason).toBe('too_far');
    });

    it('leaves rejectionReason null when no decline has been recorded', async () => {
      supabase.from.mockReturnValue(
        makeBuilder({
          data: [{ id: 'o1', service_type: 'Cleaning', service_category: 'cleaning', total_price: '10' }],
          error: null,
        }),
      );

      const orders = await fetchOrdersInProgress('c1');
      expect(orders[0].rejectionReason).toBeNull();
    });

    it('maps the real DB status (e.g. rejected) instead of hardcoding pending', async () => {
      supabase.from.mockReturnValue(
        makeBuilder({
          data: [
            {
              id: 'o1',
              service_type: 'Cleaning',
              service_category: 'cleaning',
              total_price: '10',
              status: 'rejected',
              last_rejection_reason: 'too_far',
              rejected_at: '2026-07-15T10:00:00Z',
            },
          ],
          error: null,
        }),
      );

      const orders = await fetchOrdersInProgress('c1');
      // Regression guard: previously this was forced to 'pending', so a
      // declined order never showed as REJECTED on the customer's orders page.
      expect(orders[0].status).toBe('rejected');
      expect(orders[0].rejectedAt).toBe('2026-07-15T10:00:00Z');
    });
  });

  describe('fetchAllOrdersInProgress', () => {
    it('only shows pending orders to technicians (excludes rejected/cancelled)', async () => {
      const builder = makeBuilder({
        data: [
          { id: 'o1', service_type: 'Cleaning', service_category: 'cleaning', total_price: '10', status: 'pending' },
        ],
        error: null,
      });
      supabase.from.mockReturnValue(builder);

      const orders = await fetchAllOrdersInProgress('cleaning');

      // The browse pool must exclude non-pending orders so a rejected order
      // leaves the technician pool (and only the rejecting technician is hidden
      // via their own order_rejections row).
      expect(builder.eq).toHaveBeenCalledWith('status', 'pending');
      expect(orders[0].status).toBe('pending');
    });
  });

  describe('rejectOrderInProgress', () => {
    it('calls the reject_order_in_progress RPC with order/technician/reason', async () => {
      supabase.rpc.mockReturnValue(makeBuilder({ data: null, error: null }));

      await rejectOrderInProgress('o1', 't1', 'too_far');

      expect(supabase.rpc).toHaveBeenCalledWith('reject_order_in_progress', {
        p_order_id: 'o1',
        p_technician_id: 't1',
        p_reason: 'too_far',
      });
    });

    it('throws on RPC error', async () => {
      supabase.rpc.mockReturnValue(makeBuilder({ data: null, error: { message: 'rpc boom' } }));
      await expect(rejectOrderInProgress('o1', 't1', 'no_free')).rejects.toThrow('rpc boom');
    });
  });

  describe('seedTechnicianAvailability', () => {
    it('calls the seed_technician_availability RPC for the technician', async () => {
      supabase.rpc.mockReturnValue(makeBuilder({ data: null, error: null }));

      await seedTechnicianAvailability('t1');

      expect(supabase.rpc).toHaveBeenCalledWith('seed_technician_availability', {
        p_technician_id: 't1',
      });
    });
  });

  describe('setOrderInProgressStatus', () => {
    it('re-opens the order to the pool with status pending', async () => {
      supabase.rpc.mockReturnValue(makeBuilder({ data: null, error: null }));

      await setOrderInProgressStatus('o1', 'pending');

      expect(supabase.rpc).toHaveBeenCalledWith('set_order_in_progress_status', {
        p_order_id: 'o1',
        p_status: 'pending',
      });
    });

    it('cancels the order with status cancelled', async () => {
      supabase.rpc.mockReturnValue(makeBuilder({ data: null, error: null }));

      await setOrderInProgressStatus('o1', 'cancelled');

      expect(supabase.rpc).toHaveBeenCalledWith('set_order_in_progress_status', {
        p_order_id: 'o1',
        p_status: 'cancelled',
      });
    });

    it('throws on RPC error', async () => {
      supabase.rpc.mockReturnValue(makeBuilder({ data: null, error: { message: 'not authorized' } }));
      await expect(setOrderInProgressStatus('o1', 'cancelled')).rejects.toThrow('not authorized');
    });
  });
});
