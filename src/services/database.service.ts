import { supabase } from '../lib/supabase';
import type { Job, Technician } from '../types';
import { logger } from './logger';
import { logAndThrow, isForeignKeyViolation, isSchemaCacheMiss } from './errors';
import { getDeviceTimeZone } from './autoCancel';

/**
 * Database Service — Centralized Data Access Layer
 *
 * Replaces the old dual-data-source pattern (Supabase direct queries +
 * phantom REST API at 192.168.1.100:3000). All data access goes through
 * Supabase with RLS-protected queries.
 *
 * Reliability notes (refactor):
 * - Every failure is routed through `logAndThrow`, which preserves the exact
 *   thrown `Error` message contract while adding structured, traceable logs.
 * - `createOrderInProgress` is now a single atomic INSERT. The
 *   `order_in_progress.customer_id` FK to `profiles` enforces referential
 *   integrity at the database level; a missing profile surfaces a friendly
 *   message (SQLSTATE 23503) instead of us doing a separate read-then-write
 *   round trip that could race.
 */

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

/**
 * Ensure a `profiles` row exists for the current authenticated user.
 *
 * Why this exists: `order_in_progress`, `jobs`, and `messages` all have a
 * foreign key to `profiles(id)`. If a user authenticates but their profile row
 * is missing (account predates the signup trigger, profile was soft-deleted,
 * or a signup race), any write fails with a 23503 FK violation — which is the
 * "Your profile was not found" error surfaced at checkout.
 *
 * This recovers gracefully by creating the profile from the auth user's
 * metadata. It is idempotent (SELECT first, INSERT only if absent) and cheap,
 * so it is safe to call on every session and before any profile-dependent
 * write. The RLS policy `profiles_insert_self` (id = auth.uid()) permits the
 * authenticated user to insert their own row.
 *
 * @returns true if a profile exists (or was just created), false if there is
 *          no active session to anchor it to.
 */
export async function ensureProfile(): Promise<boolean> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) return false;

  const userId = session.user.id;

  // Fast path: profile already present.
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (existing) return true;

  // Recover: create the missing profile from auth metadata.
  const meta = session.user.user_metadata || {};
  const email = session.user.email ?? '';
  const { error } = await supabase.from('profiles').insert({
    id: userId,
    email,
    name: (typeof meta.name === 'string' && meta.name) || email.split('@')[0] || 'User',
    role: meta.role === 'technician' ? 'technician' : 'customer',
    work_category: meta.work_category ?? null,
  });

  if (error) {
    // A concurrent insert (race) or policy issue — log but don't crash the
    // calling flow; the downstream write will surface a clear error if it
    // still can't proceed.
    logger.warn('[ensureProfile] failed to create missing profile', {
      code: (error as any)?.code,
      message: error.message,
    });
    return false;
  }

  logger.info('[ensureProfile] created missing profile for user', { userId });
  return true;
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export async function fetchJobsByCustomer(customerId: string): Promise<Job[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select(
      `
      *,
      job_checklists(*),
      job_materials(*)
    `
    )
    .eq('customer_id', customerId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) logAndThrow('fetchJobsByCustomer', error);
  return (data || []).map(mapDbJobToAppJob);
}

export async function fetchJobsByTechnician(
  technicianId: string
): Promise<Job[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select(
      `
      *,
      job_checklists(*),
      job_materials(*)
    `
    )
    .eq('technician_id', technicianId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) logAndThrow('fetchJobsByTechnician', error);
  return (data || []).map(mapDbJobToAppJob);
}

export async function createJob(
  job: Partial<Job> & {
    customerId: string;
    serviceType: string;
    serviceCategory: string;
  }
): Promise<Job | null> {
  const { data, error } = await supabase
    .from('jobs')
    .insert({
      customer_id: job.customerId,
      service_type: job.serviceType,
      service_category: job.serviceCategory,
      customer_name: job.customerName,
      customer_phone: job.customerPhone,
      customer_avatar: job.customerAvatar,
      address: job.address,
      apartment: job.apartment,
      city: job.city,
      zip_code: job.zipCode,
      scheduled_date: job.date,
      time_slot: job.timeSlot,
      rooms: job.rooms,
      duration: job.duration,
      focus_areas: job.focusAreas || [],
      notes: job.notes,
      status: 'pending',
      base_rate: job.baseRate || 0,
      tax: job.tax || 0,
      travel_fee: job.travelFee || 0,
      add_ons_price: job.addOnsPrice || 0,
      total_price: job.totalPrice || 0,
      technician_id: job.technicianId || null,
      technician_name: job.technicianName,
      technician_avatar: job.technicianAvatar,
    })
    .select('*')
    .single();

  if (error) logAndThrow('createJob', error);
  return data ? mapDbJobToAppJob(data) : null;
}

