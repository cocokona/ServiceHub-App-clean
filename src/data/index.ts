/**
 * index.ts — Barrel export for the data module
 *
 * All data access in the app should import from this module:
 *   import { categories, initialJobs, getImageUrl } from '../data';
 *
 * This keeps the import surface clean and allows the underlying
 * data source (JSON files) to be swapped without touching components.
 */

export {
  // Image URLs
  imageUrls,
  getImageUrl,
  resolveAvatar,
  // Categories
  categories,
  technicianFilters,
  // Service config
  rooms,
  durations,
  durationUnitCost,
  focusAreas,
  baseRatesByRoom,
  serviceTypeMap,
  categoryConfig,
  timeSlots,
  defaultTravelFee,
  defaultTax,
  getBaseRate,
  getServiceTypeLabel,
  // Payment
  paymentMethods,
  defaultChecklist,
  // Mock data
  recommendedTechnicians,
  initialJobs,
  initialMessages,
  mockNotifications,
  // Tracking
  trackingSteps,
  getStatusInfo,
  getStatusIndex,
  getEta,
  // Status colors
  getStatusColor,
  // Locations & schedule
  cities,
  defaultLocation,
  daysOfWeek,
  scheduleSlots,
  // Review tags
  reviewTags,
  defaultRating,
  defaultSelectedTags,
  streakMessage,
  // Support responses
  supportDefaultResponse,
  supportAgentName,
  supportResponseDelayMs,
  supportPatterns,
  getMockSupportResponse,
  // App config
  appConfig,
  apiBaseUrl,
  apiTimeoutMs,
  technicianSharePercent,
  addOnStandardRate,
  defaultTechnicianRating,
  defaultReviewsCount,
  jobIdPrefix,
  storageKeys,
  // Role descriptions
  roleDescriptions,
  // Active service
  activeServiceMenuOptions,
  // Diagnostics
  getLoadWarnings,
  isDataHealthy,
} from './loader';

// Type re-exports
export type {
  Category,
  FocusArea,
  TimeSlot,
  PaymentMethod,
  ChecklistItem,
  TrackingStep,
  StatusInfo,
  ReviewTag,
  SupportPattern,
  Notification,
  CategoryFieldConfig,
} from './loader';
