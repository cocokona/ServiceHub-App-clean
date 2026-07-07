/**
 * LoadingSkeleton.tsx — 骨架屏加载组件
 *
 * 设计规范：
 * - Shimmer 脉冲动画效果
 * - 灰色 (#EBEEF5) → 浅灰渐变
 * - 支持多种变体：card / list / detail / inline
 *
 * 适用场景：
 * - 页面首次加载
 * - 缓存未命中 + 网络不可用（L2 降级）
 * - 详情页数据加载
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Animated,
  Easing,
  StyleSheet,
  DimensionValue,
} from 'react-native';

// ---------------------------------------------------------------------------
// 颜色
// ---------------------------------------------------------------------------

const SHIMMER_BASE = '#EBEEF5';
const SHIMMER_HIGHLIGHT = '#F5F7FA';

// ---------------------------------------------------------------------------
// Shimmer 脉冲动画 Hook
// ---------------------------------------------------------------------------

function useShimmerAnimation() {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1200,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  return shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });
}

// ---------------------------------------------------------------------------
// 基础骨架块
// ---------------------------------------------------------------------------

interface SkeletonBlockProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: object;
}

const SkeletonBlock: React.FC<SkeletonBlockProps> = ({
  width = '100%',
  height = 16,
  borderRadius = 4,
  style,
}) => {
  const opacity = useShimmerAnimation();

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: SHIMMER_BASE,
          opacity,
        },
        style,
      ]}
    />
  );
};

// ---------------------------------------------------------------------------
// 骨架屏变体
// ---------------------------------------------------------------------------

/**
 * 卡片骨架屏 (3-5 个脉冲条)
 * 用于列表页首次加载
 */
interface CardSkeletonProps {
  count?: number;
}

const CardSkeleton: React.FC<CardSkeletonProps> = ({ count = 3 }) => {
  return (
    <View style={styles.cardList}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.card}>
          <View style={styles.cardHeader}>
            <SkeletonBlock width={40} height={14} />
            <SkeletonBlock width={60} height={14} />
          </View>
          <SkeletonBlock height={16} style={styles.cardTitle} />
          <SkeletonBlock width="75%" height={14} style={styles.cardSubtitle} />
          <View style={styles.cardFooter}>
            <SkeletonBlock width={50} height={12} />
            <SkeletonBlock width={30} height={30} borderRadius={15} />
          </View>
        </View>
      ))}
    </View>
  );
};

/**
 * 列表项骨架屏 (紧凑版)
 */
interface ListSkeletonProps {
  count?: number;
}

const ListSkeleton: React.FC<ListSkeletonProps> = ({ count = 5 }) => {
  return (
    <View style={styles.listContainer}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.listItem}>
          <SkeletonBlock width={36} height={36} borderRadius={18} />
          <View style={styles.listItemContent}>
            <SkeletonBlock width="60%" height={14} />
            <SkeletonBlock width="40%" height={12} style={styles.mt4} />
          </View>
          <SkeletonBlock width={50} height={12} />
        </View>
      ))}
    </View>
  );
};

/**
 * 详情页骨架屏
 */
const DetailSkeleton: React.FC = () => {
  return (
    <View style={styles.detailContainer}>
      {/* 标题 */}
      <SkeletonBlock width="70%" height={24} style={styles.mb12} />
      {/* 描述 */}
      <SkeletonBlock height={14} style={styles.mb8} />
      <SkeletonBlock width="90%" height={14} style={styles.mb8} />
      <SkeletonBlock width="60%" height={14} style={styles.mb20} />
      {/* 图片占位 */}
      <SkeletonBlock height={180} borderRadius={12} style={styles.mb16} />
      {/* 详情段落 */}
      <SkeletonBlock width="45%" height={18} style={styles.mb12} />
      <SkeletonBlock height={13} style={styles.mb6} />
      <SkeletonBlock height={13} style={styles.mb6} />
      <SkeletonBlock width="80%" height={13} style={styles.mb6} />
      <SkeletonBlock width="55%" height={13} style={styles.mb20} />
      {/* 底部按钮 */}
      <SkeletonBlock height={48} borderRadius={24} />
    </View>
  );
};

/**
 * 内联骨架（用于小范围加载，如文字/按钮替换）
 */
interface InlineSkeletonProps {
  width?: DimensionValue;
  height?: number;
  count?: number;
}

const InlineSkeleton: React.FC<InlineSkeletonProps> = ({
  width = 120,
  height = 14,
  count = 1,
}) => {
  return (
    <View style={styles.inlineContainer}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBlock
          key={i}
          width={width}
          height={height}
          style={i < count - 1 ? styles.mb4 : undefined}
        />
      ))}
    </View>
  );
};

// ---------------------------------------------------------------------------
// 主导出组件
// ---------------------------------------------------------------------------

interface LoadingSkeletonProps {
  /** 骨架屏变体 */
  variant: 'card' | 'list' | 'detail' | 'inline';
  /** 骨架条数量 (card/list/inline) */
  count?: number;
  /** 自定义容器样式 */
  style?: object;
  /** [inline] 骨架条宽度 */
  width?: DimensionValue;
  /** [inline] 骨架条高度 */
  height?: number;
}

const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  variant,
  count,
  style,
  width,
  height,
}) => {
  const renderVariant = () => {
    switch (variant) {
      case 'card':
        return <CardSkeleton count={count} />;
      case 'list':
        return <ListSkeleton count={count} />;
      case 'detail':
        return <DetailSkeleton />;
      case 'inline':
        return <InlineSkeleton count={count} width={width} height={height} />;
      default:
        return <CardSkeleton />;
    }
  };

  return <View style={style}>{renderVariant()}</View>;
};

export { SkeletonBlock, CardSkeleton, ListSkeleton, DetailSkeleton, InlineSkeleton };
export default LoadingSkeleton;

// ---------------------------------------------------------------------------
// 样式
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Card
  cardList: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitle: {
    marginBottom: 4,
  },
  cardSubtitle: {
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  // List
  listContainer: {
    padding: 16,
    gap: 12,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  listItemContent: {
    flex: 1,
    gap: 4,
  },
  // Detail
  detailContainer: {
    padding: 16,
  },
  // Inline
  inlineContainer: {
    gap: 4,
  },
  // Spacing utilities
  mt4: { marginTop: 4 },
  mb4: { marginBottom: 4 },
  mb6: { marginBottom: 6 },
  mb8: { marginBottom: 8 },
  mb12: { marginBottom: 12 },
  mb16: { marginBottom: 16 },
  mb20: { marginBottom: 20 },
});
