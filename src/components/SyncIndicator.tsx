/**
 * SyncIndicator.tsx — 同步状态指示器组件
 *
 * 支持四种视觉状态：
 * - 同步中: 顶部蓝色横幅 + 旋转动画
 * - 同步完成: 绿色 Toast（2秒自动消失）
 * - 同步失败: 红色弹窗 + 重试按钮
 * - 离线模式: 灰色横幅 + 离线图标
 *
 * 三种展示位置：
 * - 顶部横幅 (banner)
 * - 列表底部指示器 (bottom)
 * - 卡片状态圆点 (dot)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Animated,
  Easing,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react-native';
import {
  subscribeSync,
  triggerManualSync,
  SyncState,
  SyncStatus,
} from '../services/sync.service';
import { subscribeNetwork, NetworkInfo } from '../services/network.service';

// ---------------------------------------------------------------------------
// 设计规范颜色
// ---------------------------------------------------------------------------

const COLORS = {
  syncing: '#014DB2', // 蓝色
  completed: '#22C55E', // 绿色
  failed: '#EF4444', // 红色
  offline: '#F0F0F0', // 灰色背景
  offlineText: '#666666',
  toastBg: '#FFFFFF',
  dotSyncing: '#014DB2',
  dotCompleted: '#22C55E',
  dotPending: '#CCCCCC',
} as const;

// ---------------------------------------------------------------------------
// 旋转动画 Hook
// ---------------------------------------------------------------------------

function useRotateAnimation(isActive: boolean) {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isActive) {
      const loop = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      loop.start();
      return () => loop.stop();
    } else {
      rotateAnim.setValue(0);
    }
  }, [isActive, rotateAnim]);

  return rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
}

// ---------------------------------------------------------------------------
// 子组件: 顶部同步横幅
// ---------------------------------------------------------------------------

interface SyncBannerProps {
  syncState: SyncState;
  networkInfo: NetworkInfo;
  onRetry: () => void;
  onDismiss: () => void;
}

const SyncBanner: React.FC<SyncBannerProps> = ({
  syncState,
  networkInfo,
  onRetry,
  onDismiss,
}) => {
  const rotate = useRotateAnimation(syncState.status === 'syncing');

  // 离线横幅
  if (!networkInfo.isConnected) {
    return (
      <View style={[bannerStyles.container, bannerStyles.offlineContainer]}>
        <WifiOff size={14} color={COLORS.offlineText} style={bannerStyles.icon} />
        <Text style={bannerStyles.offlineText}>当前离线 · 显示缓存数据</Text>
      </View>
    );
  }

  // 同步中横幅
  if (syncState.status === 'syncing') {
    return (
      <View style={[bannerStyles.container, bannerStyles.syncingContainer]}>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <RefreshCw size={14} color="#FFFFFF" style={bannerStyles.icon} />
        </Animated.View>
        <Text style={bannerStyles.syncingText}>
          同步中{ syncState.currentSyncKey ? ` · ${syncState.currentSyncKey}` : '' }...
        </Text>
      </View>
    );
  }

  // 同步失败横幅
  if (syncState.status === 'failed') {
    return (
      <View style={[bannerStyles.container, bannerStyles.failedContainer]}>
        <AlertCircle size={14} color="#FFFFFF" style={bannerStyles.icon} />
        <Text style={bannerStyles.failedText}>同步失败</Text>
        <TouchableOpacity onPress={onRetry} style={bannerStyles.retryBtn}>
          <Text style={bannerStyles.retryText}>重试</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDismiss} style={bannerStyles.dismissBtn}>
          <X size={12} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>
    );
  }

  return null;
};

const bannerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  syncingContainer: {
    backgroundColor: COLORS.syncing,
  },
  failedContainer: {
    backgroundColor: COLORS.failed,
  },
  offlineContainer: {
    backgroundColor: COLORS.offline,
  },
  icon: {
    marginRight: 6,
  },
  syncingText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
  failedText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
  offlineText: {
    color: COLORS.offlineText,
    fontSize: 13,
    fontWeight: '500',
  },
  retryBtn: {
    marginLeft: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  dismissBtn: {
    marginLeft: 8,
    padding: 4,
  },
});

// ---------------------------------------------------------------------------
// 子组件: 同步完成 Toast
// ---------------------------------------------------------------------------

const SyncToast: React.FC<{ visible: boolean; onDismiss: () => void }> = ({
  visible,
  onDismiss,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.delay(1800),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => onDismiss());
    }
  }, [visible, opacity, onDismiss]);

  if (!visible) return null;

  return (
    <Animated.View style={[toastStyles.container, { opacity }]}>
      <CheckCircle2 size={16} color={COLORS.completed} />
      <Text style={toastStyles.text}>数据已同步</Text>
    </Animated.View>
  );
};

const toastStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.toastBg,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  text: {
    marginLeft: 8,
    fontSize: 14,
    color: '#333333',
    fontWeight: '500',
  },
});

// ---------------------------------------------------------------------------
// 子组件: 底部加载指示器
// ---------------------------------------------------------------------------

interface BottomIndicatorProps {
  isLoading: boolean;
  hasMore: boolean;
}

const BottomIndicator: React.FC<BottomIndicatorProps> = ({
  isLoading,
  hasMore,
}) => {
  if (!isLoading && !hasMore) return null;

  return (
    <View style={bottomStyles.container}>
      {isLoading ? (
        <Animated.View>
          <RefreshCw
            size={16}
            color={COLORS.syncing}
            style={{ transform: [{ rotate: '45deg' }] }}
          />
        </Animated.View>
      ) : (
        <View style={bottomStyles.line}>
          <View style={bottomStyles.dot} />
          <View style={[bottomStyles.dot, { opacity: 0.5 }]} />
          <View style={[bottomStyles.dot, { opacity: 0.3 }]} />
        </View>
      )}
      <Text style={bottomStyles.text}>
        {isLoading ? '加载中...' : '没有更多数据'}
      </Text>
    </View>
  );
};

const bottomStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.syncing,
  },
  text: {
    fontSize: 13,
    color: '#999999',
  },
});

// ---------------------------------------------------------------------------
// 子组件: 卡片状态圆点
// ---------------------------------------------------------------------------

interface StatusDotProps {
  /** syncing | synced | pending */
  status: 'syncing' | 'synced' | 'pending';
}

