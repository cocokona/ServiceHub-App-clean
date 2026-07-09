/**
 * logger.ts — Structured, leveled logging for the service layer.
 *
 * Design goals:
 * - Single, consistent entry point for all logging (replaces scattered
 *   console.* calls that were impossible to route or test).
 * - Context + traceId aware so key operations and failures are traceable
 *   end-to-end (requirement: "改进日志记录，确保关键操作和错误信息可追溯").
 * - Pluggable sink: defaults to the console (React Native safe), but tests
 *   can swap in an in-memory sink to assert on log output.
 * - Never throws — a logging failure must never break a business operation.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface LogMeta {
  [key: string]: unknown;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  context: Record<string, unknown>;
  timestamp: string;
  traceId?: string;
}

export type LogSink = (entry: LogEntry) => void;

function defaultConsoleSink(entry: LogEntry): void {
  const tag = entry.traceId ? `[${entry.traceId}]` : '';
  const ctx =
    Object.keys(entry.context).length > 0
      ? ' ' + safeStringify(entry.context)
      : '';
  const line = `${entry.timestamp} ${entry.level.toUpperCase()} ${tag} ${entry.message}${ctx}`;

  // Route to the matching console method so levels are visually distinct.
  switch (entry.level) {
    case 'error':
      // eslint-disable-next-line no-console
      console.error(line);
      break;
    case 'warn':
      // eslint-disable-next-line no-console
      console.warn(line);
      break;
    default:
      // eslint-disable-next-line no-console
      console.log(line);
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}

class Logger {
  private minLevel: LogLevel = 'debug';
  private sink: LogSink;
  private context: Record<string, unknown>;
  private traceId?: string;

  constructor(opts?: {
    sink?: LogSink;
    context?: Record<string, unknown>;
    traceId?: string;
  }) {
    this.sink = opts?.sink ?? defaultConsoleSink;
    this.context = opts?.context ?? {};
    this.traceId = opts?.traceId;
  }

  /** Returns a child logger that inherits this logger's sink/level but merges
   *  additional context and an optional trace id. Used to correlate a logical
   *  operation across multiple internal calls. */
  child(context: Record<string, unknown>, traceId?: string): Logger {
    return new Logger({
      sink: this.sink,
      context: { ...this.context, ...context },
      traceId: traceId ?? this.traceId,
    });
  }

  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /** Swap the output sink (primarily used by tests). */
  setSink(sink: LogSink): void {
    this.sink = sink;
  }

  debug(message: string, meta?: LogMeta): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: LogMeta): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: LogMeta): void {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: LogMeta): void {
    this.log('error', message, meta);
  }

  private log(level: LogLevel, message: string, meta?: LogMeta): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) return;
    try {
      this.sink({
        level,
        message,
        context: { ...this.context, ...(meta ?? {}) },
        timestamp: new Date().toISOString(),
        traceId: this.traceId,
      });
    } catch {
      // Logging must never break the caller.
    }
  }
}

/** Application-wide default logger instance. */
export const logger = new Logger();

/** Generates a short, process-unique trace id for correlating log lines. */
export function generateTraceId(): string {
  return Math.random().toString(36).slice(2, 10);
}