export async function updateJobStatus(
  jobId: string,
  updates: Partial<Job>
): Promise<void> {
  const dbUpdates: Record<string, any> = {};

  if (updates.status) dbUpdates.status = updates.status;
  if (updates.elapsedTime !== undefined)
    dbUpdates.elapsed_time = updates.elapsedTime;
  if (updates.technicianNotes !== undefined)
    dbUpdates.technician_notes = updates.technicianNotes;
  if (updates.beforePhoto !== undefined)
    dbUpdates.before_photo = updates.beforePhoto;
  if (updates.afterPhoto !== undefined)
    dbUpdates.after_photo = updates.afterPhoto;
  if (updates.reportedIssueType !== undefined)
    dbUpdates.reported_issue_type = updates.reportedIssueType;
  if (updates.reportedIssueDesc !== undefined)
    dbUpdates.reported_issue_desc = updates.reportedIssueDesc;
  if (updates.reportedIssueUrgent !== undefined)
    dbUpdates.reported_issue_urgent = updates.reportedIssueUrgent;
  if (updates.completedAt) dbUpdates.completed_at = updates.completedAt;

  const { error } = await supabase
    .from('jobs')
    .update(dbUpdates)
    .eq('id', jobId);

  if (error) logAndThrow('updateJobStatus', error);
}

// ---------------------------------------------------------------------------
// Technicians
// ---------------------------------------------------------------------------

export async function fetchTechnicians(
  category?: string
): Promise<Technician[]> {
  let query = supabase
    .from('profiles')
    .select('id, name, avatar_url, rating, reviews_count, work_category, hourly_rate, bio')
    .eq('role', 'technician')
    .eq('is_active', true)
    .is('deleted_at', null);

  if (category && category !== 'all') {
    // Filter by work_category matching the category OR 'all' (universal technicians)
    query = query.or(
      `work_category.eq.${category},work_category.eq.all`
    );
  }

  const { data, error } = await query;

  if (error) logAndThrow('fetchTechnicians', error);

  return (data || []).map((t: any) => ({
    id: t.id,
    name: t.name,
    avatar: t.avatar_url || '',
    rating: t.rating || 0,
    reviewsCount: t.reviews_count || 0,
    specialty: t.work_category || 'all',
    ratePerHour: t.hourly_rate ? Number(t.hourly_rate) : 45,
  }));
}

/**
 * Fetch a single technician's public profile (used by the order-tracking card
 * to show the technician's LIVE average rating and review count rather than a
 * hardcoded default). Returns null when the id is missing or the lookup fails.
 */
export async function fetchTechnicianById(
  technicianId: string
): Promise<Technician | null> {
  if (!technicianId) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, avatar_url, rating, reviews_count, work_category, hourly_rate')
    .eq('id', technicianId)
    .maybeSingle();

  if (error) {
    logger.warn('[fetchTechnicianById] lookup failed', {
      code: (error as any)?.code,
      message: error.message,
    });
    return null;
  }
  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    avatar: data.avatar_url || '',
    rating: data.rating || 0,
    reviewsCount: data.reviews_count || 0,
    specialty: data.work_category || 'all',
    ratePerHour: data.hourly_rate ? Number(data.hourly_rate) : 45,
  };
}

// ---------------------------------------------------------------------------
// Order In Progress
// ---------------------------------------------------------------------------

/**
 * Create a new order in the order_in_progress table.
 *
 * Atomic by construction: a single INSERT. The `customer_id` foreign key to
 * `profiles` guarantees referential integrity — if the customer profile does
 * not exist, Postgres rejects the insert with SQLSTATE 23503 and we translate
 * that into the same friendly message the old read-then-write flow produced.
 * This removes a redundant round trip and the race window it introduced.
 *
 * Returns the created order mapped to the app's Job type.
 */
