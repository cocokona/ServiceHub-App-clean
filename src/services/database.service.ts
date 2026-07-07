import { supabase } from '../lib/supabase';
import type { Job, Technician } from '../types';

/**
 * Database Service — Centralized Data Access Layer
 *
 * Replaces the old dual-data-source pattern (Supabase direct queries +
 * phantom REST API at 192.168.1.100:3000). All data access now goes through
 * Supabase with RLS-protected queries.
 *
 * Each method includes typed responses and proper error handling.
 * The caller decides how to handle errors — no silent swallowing.
 */

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

  if (error) throw new Error(error.message);
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

  if (error) throw new Error(error.message);
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
      technician_name: job.technicianName,
      technician_avatar: job.technicianAvatar,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
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

  if (error) throw new Error(error.message);
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
    .is('deleted_at', null);

  if (category && category !== 'all') {
    query = query.or(
      `work_category.eq.${category},work_category.eq.all`
    );
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  return (data || []).map((t: any) => ({
    name: t.name,
    avatar: t.avatar_url || '',
    rating: t.rating || 0,
    reviewsCount: t.reviews_count || 0,
    specialty: t.work_category || 'all',
    ratePerHour: t.hourly_rate ? Number(t.hourly_rate) : 45,
  }));
}

// ---------------------------------------------------------------------------
// Order In Progress
// ---------------------------------------------------------------------------

/**
 * Create a new order in the order_in_progress table.
 * Returns the created order mapped to the app's Job type.
 */
export async function createOrderInProgress(
  order: Partial<Job> & {
    customerId: string;
    serviceType: string;
    serviceCategory: string;
  }
): Promise<Job | null> {
  const { data, error } = await supabase
    .from('order_in_progress')
    .insert({
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
      technician_name: order.technicianName,
      technician_avatar: order.technicianAvatar,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data ? mapDbOrderToAppJob(data) : null;
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

  if (error) throw new Error(error.message);
  return (data || []).map(mapDbOrderToAppJob);
}

/**
 * Fetch all pending orders in progress visible to technicians.
 * Optionally filter by service category.
 */
export async function fetchAllOrdersInProgress(category?: string): Promise<Job[]> {
  let query = supabase
    .from('order_in_progress')
    .select('*')
    .order('created_at', { ascending: false });

  if (category && category !== 'all') {
    query = query.eq('service_category', category);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return (data || []).map(mapDbOrderToAppJob);
}

/**
 * Technician accepts an order_in_progress.
 * Calls the DB function which moves the row to jobs and deletes from order_in_progress.
 * Returns the new job ID.
 */
export async function acceptOrderInProgress(
  orderId: string,
  technicianId: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc('accept_order_in_progress', {
    p_order_id: orderId,
    p_technician_id: technicianId,
  });

  if (error) throw new Error(error.message);
  return data as string | null;
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
    status: 'pending',
    baseRate: Number(row.base_rate) || 0,
    tax: Number(row.tax) || 0,
    travelFee: Number(row.travel_fee) || 0,
    addOnsPrice: Number(row.add_ons_price) || 0,
    totalPrice: Number(row.total_price) || 0,
    elapsedTime: 0,
    checklist: [],
    technicianName: row.technician_name,
    technicianAvatar: row.technician_avatar,
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

  if (error) throw new Error(error.message);
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

  if (error) throw new Error(error.message);
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

  if (error) throw new Error(error.message);

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

  if (error) throw new Error(error.message);
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
      return DEFAULT_SERVICE_CATEGORIES;
    }

    // Deduplicate categories and map to the known metadata
    const distinctKeys = [...new Set(data.map((s) => s.category))];
    const known = DEFAULT_SERVICE_CATEGORIES.filter((c) =>
      distinctKeys.includes(c.key)
    );

    return known.length > 0 ? known : DEFAULT_SERVICE_CATEGORIES;
  } catch {
    return DEFAULT_SERVICE_CATEGORIES;
  }
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export async function createReview(
  jobId: string,
  customerId: string,
  technicianId: string,
  rating: number,
  comment?: string
): Promise<void> {
  const { error } = await supabase.from('reviews').insert({
    job_id: jobId,
    customer_id: customerId,
    technician_id: technicianId,
    rating,
    comment,
  });

  if (error) throw new Error(error.message);
  // The trg_reviews_update_rating trigger auto-updates the technician's
  // aggregate rating and review count — no manual sync needed.
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
    checklist: (row.job_checklists || []).map((c: any) => ({
      text: c.text,
      completed: c.completed,
    })),
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
  };
}
