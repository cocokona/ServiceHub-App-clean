/**
 * LiveTrackingCard.tsx — Live Tracking with Character
 *
 * 实时追踪卡片：
 * - 淡蓝地图背景 (#DDE7FB)
 * - 脉动头像动画（pulsing ring）
 * - "LIVE" 红色徽章
 * - ETA 估算卡片
 * - Journey Progress 时间线
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  Easing,
  StyleSheet,
  ViewStyle,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  PINK,
  MAP_BG,
  INFO,
  INK,
  MUTED,
  ERROR,
  SURFACE,
  ACCENT,
  BORDER,
  SUCCESS,
} from '../theme/colors';
import { radius, shadow, fontSize, spacing } from '../theme/spacing';

// ===========================================================================
// 脉动动画 Hook
// ===========================================================================

function usePulseAnimation() {
  const anim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1.4,
          duration: 1200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 1,
          duration: 800,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return anim;
}

// ===========================================================================
// 组件 Props
// ===========================================================================

interface JourneyStep {
  label: string;
  time: string;
  completed: boolean;
  active: boolean;
}

interface LiveTrackingCardProps {
  /** 技师姓名 */
  technicianName: string;
  /** 技师头像 URL */
  technicianAvatar?: string;
  /** 估计到达时间 */
  eta: string;
  /** 距离 */
  distance: string;
  /** 行程进度步骤 */
  journeySteps: JourneyStep[];
  /** 是否已到达 */
  arrived?: boolean;
  style?: ViewStyle;

  // 实时追踪数据绑定（坐标在屏幕侧喂给 computeEta，isLive 控制 LIVE 脉冲）
  /** 技师实时纬度（来自 Realtime） */
  technicianLat?: number;
  /** 技师实时经度 */
  technicianLng?: number;
  /** 客户目的地纬度 */
  destinationLat?: number;
  /** 客户目的地经度 */
  destinationLng?: number;
  /** 是否已收到首个技师定位（控制 LIVE 徽章与脉冲） */
  isLive?: boolean;
}

// ===========================================================================
// 子组件: 脉动头像
// ===========================================================================

const PulsingAvatar: React.FC<{
  name: string;
  avatar?: string;
  size?: number;
}> = ({ name, avatar, size = 56 }) => {
  const pulse = usePulseAnimation();
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <View style={[pulseStyles.wrapper, { width: size + 16, height: size + 16 }]}>
      {/* 脉动波纹 */}
      <Animated.View
        style={[
          pulseStyles.ring,
          {
            width: size + 16,
            height: size + 16,
            borderRadius: (size + 16) / 2,
            transform: [{ scale: pulse }],
            opacity: pulse.interpolate({
              inputRange: [1, 1.4],
              outputRange: [0.4, 0],
            }),
          },
        ]}
      />
      {/* 头像 */}
      <View style={[pulseStyles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={pulseStyles.avatarImage} />
        ) : (
          <Text style={[pulseStyles.initials, { fontSize: size * 0.35 }]}>
            {initials}
          </Text>
        )}
      </View>
    </View>
  );
};

const pulseStyles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    backgroundColor: PINK,
  },
  avatar: {
    backgroundColor: PINK,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadow.pinkButton,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  initials: {
    color: SURFACE,
    fontWeight: '800',
  },
});

// ===========================================================================
// 子组件: LIVE 徽章
// ===========================================================================

const LiveBadge: React.FC = () => {
  const blinkAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, {
          toValue: 0.3,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(blinkAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [blinkAnim]);

  return (
    <View style={liveStyles.badge}>
      <Animated.View style={[liveStyles.dot, { opacity: blinkAnim }]} />
      <Text style={liveStyles.text}>LIVE</Text>
    </View>
  );
};

const liveStyles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ERROR,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    gap: 5,
    ...shadow.card,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SURFACE,
  },
  text: {
    color: SURFACE,
    fontSize: fontSize.caption,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
});

// ===========================================================================
// 子组件: ETA 卡片
// ===========================================================================

interface EtaCardProps {
  eta: string;
  distance: string;
  arrived: boolean;
}

const EtaCard: React.FC<EtaCardProps> = ({ eta, distance, arrived }) => (
  <View style={etaStyles.card}>
    <View style={etaStyles.row}>
      <Ionicons name="time-outline" size={18} color={INFO} />
      <View style={etaStyles.textCol}>
        <Text style={etaStyles.value}>{arrived ? 'Arrived' : eta}</Text>
        <Text style={etaStyles.label}>{arrived ? 'Your technician is here!' : 'Estimated arrival'}</Text>
      </View>
    </View>
    <View style={etaStyles.divider} />
    <View style={etaStyles.row}>
      <Ionicons name="location-outline" size={18} color={MUTED} />
      <Text style={etaStyles.distance}>{distance} away</Text>
    </View>
  </View>
);

