/**
 * AchievementCelebration.tsx — 成就庆祝组件
 *
 * 提交后展示的庆祝动画：
 * - 黄色奖杯 (trophy) + 星星装饰
 * - 5 星评分展示
 * - 成就标签（如 "Super Clean!", "Punctual Pro"）
 * - 3-Booking Streak 火焰计数器
 * - "Send High Five" 互动按钮
 * - 弹入动画 + 星星飘落效果
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  Easing,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ACCENT,
  ACCENT_SOFT,
  ACCENT_DARK,
  PINK,
  PINK_SOFT,
  SURFACE,
  INK,
  MUTED,
  PURPLE,
  PURPLE_SOFT,
  TEAL,
  SUCCESS,
} from '../theme/colors';
import { radius, shadow, fontSize, spacing } from '../theme/spacing';

// ===========================================================================
// 飘落星星动画
// ===========================================================================

interface StarParticle {
  x: number;
  size: number;
  delay: number;
  duration: number;
  opacity: number;
}

const StarFall: React.FC = () => {
  const particles: StarParticle[] = Array.from({ length: 12 }, () => ({
    x: Math.random() * 100,
    size: 6 + Math.random() * 10,
    delay: Math.random() * 1000,
    duration: 1500 + Math.random() * 2000,
    opacity: 0.3 + Math.random() * 0.7,
  }));

  return (
    <View style={starFallStyles.container} pointerEvents="none">
      {particles.map((p, i) => (
        <StarParticleItem key={i} {...p} />
      ))}
    </View>
  );
};

const StarParticleItem: React.FC<StarParticle> = ({
  x,
  size,
  delay,
  duration,
  opacity,
}) => {
  const fallAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(fallAnim, {
        toValue: 1,
        duration,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [fallAnim, delay, duration]);

  return (
    <Animated.View
      style={[
        starFallStyles.particle,
        {
          left: `${x}%`,
          width: size,
          height: size,
          opacity: fallAnim.interpolate({
            inputRange: [0, 0.8, 1],
            outputRange: [opacity, opacity, 0],
          }),
          transform: [
            {
              translateY: fallAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-20, 400],
              }),
            },
          ],
        },
      ]}
    >
      <Ionicons name="star" size={size} color={ACCENT} />
    </Animated.View>
  );
};

const starFallStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  particle: {
    position: 'absolute',
    top: 0,
  },
});

// ===========================================================================
// 奖杯弹入动画
// ===========================================================================

function useBounceIn() {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      tension: 60,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [anim]);

  return anim;
}

// ===========================================================================
// 组件 Props
// ===========================================================================

interface AchievementCelebrationProps {
  /** 成就标题 */
  title?: string;
  /** 成就副标题 */
  subtitle?: string;
  /** 评分 1-5 */
  rating?: number;
  /** 连胜次数 */
  streak?: number;
  /** 成就标签 */
  badges?: string[];
  /** "Send High Five" 回调 */
  onHighFive?: () => void;
  /** "View Receipt" 回调 */
  onViewReceipt?: () => void;
  style?: ViewStyle;
}

// ===========================================================================
// 子组件: 5 星评分
// ===========================================================================

const StarRating: React.FC<{ rating: number }> = ({ rating }) => (
  <View style={ratingStyles.container}>
    {[1, 2, 3, 4, 5].map((star) => (
      <Ionicons
        key={star}
        name={star <= rating ? 'star' : 'star-outline'}
        size={28}
        color={star <= rating ? ACCENT : '#E5E7EB'}
        style={ratingStyles.star}
      />
    ))}
    <Text style={ratingStyles.label}>Excellent service!</Text>
  </View>
);

const ratingStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  star: {
    marginHorizontal: 3,
  },
  label: {
    width: '100%',
    textAlign: 'center',
    fontSize: fontSize.large,
    fontWeight: '700',
    color: ACCENT_DARK,
    marginTop: spacing.sm,
  },
});

// ===========================================================================
// 子组件: 3-Booking Streak
// ===========================================================================

const BookingStreak: React.FC<{ count: number }> = ({ count }) => (
  <View style={streakStyles.container}>
    <Ionicons name="flame" size={20} color={PINK} />
    <Text style={streakStyles.count}>{count}-Booking Streak!</Text>
    <View style={streakStyles.bar}>
      {[1, 2, 3].map((i) => (
        <View
          key={i}
          style={[
            streakStyles.segment,
            i <= count && streakStyles.segmentActive,
          ]}
        />
      ))}
    </View>
  </View>
);

const streakStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PINK_SOFT,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  count: {
    fontSize: fontSize.medium,
    fontWeight: '800',
    color: PINK,
  },
  bar: {
    flexDirection: 'row',
    gap: 3,
  },
  segment: {
    width: 14,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FCD7E7',
  },
  segmentActive: {
    backgroundColor: PINK,
  },
});

