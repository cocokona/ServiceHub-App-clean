// Real data access layer for the ServiceHub Admin Dashboard.
//
// Every function queries the SAME Supabase project the mobile app uses, through
// the RLS-protected anon client (see lib/supabase.ts). No mock data. Results
// depend on the logged-in user's RLS scope:
//   - technician accounts can browse all new orders + profiles + services
//   - admin accounts (profiles.is_admin = true, see migration 00015) can read
//     all jobs, messages, and payments platform-wide.

import { supabase } from '../lib/supabase';
import type {
  ActivitySegment,
  ChatMessage,
  Conversation,
  DashboardOrder,
  DashboardStats,
  JobStatus,
  OwnProfile,
  RevenuePoint,
  SupportThread,
  TechnicianStat,
  TrendPoint,
} from './types';

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

const DAY = 86_400_000;

function isoDaysAgo(n: number): string {
  return new Date(Date.now() - n * DAY).toISOString();
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Percentage change from prev -> curr. Returns null when prev is 0 (undefined). */
function pctDelta(prev: number, curr: number): number | null {
  if (prev <= 0) return null;
  return round1(((curr - prev) / prev) * 100);
}

/** Exact row count with optional filters. Used for KPI totals + weekly deltas. */
async function countExact(table: string, apply: (q: any) => any): Promise<number> {
  let q = supabase.from(table).select('*', { count: 'exact', head: true });
  q = apply(q);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

/** Select rows with optional builder + limit. Throws on error. */
async function select<T = any>(
  table: string,
  columns: string,
  apply?: (q: any) => any,
  limit = 2000
): Promise<T[]> {
  let q = supabase.from(table).select(columns);
  if (apply) q = apply(q);
  if (limit) q = q.limit(limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data as T[]) ?? [];
}

// ---------------------------------------------------------------------------
// Dashboard KPIs
// ---------------------------------------------------------------------------

export async function getDashboardStats(): Promise<DashboardStats> {
  const thisWeekStart = isoDaysAgo(7);
  const lastWeekStart = isoDaysAgo(14);

  // Order counts (new orders + accepted jobs)
  const [oipThisWeek, oipLastWeek, jobsThisWeek, jobsLastWeek, oipTotal, jobsTotal] =
    await Promise.all([
      countExact('order_in_progress', (q) => q.gte('created_at', thisWeekStart)),
      countExact('order_in_progress', (q) =>
        q.gte('created_at', lastWeekStart).lt('created_at', thisWeekStart)
      ),
      countExact('jobs', (q) => q.is('deleted_at', null).gte('created_at', thisWeekStart)),
      countExact('jobs', (q) =>
        q.is('deleted_at', null).gte('created_at', lastWeekStart).lt('created_at', thisWeekStart)
      ),
      countExact('order_in_progress', (q) => q),
      countExact('jobs', (q) => q.is('deleted_at', null)),
    ]);

  const ordersThisWeek = oipThisWeek + jobsThisWeek;
  const ordersLastWeek = oipLastWeek + jobsLastWeek;

  // Revenue from completed jobs in the last 14 days (total + weekly deltas)
  const revRows = await select<{ total_price: number; status: string; created_at: string }>(
    'jobs',
    'total_price, status, created_at',
    (q) => q.is('deleted_at', null).gte('created_at', lastWeekStart)
  );
  let revenue = 0;
  let revThisWeek = 0;
  let revLastWeek = 0;
  for (const r of revRows) {
    const amt = Number(r.total_price) || 0;
    if (r.status === 'completed') {
      revenue += amt;
      if (r.created_at >= thisWeekStart) revThisWeek += amt;
      else if (r.created_at >= lastWeekStart) revLastWeek += amt;
    }
  }

  // Customers (total + weekly deltas)
  const [custTotal, custThisWeek, custLastWeek] = await Promise.all([
    countExact('profiles', (q) => q.eq('role', 'customer').is('deleted_at', null)),
    countExact('profiles', (q) =>
      q.eq('role', 'customer').is('deleted_at', null).gte('created_at', thisWeekStart)
    ),
    countExact('profiles', (q) =>
      q.eq('role', 'customer').is('deleted_at', null).gte('created_at', lastWeekStart).lt('created_at', thisWeekStart)
    ),
  ]);

  // Average technician rating (from live profile ratings)
  const techRows = await select<{ rating: number }>(
    'profiles',
    'rating',
    (q) => q.eq('role', 'technician').is('deleted_at', null)
  );
  const ratings = techRows.map((t) => Number(t.rating) || 0).filter((r) => r > 0);
  const avgRating = ratings.length ? round1(ratings.reduce((a, b) => a + b, 0) / ratings.length) : 0;

  return {
    totalOrders: oipTotal + jobsTotal,
    revenue,
    customers: custTotal,
    avgRating,
    ordersDeltaPct: pctDelta(ordersLastWeek, ordersThisWeek),
    revenueDeltaPct: pctDelta(revLastWeek, revThisWeek),
    customersDeltaPct: pctDelta(custLastWeek, custThisWeek),
    ratingDeltaPct: null, // historical rating trend not tracked per-week
  };
}

// ---------------------------------------------------------------------------
// Orders (union of order_in_progress + jobs)
// ---------------------------------------------------------------------------

export async function getOrders(): Promise<DashboardOrder[]> {
  const [oip, jobs] = await Promise.all([
    select<any>('order_in_progress', '*'),
    select<any>('jobs', '*', (q) => q.is('deleted_at', null)),
  ]);

  const map = (r: any, source: 'order_in_progress' | 'jobs'): DashboardOrder => ({
    id: r.id,
    code: r.job_code || `#${String(r.id).slice(0, 8)}`,
    customer: r.customer_name || 'Unknown',
    service: r.service_type || '—',
    category: r.service_category || '',
    technician: r.technician_name || 'Unassigned',
    status: (source === 'order_in_progress' ? 'new' : (r.status as JobStatus) || 'pending'),
    amount: Number(r.total_price) || 0,
    date: r.created_at,
    location: [r.city, r.zip_code].filter(Boolean).join(' '),
    source,
  });

  const all = [
    ...oip.map((r) => map(r, 'order_in_progress')),
    ...jobs.map((r) => map(r, 'jobs')),
  ];
  all.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return all;
}

// ---------------------------------------------------------------------------
// Trends + revenue
// ---------------------------------------------------------------------------

export async function getOrderTrend(days = 14): Promise<TrendPoint[]> {
  const since = isoDaysAgo(days);
  const [oip, jobs] = await Promise.all([
    select<{ created_at: string }>('order_in_progress', 'created_at', (q) => q.gte('created_at', since)),
    select<{ created_at: string }>('jobs', 'created_at', (q) => q.is('deleted_at', null).gte('created_at', since)),
  ]);

  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const key = startOfDay(new Date(Date.now() - i * DAY)).toISOString().slice(0, 10);
    buckets.set(key, 0);
  }
  const add = (iso: string) => {
    const key = iso.slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + 1);
  };
  oip.forEach((r) => add(r.created_at));
  jobs.forEach((r) => add(r.created_at));

  return [...buckets.entries()].map(([date, value]) => ({
    label: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value,
  }));
}