export async function createOrderInProgress(
  order: Partial<Job> & {
    customerId: string;
    serviceType: string;
    serviceCategory: string;
  }
): Promise<Job | null> {
  // Build the insert payload. `local_tz` is captured-at-booking metadata used
  // by the device-timezone-aware auto-cancel rule; it is the newest column and
  // the one most likely to be missing from a stale PostgREST schema cache.
  let payload: Record<string, unknown> = {
    customer_id: order.customerId,
    service_type: order.serviceType,
    service_category: order.serviceCategory,
    customer_name: order.customerName,
    customer_phone: order.customerPhone,
    customer_avatar: order.customerAvatar,
    address: order.address,
    apartment: order.apartment,
    city: order.city,
    zip_code: order.zipCode,
    scheduled_date: order.date,
    time_slot: order.timeSlot,
    rooms: order.rooms,
    duration: order.duration,
    focus_areas: order.focusAreas || [],
    notes: order.notes,
    base_rate: order.baseRate || 0,
    tax: order.tax || 0,
    travel_fee: order.travelFee || 0,
    add_ons_price: order.addOnsPrice || 0,
    total_price: order.totalPrice || 0,
    technician_id: order.technicianId || null,
    technician_name: order.technicianName,
    technician_avatar: order.technicianAvatar,
    local_tz: getDeviceTimeZone(),
  };

  let res = await supabase
    .from('order_in_progress')
    .insert(payload)
    .select('*')
    .single();

  // Stale PostgREST schema cache (PGRST204): the `local_tz` column exists in
  // Postgres but PostgREST hasn't introspected it yet. Drop that optional
  // column and retry once so Checkout never hard-fails on a cache that simply
  // needs a `NOTIFY pgrst, 'reload schema';`. Omitting it only degrades the
  // device-tz accuracy of the auto-cancel SLA — never the booking itself.
  if (res.error && isSchemaCacheMiss(res.error)) {
    const dropped = payload.local_tz;
    payload = { ...payload };
    delete payload.local_tz;
    logger.warn(
      '[db:createOrderInProgress] PostgREST schema cache missing `local_tz`; ' +
        'retrying without it. Run `NOTIFY pgrst, \'reload schema\';` to clear.',
      { droppedValue: dropped }
    );
    res = await supabase
      .from('order_in_progress')
      .insert(payload)
      .select('*')
      .single();
  }

  if (res.error) {
    // The customer profile is missing for this auth user (SQLSTATE 23503).
    // Recover by creating it, then retry the insert once. This turns the old
    // show-stopping "sign out and sign in again" error into a transparent
    // self-heal for accounts that predate the signup trigger.
    if (isForeignKeyViolation(res.error)) {
      const recovered = await ensureProfile();
      if (recovered) {
        const retry = await supabase
          .from('order_in_progress')
          .insert(payload)
          .select('*')
          .single();

        if (!retry.error && retry.data) return mapDbOrderToAppJob(retry.data);
      }
      throw new Error(
        'Your profile was not found. Please sign out and sign in again.'
      );
    }
    logAndThrow('createOrderInProgress', res.error);
  }

  return res.data ? mapDbOrderToAppJob(res.data) : null;
}

/**
 * Fetch all pending orders in progress for a customer.
 */
export async function fetchOrdersInProgress(customerId: string): Promise<Job[]> {
  const { data, error } = await supabase
    .from('order_in_progress')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) logAndThrow('fetchOrdersInProgress', error);
  return (data || []).map(mapDbOrderToAppJob);
}

/**
 * Fetch all pending orders in progress visible to technicians.
 * Optionally filter by service category.
 *
 * When `technicianId` is supplied, orders the technician has already rejected
 * (recorded in `order_rejections`) are excluded so a decline removes the order
 * from THAT technician's browse list — while it remains available to others.
 */
export async function fetchAllOrdersInProgress(
  category?: string,
  technicianId?: string
): Promise<Job[]> {
  let query = supabase
    .from('order_in_progress')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (category && category !== 'all') {
    query = query.eq('service_category', category);
  }

  // Exclude orders this technician has already declined. We resolve their
  // rejected order ids first (they can read their own rows via RLS), then drop
  // those ids from the browse query so the decline sticks in the UI.
  if (technicianId) {
    const { data: rejections, error: rejErr } = await supabase
      .from('order_rejections')
      .select('order_id')
      .eq('technician_id', technicianId);
    if (rejErr) logAndThrow('fetchAllOrdersInProgress', rejErr);

    const rejectedIds = (rejections || []).map((r: any) => r.order_id);
    if (rejectedIds.length > 0) {
      query = query.not('id', 'in', `(${rejectedIds.join(',')})`);
    }
  }

  const { data, error } = await query;

  if (error) logAndThrow('fetchAllOrdersInProgress', error);
  return (data || []).map(mapDbOrderToAppJob);
}

