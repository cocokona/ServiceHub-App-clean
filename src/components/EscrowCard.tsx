/**
 * EscrowCard.tsx — 绿色安全托管卡片
 *
 * 展示支付托管状态：
 * - 绿色渐变背景（#D1FAE5 → #A7F3D0）
 * - 盾牌图标 + "Secure Escrow" 标题
 * - 金额、状态说明
 * - 释放/退款操作
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SUCCESS, SUCCESS_SOFT, INK, MUTED, SURFACE } from '../theme/colors';
import { shadow, radius, fontSize, spacing } from '../theme/spacing';

interface EscrowCardProps {
  /** 托管金额 */
  amount: string;
  /** 状态文字 */
  status: string;
  /** 状态描述 */
  description?: string;
  /** 是否已释放 */
  released?: boolean;
  style?: ViewStyle;
}

const EscrowCard: React.FC<EscrowCardProps> = ({
  amount,
  status,
  description,
  released = false,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {/* 顶部：盾牌 + 标题 */}
      <View style={styles.header}>
        <View style={styles.shieldCircle}>
          <Ionicons
            name="shield-checkmark"
            size={22}
            color={SUCCESS}
          />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.label}>Secure Escrow</Text>
          <Text style={styles.status}>{status}</Text>
        </View>
        {released && (
          <View style={styles.releasedBadge}>
            <Ionicons name="checkmark-circle" size={14} color={SUCCESS} />
            <Text style={styles.releasedText}>Released</Text>
          </View>
        )}
      </View>

      {/* 底部：金额 */}
      <View style={styles.amountRow}>
        <Text style={styles.amount}>{amount}</Text>
        {description && (
          <Text style={styles.description}>{description}</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: SURFACE,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: SUCCESS_SOFT,
    padding: spacing.lg,
    ...shadow.escrow,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  shieldCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SUCCESS_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  label: {
    fontSize: fontSize.caption,
    color: MUTED,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  status: {
    fontSize: fontSize.medium,
    color: INK,
    fontWeight: '700',
    marginTop: 2,
  },
  releasedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SUCCESS_SOFT,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    gap: 4,
  },
  releasedText: {
    fontSize: fontSize.small,
    color: SUCCESS,
    fontWeight: '700',
  },
  amountRow: {
    borderTopWidth: 1,
    borderTopColor: SUCCESS_SOFT,
    paddingTop: spacing.md,
  },
  amount: {
    fontSize: fontSize.h1,
    fontWeight: '800',
    color: INK,
  },
  description: {
    fontSize: fontSize.small,
    color: MUTED,
    marginTop: 4,
  },
});

export default EscrowCard;
