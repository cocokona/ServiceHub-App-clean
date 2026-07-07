/**
 * PillButton.tsx — 玫红药丸形按钮
 *
 * pill 形状 (borderRadius: 999)，带 PINK 渐变阴影。
 * 支持：primary (玫红) / outline (描边) / ghost (透明) 变体
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PINK, PINK_DEEP, SURFACE, MUTED } from '../theme/colors';
import { shadow, radius, fontSize, spacing } from '../theme/spacing';

type PillButtonVariant = 'primary' | 'outline' | 'ghost';

interface PillButtonProps {
  label: string;
  onPress: () => void;
  variant?: PillButtonVariant;
  /** Ionicons 图标名 */
  icon?: string;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const PillButton: React.FC<PillButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
  textStyle,
}) => {
  const isPrimary = variant === 'primary';

  return (
    <TouchableOpacity
      style={[
        styles.base,
        isPrimary ? styles.primary : variant === 'outline' ? styles.outline : styles.ghost,
        isPrimary && !disabled && shadow.pinkButton,
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color={isPrimary ? SURFACE : PINK} />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <Ionicons
              name={icon as any}
              size={18}
              color={isPrimary ? SURFACE : PINK}
              style={styles.iconLeft}
            />
          )}
          <Text
            style={[
              styles.text,
              isPrimary ? styles.textPrimary : styles.textOutline,
              textStyle,
            ]}
          >
            {label}
          </Text>
          {icon && iconPosition === 'right' && (
            <Ionicons
              name={icon as any}
              size={18}
              color={isPrimary ? SURFACE : PINK}
              style={styles.iconRight}
            />
          )}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: radius.full,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  primary: {
    backgroundColor: PINK,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: PINK,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: fontSize.large,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  textPrimary: {
    color: SURFACE,
  },
  textOutline: {
    color: PINK,
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
});

export default PillButton;
