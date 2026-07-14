// Shared domain types for the ServiceHub Admin Dashboard.
// These mirror the app's Supabase schema (see supabase/migrations/*).

export type JobStatus =
  | 'new' // a fresh order sitting in order_in_progress (no status column there)
  | 'pending'
  | 'confirmed'
  | 'on_the_way'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'reported'
  | 'cancelled';

export interface BadgeMeta {
  label: string;
  tone: 'success' | 'warning' | 'error' | 'info' | 'neutral';
}

// Single source of truth for status presentation — keeps the UI in sync with
// the data the backend actually returns.
export const STATUS_META: Record<JobStatus, BadgeMeta> = {
  new: { label: 'New', tone: 'info' },
  pending: { label: 'Pending', tone: 'warning' },
  confirmed: { label: 'Confirmed', tone: 'info' },
  on_the_way: { label: 'On the Way', tone: 'info' },
  arrived: { label: 'Arrived', tone: 'info' },
  in_progress: { label: 'In Progress', tone: 'info' },
  completed: { label: 'Completed', tone: 'success' },
  reported: { label: 'Reported', tone: 'error' },
  cancelled: { label: 'Cancelled', tone: 'error' },
};

export interface DashboardOrder {
  id: string;
  code: string; // job_code e.g. #SH-6047
  customer: string;
  service: string;
  category: string;
  technician: string; // 'Unassigned' when none
  status: JobStatus;
  amount: number; // total_price
  date: string; // ISO created_at
  location: string;
  source: 'jobs' | 'order_in_progress';
}

export interface TechnicianStat {
  id: string;
  name: string;
  avatar?: string;
  rating: number;
  reviewsCount: number;
  category: string;
  online: boolean;
  completion: number; // 0..100
  jobsTotal: number;
  jobsCompleted: number;
}

export interface TrendPoint {
  label: string;
  value: number;
}

export interface RevenuePoint {
  labels: string[];
  completed: number[]; // completed-job revenue per month ($)
  fresh: number[]; // new-order value per month ($)
}

export interface DashboardStats {
  totalOrders: number;
  revenue: number;
  customers: number;
  avgRating: number;
  ordersDeltaPct: number | null;
  revenueDeltaPct: number | null;
  customersDeltaPct: number | null;
  ratingDeltaPct: number | null;
}

export interface ActivitySegment {
  label: string;
  value: number; // percentage 0..100
  color: string; // tailwind text-* class
}

export interface Conversation {
  jobId: string;
  code: string;
  customerName: string;
  technicianName: string | null;
  lastMessage: string;
  lastTime: string; // ISO
  unread: number;
  online: boolean;
}

export interface ChatMessage {
  id: string;
  /** Set for job-tied messages; null for support-thread messages. */
  jobId: string | null;
  /** Set for support-thread messages; null for job-tied messages. */
  threadId: string | null;
  from: 'me' | 'them';
  senderName: string;
  role: string;
  text: string;
  time: string; // ISO
}

/** A general customer-service conversation opened from the app's profile page.
 *  Not tied to a job; surfaced in the admin console's "Support" tab. */
export interface SupportThread {
  id: string;
  userName: string;
  userRole: 'customer' | 'technician';
  subject: string | null;
  status: string;
  lastMessage: string;
  lastTime: string; // ISO
}

export interface OwnProfile {
  name: string;
  email: string;
  phone: string | null;
  role: string;
  city: string | null;
  avatarUrl: string | null;
}