const etaStyles = StyleSheet.create({
  card: {
    backgroundColor: SURFACE,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginTop: -20,
    ...shadow.cardLg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  textCol: {
    flex: 1,
  },
  value: {
    fontSize: fontSize.large,
    fontWeight: '800',
    color: INK,
  },
  label: {
    fontSize: fontSize.small,
    color: MUTED,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: spacing.md,
  },
  distance: {
    fontSize: fontSize.body,
    color: MUTED,
    fontWeight: '600',
  },
});

// ===========================================================================
// 子组件: Journey Progress 时间线
// ===========================================================================

interface ProgressStepsProps {
  steps: JourneyStep[];
}

const ProgressSteps: React.FC<ProgressStepsProps> = ({ steps }) => (
  <View style={progressStyles.container}>
    <Text style={progressStyles.title}>Journey Progress</Text>
    {steps.map((step, i) => (
      <View key={i} style={progressStyles.step}>
        {/* 竖线 + 圆点 */}
        <View style={progressStyles.lineCol}>
          <View
            style={[
              progressStyles.dot,
              step.completed ? progressStyles.dotCompleted : step.active ? progressStyles.dotActive : progressStyles.dotPending,
            ]}
          >
            {step.completed && (
              <Ionicons name="checkmark" size={10} color={SURFACE} />
            )}
          </View>
          {i < steps.length - 1 && (
            <View
              style={[
                progressStyles.line,
                step.completed ? progressStyles.lineCompleted : progressStyles.linePending,
              ]}
            />
          )}
        </View>
        {/* 内容 */}
        <View style={progressStyles.stepContent}>
          <Text
            style={[
              progressStyles.stepLabel,
              (step.completed || step.active) && progressStyles.stepLabelActive,
            ]}
          >
            {step.label}
          </Text>
          <Text style={progressStyles.stepTime}>{step.time}</Text>
        </View>
      </View>
    ))}
  </View>
);

const progressStyles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  title: {
    fontSize: fontSize.medium,
    fontWeight: '700',
    color: INK,
    marginBottom: spacing.lg,
  },
  step: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    minHeight: 40,
  },
  lineCol: {
    alignItems: 'center',
    width: 24,
    marginRight: spacing.md,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCompleted: {
    backgroundColor: SUCCESS,
  },
  dotActive: {
    backgroundColor: PINK,
    borderWidth: 3,
    borderColor: PINK + '30',
  },
  dotPending: {
    backgroundColor: BORDER,
  },
  line: {
    width: 2,
    flex: 1,
    marginTop: 2,
  },
  lineCompleted: {
    backgroundColor: SUCCESS,
  },
  linePending: {
    backgroundColor: BORDER,
  },
  stepContent: {
    flex: 1,
    paddingBottom: spacing.sm,
  },
  stepLabel: {
    fontSize: fontSize.body,
    color: MUTED,
    fontWeight: '500',
  },
  stepLabelActive: {
    color: INK,
    fontWeight: '700',
  },
  stepTime: {
    fontSize: fontSize.small,
    color: MUTED,
    marginTop: 2,
  },
});

// ===========================================================================
// 主导出组件
// ===========================================================================

const LiveTrackingCard: React.FC<LiveTrackingCardProps> = ({
  technicianName,
  technicianAvatar,
  eta,
  distance,
  journeySteps,
  arrived = false,
  style,
  isLive = false,
}) => {
  return (
    <View style={[styles.container, style]}>
      {/* 地图背景区域 */}
      <View style={styles.mapArea}>
        {/* 装饰性网格线 */}
        <View style={styles.gridOverlay}>
          {[0, 1, 2, 3].map((i) => (
            <View key={`h${i}`} style={[styles.gridLine, { top: `${25 * i}%` }]} />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <View key={`v${i}`} style={[styles.gridLineV, { left: `${25 * i}%` }]} />
          ))}
        </View>

        {/* 技师头像 + LIVE 徽章 */}
        <View style={styles.trackingOverlay}>
          <View style={styles.avatarRow}>
            <PulsingAvatar name={technicianName} avatar={technicianAvatar} />
            {isLive ? (
              <LiveBadge />
            ) : (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#CBD5E1',
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 999,
                  gap: 5,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 }}>
                  CONNECTING…
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.techName}>{technicianName}</Text>
          <Text style={styles.techStatus}>
            {arrived ? 'Has arrived at your location' : 'On the way to you'}
          </Text>
        </View>
      </View>

      {/* ETA 卡片（浮动在地图下方） */}
      <EtaCard eta={eta} distance={distance} arrived={arrived} />

      {/* 行程进度步骤 */}
      {journeySteps.length > 0 && <ProgressSteps steps={journeySteps} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: SURFACE,
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadow.card,
  },
  mapArea: {
    backgroundColor: MAP_BG,
    height: 180,
    position: 'relative',
    overflow: 'hidden',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFill,
    opacity: 0.3,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#94A3B8',
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#94A3B8',
  },
  trackingOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xl,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  techName: {
    fontSize: fontSize.h3,
    fontWeight: '800',
    color: INK,
    marginTop: spacing.sm,
  },
  techStatus: {
    fontSize: fontSize.body,
    color: MUTED,
    fontWeight: '500',
    marginTop: 4,
  },
});

export { PulsingAvatar, LiveBadge, EtaCard, ProgressSteps };
export default LiveTrackingCard;