export async function getRevenueByMonth(months = 6): Promise<RevenuePoint> {
  const since = new Date();
  since.setMonth(since.getMonth() - (months - 1), 1);
  since.setHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();

  const [jobs, oip] = await Promise.all([
    select<any>(
      'jobs',
      'total_price, status, created_at',
      (q) => q.is('deleted_at', null).gte('created_at', sinceIso)
    ),
    select<any>('order_in_progress', 'total_price, created_at', (q) => q.gte('created_at', sinceIso)),
  ]);

  const labels: string[] = [];
  const map = new Map<string, { c: number; f: number }>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    map.set(key, { c: 0, f: 0 });
    labels.push(d.toLocaleDateString('en-US', { month: 'short' }));
  }
  const bucket = (iso: string) => map.get(`${new Date(iso).getFullYear()}-${new Date(iso).getMonth()}`);
  jobs.forEach((r) => {
    const b = bucket(r.created_at);
    if (b && r.status === 'completed') b.c += Number(r.total_price) || 0;
  });
  oip.forEach((r) => {
    const b = bucket(r.created_at);
    if (b) b.f += Number(r.total_price) || 0;
  });

  const completed: number[] = [];
  const fresh: number[] = [];
  map.forEach((v) => {
    completed.push(Math.round(v.c));
    fresh.push(Math.round(v.f));
  });
  return { labels, completed, fresh };
}

