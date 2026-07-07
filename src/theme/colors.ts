/**
 * theme/colors.ts — Delight Experience Color System
 *
 * 主色：玫瑰红 #FF4F8B
 * 渐变：粉→淡蓝 hero gradient
 * 语义色：成功绿、暖黄、墨水黑
 */

// ===========================================================================
// Brand Colors — 品牌色
// ===========================================================================

export const PINK = '#FF4F8B';
export const PINK_SOFT = '#FFE2EC';
export const PINK_TINT = '#FFF1F6';
export const PINK_DEEP = '#E03572';
export const PINK_DARK = '#C02A5E';

// ===========================================================================
// Gradient — 渐变
// ===========================================================================

/** 粉→淡蓝 Hero 渐变 */
export const GRADIENT_HERO = ['#FFE2EC', '#E0EAFE'] as const;
/** 玫红→深玫红 按钮渐变 */
export const GRADIENT_PINK = ['#FF4F8B', '#E03572'] as const;
/** 粉→白 卡片渐变 */
export const GRADIENT_CARD = ['#FFF1F6', '#FFFFFF'] as const;

// ===========================================================================
// Semantic Colors — 语义色
// ===========================================================================

/** 成功/已支付 */
export const SUCCESS = '#10B981';
export const SUCCESS_SOFT = '#D1FAE5';
export const SUCCESS_DARK = '#059669';

/** 暖黄 (奖杯/成就/星) */
export const ACCENT = '#F59E0B';
export const ACCENT_SOFT = '#FEF3C7';
export const ACCENT_DARK = '#D97706';

/** 警告/提醒 */
export const WARNING = '#F59E0B';
export const WARNING_SOFT = '#FEF3C7';

/** 错误/危险 */
export const ERROR = '#EF4444';
export const ERROR_SOFT = '#FEF2F2';

/** 信息蓝 (地图/追踪) */
export const INFO = '#3B82F6';
export const INFO_SOFT = '#DBEAFE';
export const MAP_BG = '#DDE7FB';

/** 紫色 (Pro 标签) */
export const PURPLE = '#8B5CF6';
export const PURPLE_SOFT = '#EDE9FE';

/** 青色 (Escrow/托管) */
export const TEAL = '#14B8A6';
export const TEAL_SOFT = '#CCFBF1';

// ===========================================================================
// Neutral Colors — 中性色
// ===========================================================================

export const INK = '#0F172A';
export const MUTED = '#64748B';
export const PLACEHOLDER = '#94A3B8';
export const BORDER = '#E5E7EB';
export const BORDER_LIGHT = '#F1F5F9';
export const SURFACE = '#FFFFFF';
export const CANVAS = '#FAFBFC';
export const DIVIDER = '#F0F0F0';

// ===========================================================================
// Legacy Aliases — 旧色向后兼容
// ===========================================================================

/** @deprecated 使用 PINK */
export const PRIMARY_LEGACY = '#003d9b';
/** @deprecated 使用 INFO_SOFT */
export const PRIMARY_CONTAINER = '#d8e2ff';
/** @deprecated 使用 BORDER_LIGHT */
export const SURFACE_VARIANT = '#e0e2ec';

// ===========================================================================
// Design Tokens — 设计令牌
// ===========================================================================

export const colors = {
  primary: PINK,
  primarySoft: PINK_SOFT,
  primaryTint: PINK_TINT,
  primaryDeep: PINK_DEEP,
  success: SUCCESS,
  successSoft: SUCCESS_SOFT,
  accent: ACCENT,
  accentSoft: ACCENT_SOFT,
  warning: WARNING,
  error: ERROR,
  errorSoft: ERROR_SOFT,
  info: INFO,
  infoSoft: INFO_SOFT,
  mapBg: MAP_BG,
  purple: PURPLE,
  purpleSoft: PURPLE_SOFT,
  teal: TEAL,
  tealSoft: TEAL_SOFT,
  ink: INK,
  muted: MUTED,
  placeholder: PLACEHOLDER,
  border: BORDER,
  borderLight: BORDER_LIGHT,
  surface: SURFACE,
  canvas: CANVAS,
} as const;

export const gradients = {
  hero: GRADIENT_HERO,
  pink: GRADIENT_PINK,
  card: GRADIENT_CARD,
} as const;