// ===========================================================================
// 子组件: 成就标签
// ===========================================================================

const BadgeTags: React.FC<{ badges: string[] }> = ({ badges }) => (
  <View style={badgeStyles.container}>
    {badges.map((badge, i) => (
      <View
        key={i}
        style={[
          badgeStyles.tag,
          {
            backgroundColor:
              i === 0 ? PINK_SOFT : i === 1 ? PURPLE_SOFT : PINK_SOFT,
            borderColor:
              i === 0 ? PINK + '40' : i === 1 ? PURPLE + '40' : PINK + '40',
          },
        ]}
      >
        <Ionicons
          name={i === 0 ? 'sparkles' : i === 1 ? 'star' : 'shield-checkmark'}
          size={12}
          color={i === 0 ? PINK : i === 1 ? PURPLE : SUCCESS}
          style={badgeStyles.tagIcon}
        />
        <Text
          style={[
            badgeStyles.tagText,
            {
              color: i === 0 ? PINK : i === 1 ? PURPLE : SUCCESS,
            },
          ]}
        >
          {badge}
        </Text>
      </View>
    ))}
  </View>
);

const badgeStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  tagIcon: {
    marginRight: 4,
  },
  tagText: {
    fontSize: fontSize.small,
    fontWeight: '700',
  },
});

// ===========================================================================
// 主导出组件
// ===========================================================================

const AchievementCelebration: React.FC<AchievementCelebrationProps> = ({
  title = 'Booking Confirmed!',
  subtitle = 'Your service has been booked successfully',
  rating = 5,
  streak = 3,
  badges = ['Super Clean!', 'Punctual Pro', 'Trusted'],
  onHighFive,
  onViewReceipt,
  style,
}) => {
  const bounceIn = useBounceIn();

  return (
    <View style={[styles.container, style]}>
      {/* 星星飘落 */}
      <StarFall />

      {/* 奖杯弹入 */}
      <Animated.View
        style={[
          styles.trophyCircle,
          {
            transform: [
              { scale: bounceIn },
              {
                translateY: bounceIn.interpolate({
                  inputRange: [0, 1],
                  outputRange: [40, 0],
                }),
              },
            ],
            opacity: bounceIn,
          },
        ]}
      >
        <Ionicons name="trophy" size={48} color={ACCENT} />
      </Animated.View>

      {/* 标题文案 */}
      <Animated.Text style={[styles.title, { opacity: bounceIn }]}>
        {title}
      </Animated.Text>
      <Animated.Text style={[styles.subtitle, { opacity: bounceIn }]}>
        {subtitle}
      </Animated.Text>

      {/* 5 星评分 */}
      <Animated.View style={{ opacity: bounceIn }}>
        <StarRating rating={rating} />
      </Animated.View>

      {/* 成就标签 */}
      <Animated.View style={{ opacity: bounceIn }}>
        <BadgeTags badges={badges} />
      </Animated.View>

      {/* 3-Booking Streak */}
      <Animated.View style={{ opacity: bounceIn }}>
        <BookingStreak count={streak} />
      </Animated.View>

      {/* Send High Five 按钮 */}
      {onHighFive && (
        <TouchableOpacity
          style={styles.highFiveBtn}
          onPress={onHighFive}
          activeOpacity={0.85}
        >
          <Ionicons name="hand-left" size={20} color={SURFACE} />
          <Text style={styles.highFiveText}>Send High Five</Text>
        </TouchableOpacity>
      )}

      {/* View Receipt */}
      {onViewReceipt && (
        <TouchableOpacity style={styles.receiptBtn} onPress={onViewReceipt}>
          <Text style={styles.receiptText}>View Receipt</Text>
          <Ionicons name="chevron-forward" size={16} color={PINK} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: SURFACE,
    borderRadius: radius['2xl'],
    padding: spacing['2xl'],
    alignItems: 'center',
    ...shadow.cardLg,
  },
  trophyCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: ACCENT_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    borderWidth: 3,
    borderColor: ACCENT + '30',
  },
  title: {
    fontSize: fontSize.h2,
    fontWeight: '800',
    color: INK,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.medium,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 20,
  },
  highFiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PINK,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: radius.full,
    gap: spacing.sm,
    ...shadow.pinkButton,
  },
  highFiveText: {
    color: SURFACE,
    fontSize: fontSize.large,
    fontWeight: '800',
  },
  receiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    gap: 4,
  },
  receiptText: {
    fontSize: fontSize.medium,
    color: PINK,
    fontWeight: '700',
  },
});

export { StarRating, BookingStreak, BadgeTags };
export default AchievementCelebration;
