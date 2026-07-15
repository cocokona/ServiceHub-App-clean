export type Role = 'select_role' | 'customer' | 'technician';

export type CustomerScreen =
  | 'home'
  | 'service_details'
  | 'schedule'
  | 'checkout'
  | 'tracking'
  | 'chat';

export type TechnicianScreen =
  | 'dashboard'
  | 'job_details'
  | 'active_service'
  | 'completion'
  | 'report_issue';

export interface Job {
  id: string;
  jobCode?: string;
  serviceType: string;
  serviceCategory: 'cleaning' | 'repair' | 'beauty' | 'electrical';
  customerName: string;
  customerPhone: string;
  customerAvatar: string;
  address: string;
  apartment: string;
  city: string;
  zipCode: string;
  date: string;
  timeSlot: 'morning' | 'afternoon' | 'evening';
  rooms: string;
  duration: number;
  focusAreas: string[];
  notes: string;
  status: 'pending' | 'confirmed' | 'on_the_way' | 'arrived' | 'in_progress' | 'completed' | 'reported' | 'rejected' | 'cancelled';
  baseRate: number;
  tax: number;
  travelFee: number;
  addOnsPrice: number;
  totalPrice: number;
  elapsedTime: number;
  checklist: { text: string; completed: boolean }[];
  technicianNotes?: string;
  materials?: { name: string; quantity: number }[];
  beforePhoto?: string | null;
  afterPhoto?: string | null;
  reportedIssueType?: string;
  reportedIssueDesc?: string;
  reportedIssueUrgent?: boolean;
  technicianName?: string;
  technicianAvatar?: string;
  technicianId?: string;
  completedAt?: string;
  /**
   * Most recent decline reason recorded by a technician who rejected this
   * order (e.g. 'too_far', 'no_free'). Surfaced to the customer on their own
   * pending order so they understand why it was declined. Null/undefined when
   * the order has not been rejected. The technician identity is never stored
   * here — only the reason — so the customer cannot see who declined.
   */
  rejectionReason?: string | null;
  rejectedAt?: string | null;
  /** Set when the order/job was auto-cancelled by the 30-min same-day SLA. */
  cancelledReason?: string;
  cancelledAt?: string;
  /**
   * IANA timezone captured from the device at booking time (e.g.
   * 'Asia/Shanghai'). Used so the "same-day" auto-cancel check matches the
   * clock the customer sees on their phone rather than UTC.
   */
  localTz?: string | null;
}

export interface Message {
  id: string;
  sender: 'customer' | 'technician' | 'support' | 'system';
  senderName: string;
  senderAvatar?: string;
  content: string;
  timestamp: string;
}

export interface Technician {
  id?: string;
  name: string;
  avatar: string;
  rating: number;
  reviewsCount: number;
  specialty: string;
  ratePerHour: number;
  /**
   * The technician's highest-rated written review (text). Surfaced in the
   * customer-facing recommended section alongside the average rating and
   * review count. Null/undefined when the technician has no written reviews.
   */
  topReview?: string | null;
  topReviewRating?: number | null;
}

/**
 * A customer review left for a technician after an order completes.
 * Persisted in the `reviews` table; the technician's aggregate rating and
 * review count are maintained server-side by a database trigger, so this
 * record is the single source of truth for a given job.
 */
export interface Review {
  id: string;
  jobId: string;
  customerId: string;
  technicianId: string;
  /** 1–5 star rating. */
  rating: number;
  comment: string | null;
  createdAt: string;
}

/**
 * A predefined reason a technician can pick when declining an order.
 * The list is data-driven (see src/data/files/rejection-reasons.json) so new
 * reasons can be added without code changes. `id` is what we persist on the
 * order; `label`/`description` are shown in the picker and to the customer.
 */
export interface RejectionReason {
  /** Stable key persisted on the order (e.g. 'too_far'). */
  id: string;
  /** Human-readable label shown in the picker and to the customer. */
  label: string;
  /** Optional helper text shown under the label in the picker. */
  description?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'customer' | 'technician';
  /** Public URL of the user's profile picture (profiles.avatar_url). */
  avatarUrl?: string;
  workCategory?: string;
  bio?: string;
  phone?: string;
  hourlyRate?: number;
  address?: string;
  apartment?: string;
  city?: string;
  zipCode?: string;
  rating?: number;
  reviewsCount?: number;
}

/**
 * Supported card brands. We derive this client-side from the card number's
 * IIN range; the value is what we persist (never the full PAN).
 */
export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'discover' | 'unknown';

/**
 * A customer's saved payment method. NOTE: this is a tokenized record — the
 * full card number (PAN) and CVV are intentionally NOT stored anywhere. Only
 * the brand, last 4 digits, expiry, cardholder name, and a payment token are
 * persisted, so the data is safe even in a private database.
 */
export interface SavedPaymentMethod {
  id: string;
  profileId: string;
  brand: CardBrand;
  last4: string;
  expMonth: number;
  expYear: number;
  cardholderName: string;
  token: string;
  isDefault: boolean;
  createdAt: string;
}

/**
 * Raw input collected from the card-entry form. `cardNumber` and `cvv` are
 * used ONLY for client-side validation and brand/expiry derivation; they are
 * never written to the database.
 */
export interface AddPaymentMethodInput {
  cardNumber: string;
  cardholderName: string;
  expiryMonth: number;
  expiryYear: number;
  cvv: string;
}
