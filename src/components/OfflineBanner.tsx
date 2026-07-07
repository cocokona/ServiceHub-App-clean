/**
 * OfflineBanner.tsx — 离线状态横幅组件
 *
 * 视觉规范：
 * - 灰色背景 (#F0F0F0) + 离线图标 + 提示文字
 * - 顶部固定定位
 * - 仅在离线状态下显示
 * - 动画过渡进入/离开
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { subscribeNetwork, NetworkInfo } from '../services/network.service';

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

interface OfflineBannerProps {
  /** 自定义提示文字 */
  message?: string;
  /** 是否显示重试提示 */
  showRetryHint?: boolean;
}

// ---------------------------------------------------------------------------
// 颜色常量（来自设计规范）
// ---------------------------------------------------------------------------

const COLORS = {
  background: '#F0F0F0',
  text: '#666666',
  icon: '#999999',
} as const;

// ---------------------------------------------------------------------------
// 组件
// ---------------------------------------------------------------------------

const OfflineBanner: React.FC<OfflineBannerProps> = ({
  message = '当前离线，显示缓存数据',
  showRetryHint = true,
}) => {
  const [isOffline, setIsOffline] = React.useState(false);
  const slideAnim = useRef(new Animated.Value(-50)).current;

  useEffect(() => {
    const unsubscribe = subscribeNetwork((info: NetworkInfo) => {
      setIsOffline(!info.isConnected);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isOffline ? 0 : -50,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  }, [isOffline, slideAnim]);

  if (!isOffline) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY: slideAnim }] },
      ]}
      accessibilityRole="alert"
      accessibilityLabel="当前离线状态"
    >
      <View style={styles.content}>
        <WifiOff size={16} color={COLORS.icon} style={styles.icon} />
        <Text style={styles.message}>{message}</Text>
        {showRetryHint && (
          <Text style={styles.hint}>下拉刷新以重试</Text>
        )}
      </View>
    </Animated.View>
  );
};

// ---------------------------------------------------------------------------
// 样式
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: COLORS.background,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 8,
  },
  message: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
  },
  hint: {
    fontSize: 12,
    color: '#999999',
    marginLeft: 8,
  },
});

export default OfflineBanner;
