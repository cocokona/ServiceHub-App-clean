/**
 * GradientHero.tsx — 粉→淡蓝渐变 Hero 区域
 *
 * 用于页面顶部欢迎区域。
 * 背景：linear-gradient(to bottom, #FFE2EC, #E0EAFE)
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GRADIENT_HERO } from '../theme/colors';

interface GradientHeroProps {
  children: React.ReactNode;
  /** 自定义高度，默认 200 */
  height?: number;
  /** 底部圆角，默认 24 */
  borderBottomRadius?: number;
  style?: ViewStyle;
}

const GradientHero: React.FC<GradientHeroProps> = ({
  children,
  height = 200,
  borderBottomRadius = 24,
  style,
}) => {
  return (
    <LinearGradient
      colors={[GRADIENT_HERO[0], GRADIENT_HERO[1]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[
        styles.container,
        {
          height,
          borderBottomLeftRadius: borderBottomRadius,
          borderBottomRightRadius: borderBottomRadius,
        },
        style,
      ]}
    >
      {children}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

export default GradientHero;
