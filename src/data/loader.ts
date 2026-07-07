/**
 * loader.ts — Runtime data loader with error handling
 *
 * Loads JSON data files bundled by Metro at build time, provides typed
 * access, graceful fallbacks, and structured logging for missing/malformed
 * data. All data access in the app should go through this module.
 */

import { Job, Message, Technician } from '../types';

// ---------------------------------------------------------------------------
// Raw JSON imports — Metro bundles these at build time
// ---------------------------------------------------------------------------

import imageUrlsData from './files/image-urls.json';
import categoriesData from './files/categories.json';
import serviceConfigData from './files/service-config.json';
import paymentMethodsData from './files/payment-methods.json';
import mockTechniciansData from './files/mock-technicians.json';
import mockJobsData from './files/mock-jobs.json';
import mockMessagesData from './files/mock-messages.json';
import mockNotificationsData from './files/mock-notifications.json';
import trackingStepsData from './files/tracking-steps.json';
import statusColorsData from './files/status-colors.json';
import locationsData from './files/locations.json';
import reviewTagsData from './files/review-tags.json';
import supportResponsesData from './files/support-responses.json';
import appConfigData from './files/app-config.json';
import roleDescriptionsData from './files/role-descriptions.json';
import activeServiceOptionsData from './files/active-service-options.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Category {
  key: string;
  label: string;
  icon: string;
  color: string;
}

export interface FocusArea {
  key: string;
  label: string;
  emoji: string;
  price: number;
}

export interface TimeSlot {
  key: string;
  label: string;
  time: string;
  icon: string;
}

export interface PaymentMethod {
  key: string;
  label: string;
  icon: string;
  last4?: string;
}

export interface ChecklistItem {
  text: string;
  completed: boolean;
}

export interface TrackingStep {
  key: string;
  title: string;
  subtitle: string;
  time: string | null;
}

export interface StatusInfo {
  title: string;
  subtitle: string;
}

export interface ReviewTag {
  key: string;
  label: string;
  color: string;
  soft: string;
}

export interface SupportPattern {
  keywords: string[];
  response: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
}

// ---------------------------------------------------------------------------
// Loader core — safe accessor with fallback + logging
// ---------------------------------------------------------------------------

const loadWarnings: string[] = [];

/**
 * Safely extract a value from a parsed JSON object.
 * Returns the fallback if the data is null/undefined or the field is missing.
 */
function safeGet<T>(data: unknown, fallback: T): T {
  if (data === null || data === undefined) {
    loadWarnings.push(`Data file returned null/undefined, using fallback`);
    return fallback;
  }
  return data as T;
}

/**
 * Validate that an array has items; return fallback if empty or invalid.
 */
function safeArray<T>(data: unknown, fallback: T[]): T[] {
  if (!Array.isArray(data) || data.length === 0) {
    loadWarnings.push(`Expected non-empty array, using fallback`);
    return fallback;
  }
  return data as T[];
}

// ---------------------------------------------------------------------------
// Image URLs — with avatarKey resolution
// ---------------------------------------------------------------------------

const _imageUrls = safeGet<Record<string, string>>(imageUrlsData, {});

/**
 * Resolve an image URL by key. Returns empty string if not found.
 */
export function getImageUrl(key: string): string {
  return _imageUrls[key] ?? '';
}

/**
 * Resolve a batch of avatar keys to URLs.
 * If the value is already a URL (starts with http), return as-is.
 */
export function resolveAvatar(keyOrUrl: string): string {
  if (!keyOrUrl) return '';
  if (keyOrUrl.startsWith('http')) return keyOrUrl;
  return _imageUrls[keyOrUrl] ?? '';
}

export const imageUrls = _imageUrls;

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

const _categories = safeArray<Category>(categoriesData.categories, []);

export const categories: Category[] = _categories;

export const technicianFilters: string[] = safeArray<string>(
  categoriesData.technicianFilters,
  ['all', 'cleaning', 'repair', 'electrical'],
);

// ---------------------------------------------------------------------------
// Service configuration (rooms, durations, focus areas, pricing, time slots)
// ---------------------------------------------------------------------------

export const rooms: string[] = safeArray<string>(serviceConfigData.rooms, [
  '1-2 Rooms',
  '3-4 Rooms',
  '5-6 Rooms',
  '7+ Rooms',
]);

export const durations: number[] = safeArray<number>(
  serviceConfigData.durations,
  [2, 4, 6],
);

export const durationUnitCost: number = safeGet<number>(
  serviceConfigData.durationUnitCost,
  20,
);

export const focusAreas: FocusArea[] = safeArray<FocusArea>(
  serviceConfigData.focusAreas,
  [],
);

export const baseRatesByRoom: Record<string, number> = safeGet<
  Record<string, number>
>(serviceConfigData.baseRatesByRoom, {});