/**
 * Technician declines an order_in_progress with a predefined reason.
 * Calls the DB function, which records the rejection (per technician) and
 * surfaces the reason to the customer on their own order row. The order stays
 * in the pool for other technicians. Returns void on success.
 */
export async function rejectOrderInProgress(
  orderId: string,
  technicianId: string,
  reason: string
): Promise<void> {
  const { error } = await supabase.rpc('reject_order_in_progress', {
    p_order_id: orderId,
    p_technician_id: technicianId,
    p_reason: reason,
  });

  if (error) logAndThrow('rejectOrderInProgress', error);
}

/**
 * Customer-driven status change on an order_in_progress row. Used by the
 * rejection dialog: 'pending' re-opens the order to the technician pool
 * (request a different technician) and 'cancelled' cancels it for a refund.
 * Authorization is enforced server-side by the set_order_in_progress_status
 * RPC (only the order owner may call it). Returns void on success.
 */
export async function setOrderInProgressStatus(
  orderId: string,
  status: 'pending' | 'rejected' | 'cancelled'
): Promise<void> {
  const { error } = await supabase.rpc('set_order_in_progress_status', {
    p_order_id: orderId,
    p_status: status,
  });

  if (error) logAndThrow('setOrderInProgressStatus', error);
}

/**
 * Seed a full grid of CLOSED availability slots for a technician who has none
 * yet. Idempotent — safe to call on every Schedule open. Guarantees the
 * "all slots start closed by default" invariant at the data level.
 */
export async function seedTechnicianAvailability(
  technicianId: string
): Promise<void> {
  const { error } = await supabase.rpc('seed_technician_availability', {
    p_technician_id: technicianId,
  });

  if (error) logAndThrow('seedTechnicianAvailability', error);
}

/**
 * Fetch the most recent rejection reason recorded for a customer's pending
 * order. Customers read this from their OWN order row (RLS: customer_id =
 * auth.uid()); the technician identity is never returned. Returns null when
 * the order has not been declined. Used by the tracking screen to surface a
 * possibly-stale rejection reason even when the in-memory job snapshot lags.
 */
export async function fetchOrderRejectionReason(
  orderId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('order_in_progress')
    .select('last_rejection_reason')
    .eq('id', orderId)
    .maybeSingle();

  if (error) {
    logger.warn('[fetchOrderRejectionReason] lookup failed', {
      code: (error as any)?.code,
      message: error.message,
    });
    return null;
  }
  return data?.last_rejection_reason ?? null;
}

/**
 * Technician accepts an order_in_progress.
 * Calls the DB function which moves the row to jobs and deletes from
 * order_in_progress inside a single transaction (atomic). Returns the new job
 * ID.
 */
export async function acceptOrderInProgress(
  orderId: string,
  technicianId: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc('accept_order_in_progress', {
    p_order_id: orderId,
    p_technician_id: technicianId,
  });

  if (error) logAndThrow('acceptOrderInProgress', error);
  return data as string | null;
}

/**
 * Build the technician task checklist for a job.
 *
 * The checklist should surface the items the customer actually selected at
 * booking time — these are captured as `focus_areas` (the add-on services they
 * checked in the booking flow). When a job already has persisted checklist rows
 * (`job_checklists`), those take precedence because they may carry technician-
 * added tasks or completion state. This seeding is what makes the technician
 * "Task Checklist" render the customer's selections instead of rendering empty.
 */
function buildChecklistFromFocusAreas(
  focusAreas?: string[] | null,
  persistedChecklist?: { text: string; completed: boolean }[]
): { text: string; completed: boolean }[] {
  if (persistedChecklist && persistedChecklist.length > 0) {
    return persistedChecklist;
  }
  if (!focusAreas || !Array.isArray(focusAreas)) return [];
  return focusAreas
    .filter((f) => typeof f === 'string' && f.trim().length > 0)
    .map((f) => ({ text: f.trim(), completed: false }));
}

