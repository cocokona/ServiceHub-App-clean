/**
 * useNetworkStatus.ts — 网络状态 Hook
 *
 * 封装 network.service.ts，提供 React 友好的订阅接口。
 */

import { useState, useEffect, useCallback } from 'react';
import {
  NetworkInfo,
  subscribeNetwork,
  refreshNetworkStatus,
  isOnline,
  isOffline,
  isWeak,
} from '../services/network.service';

export interface UseNetworkStatusReturn {
  /** 当前网络信息 */
  networkInfo: NetworkInfo;
  /** 是否在线 */
  online: boolean;
  /** 是否离线 */
  offline: boolean;
  /** 是否为弱网 */
  weak: boolean;
  /** 网络类型 */
  type: string;
  /** 手动刷新网络状态 */
  refresh: () => Promise<NetworkInfo>;
}

/**
 * 订阅网络状态变化的 Hook。
 */
export function useNetworkStatus(): UseNetworkStatusReturn {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo>({
    status: 'online',
    isConnected: true,
    type: 'unknown',
    isSlowConnection: false,
  });

  useEffect(() => {
    const unsubscribe = subscribeNetwork(setNetworkInfo);
    return unsubscribe;
  }, []);

  const refresh = useCallback(async () => {
    const info = await refreshNetworkStatus();
    return info;
  }, []);

  return {
    networkInfo,
    online: networkInfo.isConnected,
    offline: !networkInfo.isConnected,
    weak: networkInfo.status === 'weak',
    type: networkInfo.type,
    refresh,
  };
}

/**
 * 非 Hook 版本的即时检查快照（已初始化前提下）。
 */
export { isOnline, isOffline, isWeak };