// ---------------------------------------------------------------------------
// Technicians
// ---------------------------------------------------------------------------

export async function getTechnicians(): Promise<TechnicianStat[]> {
  const techs = await select<any>(
    'profiles',
    'id, name, avatar_url, rating, reviews_count, work_category, is_online',
    (q) => q.eq('role', 'technician').eq('is_active', true).is('deleted_at', null)
  );
  if (!techs.length) return [];

  const ids = techs.map((t) => t.id);
  const jobs = await select<any>(
    'jobs',
    'technician_id, status',
    (q) => q.is('deleted_at', null).in('technician_id', ids)
  );
  const stats = new Map<string, { total: number; done: number }>();
  ids.forEach((id) => stats.set(id, { total: 0, done: 0 }));
  jobs.forEach((j) => {
    const s = stats.get(j.technician_id);
    if (s) {
      s.total += 1;
      if (j.status === 'completed') s.done += 1;
    }
  });

  return techs
    .map((t) => {
      const s = stats.get(t.id) || { total: 0, done: 0 };
      return {
        id: t.id,
        name: t.name,
        avatar: t.avatar_url || undefined,
        rating: Number(t.rating) || 0,
        reviewsCount: Number(t.reviews_count) || 0,
        category: t.work_category || 'all',
        online: !!t.is_online,
        completion: s.total ? Math.round((s.done / s.total) * 100) : 0,
        jobsTotal: s.total,
        jobsCompleted: s.done,
      };
    })
    .sort((a, b) => b.completion - a.completion || b.rating - a.rating);
}

// ---------------------------------------------------------------------------
// Customer activity (donut): active / idle / churned
// ---------------------------------------------------------------------------

export async function getCustomerActivity(): Promise<ActivitySegment[]> {
  const customers = await select<{ id: string; created_at: string }>(
    'profiles',
    'id, created_at',
    (q) => q.eq('role', 'customer').is('deleted_at', null)
  );
  if (!customers.length) return [];

  const [oip, jobs] = await Promise.all([
    select<{ customer_id: string; created_at: string }>('order_in_progress', 'customer_id, created_at'),
    select<{ customer_id: string; created_at: string }>(
      'jobs',
      'customer_id, created_at',
      (q) => q.is('deleted_at', null)
    ),
  ]);

  const lastOrder = new Map<string, number>();
  const touch = (cid: string, iso: string) => {
    const t = new Date(iso).getTime();
    if (!lastOrder.has(cid) || (lastOrder.get(cid) as number) < t) lastOrder.set(cid, t);
  };
  oip.forEach((r) => r.customer_id && touch(r.customer_id, r.created_at));
  jobs.forEach((r) => r.customer_id && touch(r.customer_id, r.created_at));

  const now = Date.now();
  let active = 0;
  let idle = 0;
  let churned = 0;
  customers.forEach((c) => {
    const t = lastOrder.get(c.id);
    if (t === undefined) churned += 1;
    else if (now - t <= 30 * DAY) active += 1;
    else if (now - t <= 90 * DAY) idle += 1;
    else churned += 1;
  });

  const total = customers.length;
  const seg = (label: string, count: number, color: string): ActivitySegment => ({
    label,
    value: Math.round((count / total) * 100),
    color,
  });
  const segs = [
    seg('Active', active, 'text-primary-container'),
    seg('Idle', idle, 'text-tertiary'),
    seg('Churned', churned, 'text-error'),
  ];
  // Reconcile rounding to exactly 100%.
  const sum = segs.reduce((a, s) => a + s.value, 0);
  if (sum !== 100 && segs.length) segs[0].value += 100 - sum;
  return segs;
}

