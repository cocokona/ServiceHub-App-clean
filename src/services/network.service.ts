/**
 * network.service.ts — 网络状态监测服务
 *
 * 基于 @react-native-community/netinfo 实现：
 * - 在线/离线状态检测
 * - 网络类型识别（wifi/cellular/none）
 * - 200ms 防抖避免状态抖动
 * - 弱网环境检测（30s 内 3 次断开）
 * - 全局状态广播
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

export type NetworkStatus = 'online' | 'offline' | 'weak';

export interface NetworkInfo {
  status: NetworkStatus;
  isConnected: boolean;
  type: string; // 'wifi' | 'cellular' | 'none' | 'unknown'
  /** 是否为弱网（2G/3G） */
  isSlowConnection: boolean;
}

type NetworkListener = (info: NetworkInfo) => void;

// ---------------------------------------------------------------------------
// 弱网检测
// ---------------------------------------------------------------------------

const WEAK_NETWORK_WINDOW_MS = 30_000; // 30 秒窗口
const WEAK_NETWORK_DISCONNECT_THRESHOLD = 3; // 断开 3 次

let disconnectTimestamps: number[] = [];
let isWeakNetwork = false;

function recordDisconnect(): void {
  const now = Date.now();
  disconnectTimestamps.push(now);

  // 清理 30 秒窗口外的记录
  disconnectTimestamps = disconnectTimestamps.filter(
    (t) => now - t <= WEAK_NETWORK_WINDOW_MS,
  );

  // 判断弱网
  if (disconnectTimestamps.length >= WEAK_NETWORK_DISCONNECT_THRESHOLD) {
    isWeakNetwork = true;
  }
}

function recordConnect(): void {
  // 连接恢复后，清理断开记录
  const now = Date.now();
  disconnectTimestamps = disconnectTimestamps.filter(
    (t) => now - t <= WEAK_NETWORK_WINDOW_MS,
  );
  // 如果窗口内断开次数低于阈值，取消弱网标记
  if (disconnectTimestamps.length < WEAK_NETWORK_DISCONNECT_THRESHOLD) {
    isWeakNetwork = false;
  }
}

// ---------------------------------------------------------------------------
// 防抖
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 200;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// ---------------------------------------------------------------------------
// 状态管理
// ---------------------------------------------------------------------------

let currentNetworkInfo: NetworkInfo = {
  status: 'online',
  isConnected: true,
  type: 'unknown',
  isSlowConnection: false,
};

const listeners: Set<NetworkListener> = new Set();

function notifyListeners(): void {
  listeners.forEach((fn) => {
    try {
      fn({ ...currentNetworkInfo });
    } catch {
      // 监听器异常不应影响其他监听器
    }
  });
}

function updateState(info: NetworkInfo): void {
  currentNetworkInfo = info;
  notifyListeners();
}

// ---------------------------------------------------------------------------
// NetInfo 集成
// ---------------------------------------------------------------------------

function mapNetInfoToNetworkInfo(state: NetInfoState): NetworkInfo {
  const isConnected = state.isConnected ?? false;
  const type = state.type;

  // 判断是否慢速连接
  const isSlowConnection =
    isConnected &&
    (state.type === 'cellular') &&
    (state.details?.cellularGeneration === '2g' ||
      state.details?.cellularGeneration === '3g');

  let status: NetworkStatus = isConnected
    ? isSlowConnection
      ? 'weak'
      : 'online'
    : 'offline';

  // 如果之前被标记为弱网，保持一段时间
  if (isWeakNetwork && isConnected) {
    status = 'weak';
  }

  return {
    status,
    isConnected,
    type,
    isSlowConnection,
  };
}

function handleNetInfoChange(state: NetInfoState): void {
  // 200ms 防抖
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    const info = mapNetInfoToNetworkInfo(state);

    if (!info.isConnected) {
      recordDisconnect();
    } else {
      recordConnect();
    }

    const updatedInfo = {
      ...info,
      status: isWeakNetwork && info.isConnected ? 'weak' : info.status,
    } as NetworkInfo;

    updateState(updatedInfo);
  }, DEBOUNCE_MS);
}

// ---------------------------------------------------------------------------
// 初始化 & 清理
// ---------------------------------------------------------------------------

let unsubscribeNetInfo: (() => void) | null = null;

/**
 * 初始化网络监测服务。
 * 应在应用启动时调用一次。
 */
export async function initNetworkService(): Promise<void> {
  // 获取初始状态
  const initialState = await NetInfo.fetch();
  currentNetworkInfo = mapNetInfoToNetworkInfo(initialState);
  notifyListeners();

  // 订阅状态变化
  unsubscribeNetInfo = NetInfo.addEventListener(handleNetInfoChange);
}

/**
 * 销毁网络监测服务。
 */
export function destroyNetworkService(): void {
  if (unsubscribeNetInfo) {
    unsubscribeNetInfo();
    unsubscribeNetInfo = null;
  }
  listeners.clear();
}

// ---------------------------------------------------------------------------
// 公开 API
// ---------------------------------------------------------------------------

/**
 * 获取当前网络状态。
 */
export function getNetworkInfo(): NetworkInfo {
  return { ...currentNetworkInfo };
}

/**
 * 判断当前是否在线。
 */
export function isOnline(): boolean {
  return currentNetworkInfo.isConnected;
}

/**
 * 判断当前是否离线。
 */
export function isOffline(): boolean {
  return !currentNetworkInfo.isConnected;
}

/**
 * 判断当前是否为弱网。
 */
export function isWeak(): boolean {
  return currentNetworkInfo.status === 'weak';
}

/**
 * 订阅网络状态变化。
 * 返回取消订阅函数。
 */
export function subscribeNetwork(listener: NetworkListener): () => void {
  listeners.add(listener);

  // 立即推送当前状态
  try {
    listener({ ...currentNetworkInfo });
  } catch {
    // 忽略
  }

  return () => {
    listeners.delete(listener);
  };
}

/**
 * 手动刷新网络状态。
 */
export async function refreshNetworkStatus(): Promise<NetworkInfo> {
  const state = await NetInfo.fetch();
  const info = mapNetInfoToNetworkInfo(state);
  updateState(info);
  return info;
}