function mapDbOrderToAppJob(row: any): Job {
  return {
    id: row.id,
    jobCode: row.job_code || undefined,
    serviceType: row.service_type,
    serviceCategory: row.service_category,
    customerName: row.customer_name || '',
    customerPhone: row.customer_phone || '',
    customerAvatar: row.customer_avatar || '',
    address: row.address || '',
    apartment: row.apartment || '',
    city: row.city || '',
    zipCode: row.zip_code || '',
    date: row.scheduled_date || '',
    timeSlot: row.time_slot || 'morning',
    rooms: row.rooms || '',
    duration: row.duration || 2,
    focusAreas: row.focus_areas || [],
    notes: row.notes || '',
    // The order_in_progress table carries its own status column (added in
    // migration 00021). Previously this was hardcoded to 'pending', which is
    // exactly why a rejected order never showed as REJECTED on the customer's
    // orders page. Now we honor the real DB value.
    status: row.status || 'pending',
    baseRate: Number(row.base_rate) || 0,
    tax: Number(row.tax) || 0,
    travelFee: Number(row.travel_fee) || 0,
    addOnsPrice: Number(row.add_ons_price) || 0,
    totalPrice: Number(row.total_price) || 0,
    elapsedTime: 0,
    checklist: buildChecklistFromFocusAreas(row.focus_areas),
    technicianName: row.technician_name,
    technicianAvatar: row.technician_avatar,
    technicianId: row.technician_id,
    localTz: row.local_tz ?? null,
    rejectionReason: row.last_rejection_reason ?? null,
    rejectedAt: row.rejected_at ?? null,
    cancelledAt: row.cancelled_at ?? null,
  };
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export async function fetchMessages(jobId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });

  if (error) logAndThrow('fetchMessages', error);
  return data || [];
}

export async function sendMessage(
  jobId: string,
  senderId: string,
  senderRole: 'customer' | 'technician' | 'support',
  senderName: string,
  content: string,
  senderAvatar?: string
) {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      job_id: jobId,
      sender_id: senderId,
      sender_role: senderRole,
      sender_name: senderName,
      sender_avatar: senderAvatar,
      content,
    })
    .select('*')
    .single();

  if (error) logAndThrow('sendMessage', error);
  return data;
}

/**
 * Subscribe to real-time message updates for a job.
 * Returns an unsubscribe function.
 */
