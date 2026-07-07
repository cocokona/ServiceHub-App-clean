/**
 * useOfflineData.ts — 离线优先数据获取 Hook
 *
 * 统一封装三层缓存读取 + 后台同步 + 离线降级逻辑。
 *
 * 使用方式:
 * ```
 * const { data, isLoading, isOffline, source, refresh } = useOfflineData({
 *   key: 'jobs',
 *   fetchFn: () => database.fetchJobsByCustomer(userId),
 * });
 * ```
 *
 * 数据来源优先级：L1 Memory → L2 AsyncStorage → L3 Supabase
 * 离线时自动读取缓存（offlineFallback 决定降级策略）
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { CacheConfig, getCacheConfig, OfflineFallback } from '../services/cacheConfig';
import { cacheRead, cacheWrite } from '../services/cache.service';
import { subscribeNetwork, NetworkInfo } from '../services/network.service';
import { subscribeSync, SyncState } from '../services/sync.service';

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

export type DataSource = 'memory' | 'storage' | 'remote';

export interface UseOfflineDataOptions<T> {
  /** 缓存键（对应 cacheConfig.ts 中的注册 key） */
  key: string;
  /** 远程数据获取函数（当缓存未命中或需要刷新时调用） */
  fetchFn: () => Promise<T>;
  /** 是否为启用状态（默认 true） */
  enabled?: boolean;
  /** 是否在 mount 时自动获取（默认 true） */
  autoFetch?: boolean;
  /** 是否强制刷新（跳过缓存） */
  forceRefresh?: boolean;
  /** 自定义缓存配置（覆盖注册表默认值） */
  cacheConfig?: Partial<CacheConfig>;
  /** 轮询间隔（毫秒），0 表示不轮询 */
  pollingInterval?: number;
  /** 获取成功回调 */
  onSuccess?: (data: T) => void;
  /** 获取失败回调 */
  onError?: (error: Error) => void;
}

export interface UseOfflineDataReturn<T> {
  /** 当前数据 */
  data: T | null;
  /** 是否正在加载（首次） */
  isLoading: boolean;
  /** 是否正在后台刷新 */
  isRefreshing: boolean;
  /** 是否离线 */
  isOffline: boolean;
  /** 是否出现错误 */
  isError: boolean;
  /** 错误信息 */
  error: string | null;
  /** 数据来源 */
  source: DataSource | null;
  /** 手动刷新数据 */
  refresh: () => Promise<void>;
  /** 手动设置数据（同时写入缓存） */
  setData: (data: T) => Promise<void>;
  /** 同步状态 */
  syncStatus: SyncState['status'];
}

// ---------------------------------------------------------------------------
// 默认值
// ---------------------------------------------------------------------------