// ---------------------------------------------------------------------------
// Services catalog
// ---------------------------------------------------------------------------

export async function getServices(): Promise<{ name: string; category: string; baseRate: number }[]> {
  return select<any>('services', 'name, category, base_rate', (q) => q.eq('is_active', true));
}

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------

function mapMessage(r: any): ChatMessage {
  return {
    id: r.id,
    jobId: r.job_id,
    threadId: null,
    from: r.sender_role === 'support' ? 'me' : 'them',
    senderName: r.sender_name || (r.sender_role === 'support' ? 'Support' : 'User'),
    role: r.sender_role,
    text: r.content,
    time: r.created_at,
  };
}

function mapSupportMessage(r: any): ChatMessage {
  return {
    id: r.id,
    jobId: null,
    threadId: r.support_thread_id,
    from: r.sender_role === 'support' ? 'me' : 'them',
    senderName: r.sender_name || (r.sender_role === 'support' ? 'Support' : 'User'),
    role: r.sender_role,
    text: r.content,
    time: r.created_at,
  };
}

export async function getConversations(): Promise<Conversation[]> {
  const [messages, jobs, techs] = await Promise.all([
    select<any>(
      'messages',
      'job_id, content, created_at, sender_name, sender_role',
      (q) => q.order('created_at', { ascending: false }),
      300
    ),
    select<any>(
      'jobs',
      'id, job_code, customer_name, technician_name, technician_id',
      (q) => q.is('deleted_at', null),
      2000
    ),
    select<{ id: string; is_online: boolean }>(
      'profiles',
      'id, is_online',
      (q) => q.eq('role', 'technician').is('deleted_at', null)
    ),
  ]);

  const jobMap = new Map<string, any>();
  jobs.forEach((j) => jobMap.set(j.id, j));
  const techOnline = new Map<string, boolean>();
  techs.forEach((t) => techOnline.set(t.id, !!t.is_online));

  const latest = new Map<string, any>();
  for (const m of messages) {
    if (m.job_id && !latest.has(m.job_id)) latest.set(m.job_id, m);
  }

  const convos: Conversation[] = [];
  latest.forEach((m, jobId) => {
    const j = jobMap.get(jobId);
    if (!j) return;
    convos.push({
      jobId,
      code: j.job_code || '',
      customerName: j.customer_name || 'Customer',
      technicianName: j.technician_name || null,
      lastMessage: m.content || '',
      lastTime: m.created_at,
      unread: 0,
      online: j.technician_id ? (techOnline.get(j.technician_id) ?? false) : false,
    });
  });
  convos.sort((a, b) => (b.lastTime || '').localeCompare(a.lastTime || ''));
  return convos;
}

export async function getMessages(jobId: string): Promise<ChatMessage[]> {
  const rows = await select<any>(
    'messages',
    'id, job_id, sender_id, sender_role, sender_name, content, created_at',
    (q) => q.eq('job_id', jobId).order('created_at', { ascending: true }),
    500
  );
  return rows.map(mapMessage);
}

