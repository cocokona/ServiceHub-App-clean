/**
 * TimerWidget.tsx — 演示组件：基于时间戳锚点的持久化计时器
 *
 * 直接放进任意屏幕即可使用。计时在息屏 / 后台 / 进程被杀后重新打开时，
 * 都能从保存的起始时间戳准确续算，无需任何额外处理。
 *
 * 示例：
 *   <TimerWidget mode="stopwatch" />
 *   <TimerWidget mode="countdown" durationMs={10 * 60 * 1000} onComplete={...} />
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { usePersistentTimer } from '../hooks/usePersistentTimer';
import { formatDuration } from '../services/timer.service';
import {
  PINK,
  PINK_SOFT,
  SURFACE,
  MUTED,
  BORDER,
  SUCCESS,
} from '../theme/colors';

interface TimerWidgetProps {
  mode: 'stopwatch' | 'countdown';
  /** countdown 总时长 (ms) */
  durationMs?: number;
  /** 自定义持久化 id；不传则按 mode 生成 */
  id?: string;
  /** 倒计时归零时触发一次 */
  onComplete?: () => void;
}

const TimerWidget: React.FC<TimerWidgetProps> = ({
  mode,
  durationMs,
  id,
  onComplete,
}) => {
  const timer = usePersistentTimer({
    id: id ?? `widget-${mode}`,
    mode,
    durationMs,
    onComplete,
  });

  const display =
    mode === 'countdown'
      ? formatDuration(timer.remainingMs)
      : formatDuration(timer.elapsedMs);
  const progress = mode === 'countdown' ? timer.progress : 0;
  const finished = timer.isFinished;

  return (
    <View style={styles.card}>
      <Text style={styles.mode}>{mode === 'countdown' ? '倒计时' : '秒表'}</Text>
      <Text style={[styles.time, finished && styles.timeFinished]}>{display}</Text>

      {mode === 'countdown' && (
        <View style={styles.track}>
          <View
            style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]}
          />
        </View>
      )}

      <View style={styles.row}>
        {!timer.isRunning ? (
          <TouchableOpacity style={styles.btnPrimary} onPress={timer.start}>
            <Text style={styles.btnText}>
              {timer.isPaused ? '继续' : '开始'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.btnOutline} onPress={timer.pause}>
            <Text style={styles.btnTextOutline}>暂停</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.btnGhost} onPress={timer.reset}>
          <Text style={styles.btnTextGhost}>重置</Text>
        </TouchableOpacity>
      </View>

      {finished && <Text style={styles.done}>已完成</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  mode: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  time: {
    color: PINK,
    fontSize: 44,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  timeFinished: {
    color: SUCCESS,
  },
  track: {
    width: '100%',
    height: 8,
    backgroundColor: PINK_SOFT,
    borderRadius: 4,
    marginTop: 12,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: PINK,
    borderRadius: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  btnPrimary: {
    backgroundColor: PINK,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 999,
  },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: PINK,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 999,
  },
  btnGhost: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
  },
  btnText: {
    color: SURFACE,
    fontSize: 16,
    fontWeight: '700',
  },
  btnTextOutline: {
    color: PINK,
    fontSize: 16,
    fontWeight: '700',
  },
  btnTextGhost: {
    color: MUTED,
    fontSize: 16,
    fontWeight: '700',
  },
  done: {
    marginTop: 12,
    color: SUCCESS,
    fontWeight: '700',
  },
});

export default TimerWidget;
