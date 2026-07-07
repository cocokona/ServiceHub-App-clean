/**
 * theme/spacing.ts — 间距、圆角、阴影、字体令牌
 */

// ===========================================================================
// Border Radius — 圆角令牌
// ===========================================================================

export const radius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  full: 9999,
} as const;

// ===========================================================================
// Shadows — 阴影令牌
// ===========================================================================

export const shadow = {
  /** 轻卡片阴影 */
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  /** 大卡片浮动阴影 */
  cardLg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  /** 玫红按钮阴影 */
  pinkButton: {
    shadowColor: '#FF4F8B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 5,
  },
  /** 暖黄成就阴影 */
  accent: {
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 5,
  },
  /** 绿色托管卡阴影 */
  escrow: {
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
  },
} as const;

// ===========================================================================
// Spacing — 间距令牌
// ===========================================================================

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
} as const;

// ===========================================================================
// Typography — 字体令牌
// ===========================================================================

export const fontSize = {
  caption: 11,
  small: 12,
  body: 13,
  medium: 14,
  large: 16,
  h3: 18,
  h2: 22,
  h1: 28,
  hero: 36,
} as const;

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};