export const serviceTypeMap: Record<string, string> = safeGet<
  Record<string, string>
>(serviceConfigData.serviceTypeMap, {});

export const timeSlots: TimeSlot[] = safeArray<TimeSlot>(
  serviceConfigData.timeSlots,
  [],
);

export const defaultTravelFee: number = safeGet<number>(
  serviceConfigData.defaultTravelFee,
  10,
);

export const defaultTax: number = safeGet<number>(
  serviceConfigData.defaultTax,
  0,
);

/**
 * Get base rate for a room selection. Falls back to 0 if not found.
 */
export function getBaseRate(roomSelection: string): number {
  return baseRatesByRoom[roomSelection] ?? 0;
}

/**
 * Get service type label for a category key.
 */
export function getServiceTypeLabel(category: string): string {
  return serviceTypeMap[category] ?? 'Service';
}

// ---------------------------------------------------------------------------
// Payment methods & default checklist
// ---------------------------------------------------------------------------

export const paymentMethods: PaymentMethod[] = safeArray<PaymentMethod>(
  paymentMethodsData.methods,
  [],
);

export const defaultChecklist: ChecklistItem[] = safeArray<ChecklistItem>(
  paymentMethodsData.defaultChecklist,
  [{ text: 'Service started', completed: false }],
);

// ---------------------------------------------------------------------------
// Mock data — technicians, jobs, messages, notifications
// ---------------------------------------------------------------------------

/**
 * Parse mock technicians, resolving avatarKey → full URL.
 */
function parseTechnicians(
  raw: unknown,
): Technician[] {
  const arr = safeArray<any>(raw, []);
  return arr.map((t) => ({
    name: t.name ?? '',
    avatar: resolveAvatar(t.avatarKey ?? ''),
    rating: t.rating ?? 0,
    reviewsCount: t.reviewsCount ?? 0,
    specialty: t.specialty ?? '',
    ratePerHour: t.ratePerHour ?? 0,
  }));
}

/**
 * Parse mock jobs, resolving avatarKey → full URL.
 */
function parseJobs(raw: unknown): Job[] {
  const arr = safeArray<any>(raw, []);
  return arr.map((j) => ({
    ...j,
    customerAvatar: resolveAvatar(j.customerAvatarKey ?? ''),
    technicianAvatar: resolveAvatar(j.technicianAvatarKey ?? ''),
  }));
}

/**
 * Parse mock messages, resolving avatarKey → full URL.
 */
function parseMessages(raw: unknown): Message[] {
  const arr = safeArray<any>(raw, []);
  return arr.map((m) => ({
    ...m,
    senderAvatar: m.avatarKey ? resolveAvatar(m.avatarKey) : undefined,
  }));
}

export const recommendedTechnicians: Technician[] = parseTechnicians(
  mockTechniciansData.technicians,
);

export const initialJobs: Job[] = parseJobs(mockJobsData.jobs);

export const initialMessages: Message[] = parseMessages(
  mockMessagesData.messages,
);

export const mockNotifications: Notification[] = safeArray<Notification>(
  mockNotificationsData.notifications,
  [],
);

// ---------------------------------------------------------------------------
// Tracking steps & status info
// ---------------------------------------------------------------------------

export const trackingSteps: TrackingStep[] = safeArray<TrackingStep>(
  trackingStepsData.steps,
  [],
);

const _statusInfo = safeGet<Record<string, StatusInfo>>(
  trackingStepsData.statusInfo,
  {},
);

const _statusIndex = safeGet<Record<string, number>>(
  trackingStepsData.statusIndex,
  {},
);

const _etaByStatus = safeGet<Record<string, string>>(
  trackingStepsData.etaByStatus,
  {},
);

export function getStatusInfo(status: string): StatusInfo {
  return _statusInfo[status] ?? _statusInfo.default ?? { title: 'Unknown', subtitle: '' };
}

export function getStatusIndex(status: string): number {
  return _statusIndex[status] ?? 0;
}

export function getEta(status: string): string | null {
  return _etaByStatus[status] ?? null;
}

// ---------------------------------------------------------------------------
// Status colors
// ---------------------------------------------------------------------------

const _statusColors = safeGet<Record<string, Record<string, string>>>(
  statusColorsData,
  { customer: {}, technician: {} },
);

export function getStatusColor(
  status: string,
  role: 'customer' | 'technician' = 'customer',
): string {
  const palette = _statusColors[role] ?? _statusColors.customer ?? {};
  return palette[status] ?? palette.default ?? '#6b7280';
}

// ---------------------------------------------------------------------------
// Locations & schedule
// ---------------------------------------------------------------------------