export function subscribeToMessages(
  jobId: string,
  onNewMessage: (message: any) => void
): () => void {
  const channel = supabase
    .channel(`messages:job_id=eq.${jobId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `job_id=eq.${jobId}`,
      },
      (payload) => onNewMessage(payload.new)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ---------------------------------------------------------------------------
// Technician Availability
// ---------------------------------------------------------------------------

export interface AvailabilitySlot {
  dayOfWeek: number;
  timeSlot: string;
  isAvailable: boolean;
}

/**
 * Fetch availability for a technician. Returns a map keyed by "dayOfWeek-timeSlot".
 */
export async function fetchTechnicianAvailability(
  technicianId: string
): Promise<Record<string, boolean>> {
  const { data, error } = await supabase
    .from('technician_availability')
    .select('day_of_week, time_slot, is_available')
    .eq('technician_id', technicianId);

  if (error) logAndThrow('fetchTechnicianAvailability', error);

  const map: Record<string, boolean> = {};
  (data || []).forEach((row: any) => {
    map[`${row.day_of_week}-${row.time_slot}`] = row.is_available;
  });
  return map;
}

/**
 * Upsert availability for a single slot.
 * If the row exists, update is_available. Otherwise, insert a new row.
 */
export async function setTechnicianAvailability(
  technicianId: string,
  dayOfWeek: number,
  timeSlot: string,
  isAvailable: boolean
): Promise<void> {
  const { error } = await supabase
    .from('technician_availability')
    .upsert(
      {
        technician_id: technicianId,
        day_of_week: dayOfWeek,
        time_slot: timeSlot,
        is_available: isAvailable,
      },
      { onConflict: 'technician_id,day_of_week,time_slot' }
    );

  if (error) logAndThrow('setTechnicianAvailability', error);
}

// ---------------------------------------------------------------------------
// Service Categories
// ---------------------------------------------------------------------------

/** Hardcoded fallback list — matches the services seed data */
const DEFAULT_SERVICE_CATEGORIES = [
  { key: 'cleaning', label: 'Cleaning', icon: 'sparkles' as const, color: '#dbeafe' },
  { key: 'repair', label: 'Repair', icon: 'construct' as const, color: '#fef3c7' },
  { key: 'electrical', label: 'Electrical', icon: 'flash' as const, color: '#dcfce7' },
  { key: 'beauty', label: 'Beauty', icon: 'flower' as const, color: '#fce7f3' },
];

export interface ServiceCategory {
  key: string;
  label: string;
  icon: 'sparkles' | 'construct' | 'flash' | 'flower';
  color: string;
}

/**
 * Fetch distinct active service categories from the database.
 * Falls back to the hardcoded default list if the query fails.
 */
export async function fetchServiceCategories(): Promise<ServiceCategory[]> {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('category')
      .eq('is_active', true);

    if (error || !data || data.length === 0) {
      if (error) {
        logger.warn('[fetchServiceCategories] query failed, using fallback', {
          code: (error as any).code,
        });
      }
      return DEFAULT_SERVICE_CATEGORIES;
    }

    // Deduplicate categories and map to the known metadata
    const distinctKeys = [...new Set(data.map((s) => s.category))];
    const known = DEFAULT_SERVICE_CATEGORIES.filter((c) =>
      distinctKeys.includes(c.key)
    );

    return known.length > 0 ? known : DEFAULT_SERVICE_CATEGORIES;
  } catch (err) {
    logger.warn('[fetchServiceCategories] unexpected error, using fallback', {
      error: err instanceof Error ? err.message : String(err),
    });
    return DEFAULT_SERVICE_CATEGORIES;
  }
}

// ---------------------------------------------------------------------------
// Technician Contact
// ---------------------------------------------------------------------------

/**
 * Fetch a technician's phone number by their profile id.
 *
 * The `profiles_select_authenticated` RLS policy allows any authenticated user
 * to read profiles (the marketplace needs technician data to be browseable),
 * so a customer can resolve the phone for the technician assigned to their
 * order. Returns null when the technician has no phone set or the lookup fails
 * — callers should treat null as "cannot call" and disable the dial action.
 */
export async function fetchTechnicianPhone(
  technicianId: string
): Promise<string | null> {
  if (!technicianId) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('phone')
    .eq('id', technicianId)
    .maybeSingle();

  if (error) {
    logger.warn('[fetchTechnicianPhone] lookup failed', {
      code: (error as any)?.code,
      message: error.message,
    });
    return null;
  }

  return data?.phone ?? null;
}

// ---------------------------------------------------------------------------
// Mappers (DB row -> App type)
// ---------------------------------------------------------------------------

function mapDbJobToAppJob(row: any): Job {
  return {
    id: row.id,
    jobCode: row.job_code || undefined,
    serviceType: row.service_type,
    serviceCategory: row.service_category,
    customerName: row.customer_name || '',
    customerPhone: row.customer_phone || '',
    customerAvatar: row.customer_avatar || '',
    address: row.address || '',
    apartment: row.apartment || '',
    city: row.city || '',
    zipCode: row.zip_code || '',
    date: row.scheduled_date || '',
    timeSlot: row.time_slot || 'morning',
    rooms: row.rooms || '',
    duration: row.duration || 2,
    focusAreas: row.focus_areas || [],
    notes: row.notes || '',
    status: row.status || 'pending',
    baseRate: Number(row.base_rate) || 0,
    tax: Number(row.tax) || 0,
    travelFee: Number(row.travel_fee) || 0,
    addOnsPrice: Number(row.add_ons_price) || 0,
    totalPrice: Number(row.total_price) || 0,
    elapsedTime: row.elapsed_time || 0,
    checklist: buildChecklistFromFocusAreas(
      row.focus_areas,
      (row.job_checklists || []).map((c: any) => ({
        text: c.text,
        completed: c.completed,
      }))
    ),
    materials: (row.job_materials || []).map((m: any) => ({
      name: m.name,
      quantity: m.quantity,
    })),
    technicianNotes: row.technician_notes,
    beforePhoto: row.before_photo,
    afterPhoto: row.after_photo,
    reportedIssueType: row.reported_issue_type,
    reportedIssueDesc: row.reported_issue_desc,
    reportedIssueUrgent: row.reported_issue_urgent,
    technicianName: row.technician_name,
    technicianAvatar: row.technician_avatar,
    technicianId: row.technician_id,
    cancelledReason: row.cancelled_reason,
    cancelledAt: row.cancelled_at,
  };
}