const DEFAULT_OPTIONS = {
  enabled: true,
  autoFetch: true,
  forceRefresh: false,
  pollingInterval: 0,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOfflineData<T>(options: UseOfflineDataOptions<T>): UseOfflineDataReturn<T> {
  const {
    key,
    fetchFn,
    enabled = DEFAULT_OPTIONS.enabled,
    autoFetch = DEFAULT_OPTIONS.autoFetch,
    forceRefresh = DEFAULT_OPTIONS.forceRefresh,
    cacheConfig,
    pollingInterval = DEFAULT_OPTIONS.pollingInterval,
    onSuccess,
    onError,
  } = options;

  // 状态
  const [data, setDataState] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(autoFetch && enabled);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<DataSource | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncState['status']>('idle');

  // Refs for cleanup
  const mountedRef = useRef(true);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  // 缓存配置
  const config = { ...getCacheConfig(key), ...cacheConfig };
  const offlineFallback: OfflineFallback = cacheConfig?.offlineFallback ?? config.offlineFallback;

  // ---------------------------------------------------------------------------
  // 核心数据获取函数
  // ---------------------------------------------------------------------------

  const fetchData = useCallback(
    async (isRefresh = false) => {
      if (!enabled || !mountedRef.current) return;

      if (!isRefresh) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setIsError(false);
      setError(null);

      try {
        // 检查网络状态
        const networkUnsub = subscribeNetwork((info: NetworkInfo) => {
          if (mountedRef.current) {
            setIsOffline(!info.isConnected);
          }
        });

        // 如果离线，根据 offlineFallback 策略处理
        const isCurrentlyOffline = !(await import('../services/network.service').then((m) =>
          m.isOnline(),
        ));

        if (isCurrentlyOffline) {
          // 尝试读取 L2 缓存
          const cached = await cacheRead<T>(key, fetchFnRef.current, {
            forceRefresh: false,
            backgroundRefresh: false,
            config: cacheConfig,
          });

          if (cached.data) {
            setDataState(cached.data);
            setSource(cached.source);
            setIsLoading(false);
            setIsRefreshing(false);
            onSuccess?.(cached.data);
          } else {
            // 缓存未命中，按降级策略处理
            handleOfflineFallback(offlineFallback);
          }

          networkUnsub();
          return;
        }

        networkUnsub();

        // 在线：三层缓存读取
        const result = await cacheRead<T>(key, fetchFnRef.current, {
          forceRefresh: forceRefresh || isRefresh,
          backgroundRefresh: true,
          config: cacheConfig,
        });

        if (mountedRef.current) {
          setDataState(result.data);
          setSource(result.source);
          setIsLoading(false);
          setIsRefreshing(false);
          setIsError(false);
          setError(null);
          onSuccess?.(result.data);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);

        if (mountedRef.current) {
          setIsError(true);
          setError(message);
          setIsLoading(false);
          setIsRefreshing(false);
          onError?.(err instanceof Error ? err : new Error(message));

          // 错误时尝试读缓存兜底
          try {
            const fallback = await cacheRead<T>(key, fetchFnRef.current, {
              forceRefresh: false,
              backgroundRefresh: false,
              config: cacheConfig,
            });
            if (fallback.data && fallback.source !== 'remote') {
              setDataState(fallback.data);
              setSource(fallback.source);
            }
          } catch {
            // 兜底失败，保持错误状态
          }
        }
      }
    },
    [key, enabled, forceRefresh, cacheConfig, offlineFallback, onSuccess, onError],
  );

  // 降级处理
  const handleOfflineFallback = (fallback: OfflineFallback) => {
    switch (fallback) {
      case 'cache':
        // 已尝试过缓存（上面逻辑），无需额外处理
        setIsLoading(false);
        setIsRefreshing(false);
        break;
      case 'placeholder':
        setDataState(null);
        setIsLoading(false);
        setIsRefreshing(false);
        setError('当前离线，暂无缓存数据');
        break;
      case 'empty':
        setDataState(null);
        setIsLoading(false);
        setIsRefreshing(false);
        break;
    }
  };

  // ---------------------------------------------------------------------------
  // 初始化加载
  // ---------------------------------------------------------------------------

  useEffect(() => {
    mountedRef.current = true;

    if (autoFetch) {
      fetchData(false);
    }

    return () => {
      mountedRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // 轮询
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (pollingInterval > 0 && enabled) {
      pollingRef.current = setInterval(() => {
        fetchData(true);
      }, pollingInterval);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [pollingInterval, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // 订阅同步状态
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const unsub = subscribeSync((state: SyncState) => {
      if (mountedRef.current) {
        setSyncStatus(state.status);
      }
    });
    return unsub;
  }, []);

  // ---------------------------------------------------------------------------
  // 公开方法
  // ---------------------------------------------------------------------------

  const refresh = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  const setData = useCallback(
    async (newData: T) => {
      setDataState(newData);
      await cacheWrite(key, newData, cacheConfig);
    },
    [key, cacheConfig],
  );

  return {
    data,
    isLoading,
    isRefreshing,
    isOffline,
    isError,
    error,
    source,
    refresh,
    setData,
    syncStatus,
  };
}