export const cities: string[] = safeArray<string>(locationsData.cities, []);
export const defaultLocation: string = safeGet<string>(
  locationsData.defaultLocation,
  'San Francisco, CA',
);
export const currentLocationDemo = safeGet<{
  street: string;
  city: string;
  zipCode: string;
}>(locationsData.currentLocationDemo, {
  street: '',
  city: '',
  zipCode: '',
});
export const daysOfWeek: string[] = safeArray<string>(
  locationsData.daysOfWeek,
  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
);
export const scheduleSlots: string[] = safeArray<string>(
  locationsData.scheduleSlots,
  [],
);

// ---------------------------------------------------------------------------
// Review tags
// ---------------------------------------------------------------------------

export const reviewTags: ReviewTag[] = safeArray<ReviewTag>(
  reviewTagsData.tags,
  [],
);

export const defaultRating: number = safeGet<number>(
  reviewTagsData.defaultRating,
  4,
);

export const defaultSelectedTags: string[] = safeArray<string>(
  reviewTagsData.defaultSelectedTags,
  [],
);

export const streakMessage = safeGet<{ title: string; subtitle: string }>(
  reviewTagsData.streakMessage,
  { title: '', subtitle: '' },
);

// ---------------------------------------------------------------------------
// Support auto-responses
// ---------------------------------------------------------------------------

const _supportData = safeGet<{
  defaultResponse: string;
  supportAgentName: string;
  responseDelayMs: number;
  patterns: SupportPattern[];
}>(supportResponsesData, {
  defaultResponse: 'Thank you for your message.',
  supportAgentName: 'Support',
  responseDelayMs: 1500,
  patterns: [],
});

export const supportDefaultResponse: string = _supportData.defaultResponse;
export const supportAgentName: string = _supportData.supportAgentName;
export const supportResponseDelayMs: number = _supportData.responseDelayMs;
export const supportPatterns: SupportPattern[] = safeArray<SupportPattern>(
  _supportData.patterns,
  [],
);

/**
 * Get a mock support response based on user input.
 * Matches against keyword patterns from the data file.
 */
export function getMockSupportResponse(input: string): string {
  const lower = input.toLowerCase();
  for (const pattern of supportPatterns) {
    if (pattern.keywords.some((kw) => lower.includes(kw))) {
      return pattern.response;
    }
  }
  return supportDefaultResponse;
}

// ---------------------------------------------------------------------------
// App configuration
// ---------------------------------------------------------------------------

export const appConfig = safeGet<{
  api: { defaultBaseUrl: string; timeoutMs: number };
  earnings: { technicianSharePercent: number };
  addOns: { standardRate: number };
  rating: { defaultTechnicianRating: number; defaultReviewsCount: number };
  jobIdPrefix: string;
  storageKeys: Record<string, string>;
}>(appConfigData, {
  api: { defaultBaseUrl: 'http://localhost:3000', timeoutMs: 10000 },
  earnings: { technicianSharePercent: 70 },
  addOns: { standardRate: 15 },
  rating: { defaultTechnicianRating: 4.9, defaultReviewsCount: 327 },
  jobIdPrefix: '#SH',
  storageKeys: { user: 'sh_user' },
});

export const apiBaseUrl: string = appConfig.api.defaultBaseUrl;
export const apiTimeoutMs: number = appConfig.api.timeoutMs;
export const technicianSharePercent: number =
  appConfig.earnings.technicianSharePercent;
export const addOnStandardRate: number = appConfig.addOns.standardRate;
export const defaultTechnicianRating: number =
  appConfig.rating.defaultTechnicianRating;
export const defaultReviewsCount: number =
  appConfig.rating.defaultReviewsCount;
export const jobIdPrefix: string = appConfig.jobIdPrefix;
export const storageKeys = appConfig.storageKeys;

// ---------------------------------------------------------------------------
// Role descriptions
// ---------------------------------------------------------------------------

export const roleDescriptions = safeGet<{
  customer: { title: string; description: string };
  technician: { title: string; description: string };
  appName: string;
  appTagline: string;
  helpTitle: string;
  helpMessage: string;
  helpLinkText: string;
}>(roleDescriptionsData, {
  customer: { title: 'I am a Customer', description: '' },
  technician: { title: 'I am a Technician', description: '' },
  appName: 'ServiceHub',
  appTagline: '',
  helpTitle: '',
  helpMessage: '',
  helpLinkText: '',
});

// ---------------------------------------------------------------------------
// Active service options
// ---------------------------------------------------------------------------

export const activeServiceMenuOptions: string[] = safeArray<string>(
  activeServiceOptionsData.menuOptions,
  [],
);

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

/**
 * Returns any warnings generated during data loading.
 * Useful for debugging in development.
 */
export function getLoadWarnings(): string[] {
  return [...loadWarnings];
}

/**
 * True if all data files loaded without warnings.
 */
export function isDataHealthy(): boolean {
  return loadWarnings.length === 0;
}