const StatusDot: React.FC<StatusDotProps> = ({ status }) => {
  const colors: Record<string, string> = {
    syncing: COLORS.dotSyncing,
    synced: COLORS.dotCompleted,
    pending: COLORS.dotPending,
  };

  return (
    <View
      style={[
        dotStyles.dot,
        { backgroundColor: colors[status] },
      ]}
    />
  );
};

const dotStyles = StyleSheet.create({
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

// ---------------------------------------------------------------------------
// 主导出组件: 位置适配的 SyncIndicator
// ---------------------------------------------------------------------------

interface SyncIndicatorProps {
  /** 展示位置 */
  position: 'banner' | 'bottom' | 'dot';
  /** [dot] 同步状态 */
  dotStatus?: 'syncing' | 'synced' | 'pending';
  /** [bottom] 是否正在加载更多 */
  isLoadingMore?: boolean;
  /** [bottom] 是否还有更多数据 */
  hasMore?: boolean;
}

const SyncIndicator: React.FC<SyncIndicatorProps> = ({
  position,
  dotStatus = 'pending',
  isLoadingMore = false,
  hasMore = true,
}) => {
  const [syncState, setSyncState] = useState<SyncState>({
    status: 'idle',
    lastSyncAt: null,
    queueSize: 0,
    isOnline: true,
    currentSyncKey: null,
    progress: 0,
    error: null,
  });
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo>({
    status: 'online',
    isConnected: true,
    type: 'unknown',
    isSlowConnection: false,
  });
  const [showToast, setShowToast] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    const unsubSync = subscribeSync((state) => {
      setSyncState(state);
      // 同步完成时显示 Toast
      if (state.status === 'completed') {
        setShowToast(true);
      }
    });
    const unsubNet = subscribeNetwork(setNetworkInfo);
    return () => {
      unsubSync();
      unsubNet();
    };
  }, []);

  const handleRetry = useCallback(() => {
    triggerManualSync();
    setBannerDismissed(false);
  }, []);

  const handleDismissBanner = useCallback(() => {
    setBannerDismissed(true);
  }, []);

  const handleDismissToast = useCallback(() => {
    setShowToast(false);
  }, []);

  // 按 position 渲染不同子组件
  if (position === 'banner') {
    if (bannerDismissed) return null;
    return (
      <>
        <SyncBanner
          syncState={syncState}
          networkInfo={networkInfo}
          onRetry={handleRetry}
          onDismiss={handleDismissBanner}
        />
        <SyncToast visible={showToast} onDismiss={handleDismissToast} />
      </>
    );
  }

  if (position === 'bottom') {
    return (
      <BottomIndicator
        isLoading={isLoadingMore}
        hasMore={hasMore}
      />
    );
  }

  if (position === 'dot') {
    return <StatusDot status={dotStatus} />;
  }

  return null;
};

// 导出子组件供独立使用
export { SyncBanner, SyncToast, BottomIndicator, StatusDot };
export default SyncIndicator;
