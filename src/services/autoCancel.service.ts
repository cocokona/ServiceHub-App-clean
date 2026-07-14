/**
 * Auto-cancel service — server invocation for unaccepted same-day orders.
 *
 * The pure eligibility rules live in `./autoCancel` (no Supabase dependency,
 * unit-tested in isolation). This module re-exports them and adds the
 * privileged `autoCancelUnacceptedOrders()` RPC wrapper that triggers the
 * server-side sweep.
 *
 * Backed by the `auto_cancel_unaccepted_orders()` Postgres function
 * (supabase/migrations/00019_auto_cancel_unaccepted_orders.sql). The function
 * is meant to be driven by a server-side scheduler (pg_cron on Supabase Pro,
 * or a Supabase Edge Function / external cron) on a ~1-minute cadence. It is
 * not intended to be polled from the mobile client on every screen — the
 * client should use the pure helpers in `./autoCancel` for countdowns and
 * realtime/refetch for status changes.
 */

import { supabase } from '../lib/supabase';
import { logAndThrow } from './errors';

export * from './autoCancel';

/**
 * Invoke the server-side auto-cancel sweep. Returns the number of orders that
 * were cancelled in this invocation.
 */
export async function autoCancelUnacceptedOrders(): Promise<number> {
  const { data, error } = await supabase.rpc(
    'auto_cancel_unaccepted_orders'
  );
  if (error) logAndThrow('autoCancelUnacceptedOrders', error);
  return typeof data === 'number' ? data : 0;
}
