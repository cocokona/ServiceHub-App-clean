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
  status: 'pending' | 'confirmed' | 'on_the_way' | 'arrived' | 'in_progress' | 'completed' | 'reported';
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
  completedAt?: string;
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
  name: string;
  avatar: string;
  rating: number;
  reviewsCount: number;
  specialty: string;
  ratePerHour: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'customer' | 'technician';
  workCategory?: string;
  bio?: string;
  phone?: string;
  hourlyRate?: number;
  address?: string;
  rating?: number;
  reviewsCount?: number;
}