export function subscribeMessages(jobId: string, onMessage: (m: ChatMessage) => void): () => void {
  const channel = supabase
    .channel(`admin-msgs-${jobId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `job_id=eq.${jobId}` },
      (payload: any) => onMessage(mapMessage(payload.new))
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export async function sendMessage(
  jobId: string,
  senderId: string,
  senderName: string,
  content: string
): Promise<void> {
  const { error } = await supabase.from('messages').insert({
    job_id: jobId,
    sender_id: senderId,
    sender_role: 'support',
    sender_name: senderName,
    content,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Support threads (general customer-service conversations, not tied to a job)
// ---------------------------------------------------------------------------

/**
 * List every support thread (most recently active first). `user_id` is joined
 * to `profiles` to resolve the display name + role. Messages with a non-null
 * `support_thread_id` provide the last-message preview. Admin-only via RLS.
 */
export async function getSupportThreads(): Promise<SupportThread[]> {
  const [threads, msgs, profiles] = await Promise.all([
    select<any>(
      'support_threads',
      'id, user_id, user_role, subject, status, created_at, updated_at',
      (q) => q.order('updated_at', { ascending: false }),
      500
    ),
    select<any>(
      'messages',
      'support_thread_id, content, created_at',
      (q) => q.not('support_thread_id', 'is', null).order('created_at', { ascending: false }),
      500
    ),
    select<any>('profiles', 'id, name, role', (q) => q.is('deleted_at', null)),
  ]);

  const profileMap = new Map<string, any>();
  profiles.forEach((p: any) => profileMap.set(p.id, p));

  const last = new Map<string, any>();
  for (const m of msgs) {
    if (m.support_thread_id && !last.has(m.support_thread_id)) {
      last.set(m.support_thread_id, m);
    }
  }

  return threads
    .map((t: any) => {
      const p = profileMap.get(t.user_id);
      const m = last.get(t.id);
      return {
        id: t.id,
        userName: p?.name || 'User',
        userRole: p?.role === 'technician' ? 'technician' : 'customer',
        subject: t.subject || null,
        status: t.status || 'open',
        lastMessage: m?.content || 'No messages yet',
        lastTime: m?.created_at || t.updated_at,
      } as SupportThread;
    })
    .sort((a: SupportThread, b: SupportThread) =>
      (b.lastTime || '').localeCompare(a.lastTime || '')
    );
}

export async function getSupportMessages(threadId: string): Promise<ChatMessage[]> {
  const rows = await select<any>(
    'messages',
    'id, support_thread_id, sender_id, sender_role, sender_name, content, created_at',
    (q) => q.eq('support_thread_id', threadId).order('created_at', { ascending: true }),
    500
  );
  return rows.map(mapSupportMessage);
}

export function subscribeSupportMessages(
  threadId: string,
  onMessage: (m: ChatMessage) => void
): () => void {
  const channel = supabase
    .channel(`admin-support-msgs-${threadId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `support_thread_id=eq.${threadId}` },
      (payload: any) => onMessage(mapSupportMessage(payload.new))
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export async function sendSupportMessage(
  threadId: string,
  senderId: string,
  senderName: string,
  content: string
): Promise<void> {
  const { error } = await supabase.from('messages').insert({
    support_thread_id: threadId,
    sender_id: senderId,
    sender_role: 'support',
    sender_name: senderName,
    content,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Admin's own profile (Settings page)
// ---------------------------------------------------------------------------

export async function getOwnProfile(): Promise<OwnProfile> {
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) throw new Error('Not authenticated');
  const { data } = await supabase
    .from('profiles')
    .select('name, phone, role, city, avatar_url')
    .eq('id', user.id)
    .maybeSingle();
  return {
    name: data?.name || user.email || '',
    email: user.email || '',
    phone: data?.phone ?? null,
    role: data?.role || 'customer',
    city: data?.city ?? null,
    avatarUrl: data?.avatar_url ?? null,
  };
}

export async function updateOwnProfile(patch: {
  name?: string;
  phone?: string;
  city?: string;
}): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
  if (error) throw error;
}
