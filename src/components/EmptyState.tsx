/**
 * EmptyState.tsx — Delightful Empty State
 *
 * 品牌空状态设计：
 * - 粉+淡蓝渐变背景圆形
 * - 装饰性星星图标（sparkles / star / flower）
 * - 鼓励性文案
 * - CTA 按钮
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PINK, PINK_SOFT, PINK_DEEP, INK, MUTED, SURFACE } from '../theme/colors';
import { radius, shadow, fontSize, spacing } from '../theme/spacing';

interface EmptyStateProps {
  /** 主图标名 (Ionicons) */
  icon?: string;
  /** 装饰图标（3 个小图标） */
  decorIcons?: [string, string, string];
  /** 标题 */
  title: string;
  /** 副标题 */
  subtitle?: string;
  /** CTA 按钮文字 */
  ctaLabel?: string;
  /** CTA 回调 */
  onCta?: () => void;
  /** 自定义样式 */
  style?: ViewStyle;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'sparkles',
  decorIcons = ['sparkles', 'star', 'flower'],
  title,
  subtitle,
  ctaLabel,
  onCta,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {/* 装饰性背景圆 */}
      <View style={styles.iconCircle}>
        <View style={styles.decorRow}>
          {decorIcons.map((name, i) => (
            <Ionicons
              key={i}
              name={name as any}
              size={i === 1 ? 32 : 20}
              color={i === 0 ? PINK : i === 1 ? PINK_DEEP : MUTED}
              style={styles.decorIcon}
            />
          ))}
        </View>
        <Ionicons name={icon as any} size={48} color={PINK} />
      </View>

      {/* 文案 */}
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

      {/* CTA 按钮 */}
      {ctaLabel && onCta && (
        <TouchableOpacity
          style={styles.cta}
          onPress={onCta}
          activeOpacity={0.85}
        >
          <Ionicons name="sparkles" size={16} color="#FFF" style={{ marginRight: 6 }} />
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    paddingHorizontal: spacing.xl,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: PINK_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  decorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  decorIcon: {
    opacity: 0.7,
  },
  title: {
    fontSize: fontSize.h3,
    fontWeight: '700',
    color: INK,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.body,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xl,
    maxWidth: 260,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PINK,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: radius.full,
    ...shadow.pinkButton,
  },
  ctaText: {
    color: SURFACE,
    fontSize: fontSize.medium,
    fontWeight: '700',
  },
});

export default EmptyState;
