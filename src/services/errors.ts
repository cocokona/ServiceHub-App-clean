/**
 * errors.ts — Centralized database error handling.
 *
 * Every data-layer method used to do `if (error) throw new Error(error.message)`
 * inline, which (a) scattered error handling, (b) lost structured context, and
 * (c) made failures hard to trace. This module centralizes that logic.
 *
 * IMPORTANT — interface compatibility: callers catch thrown `Error` objects by
 * their `.message`. To keep the external interface behavior 100% identical we
 * still throw a plain `Error` whose message equals the original Supabase error
 * message. We only *add* structured logging and (optionally) friendly mapping
 * for specific SQL states. No signature or thrown-type change for consumers.
 */

import { logger } from './logger';

export interface DbErrorLike {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

function toDbError(error: unknown): DbErrorLike {
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    return {
      message: typeof e.message === 'string' ? e.message : undefined,
      code: typeof e.code === 'string' ? e.code : undefined,
      details: typeof e.details === 'string' ? e.details : undefined,
      hint: typeof e.hint === 'string' ? e.hint : undefined,
    };
  }
  if (typeof error === 'string') return { message: error };
  return { message: 'Unknown database error' };
}

/**
 * Logs a database error with operation + structured context, then re-throws a
 * plain `Error` carrying the same message. This keeps the caller contract
 * unchanged while making every failure observable and traceable.
 */
export function logAndThrow(operation: string, error: unknown): never {
  const dbErr = toDbError(error);
  logger.error(`[db:${operation}] database operation failed`, {
    code: dbErr.code,
    details: dbErr.details,
    hint: dbErr.hint,
  });
  throw new Error(dbErr.message || 'Database operation failed');
}

/**
 * True for Postgres foreign-key-violation errors (SQLSTATE 23503).
 * Used by the data layer to translate a raw constraint violation into a
 * friendly, actionable message instead of leaking the DB error upstream.
 */
export function isForeignKeyViolation(error: unknown): boolean {
  return toDbError(error).code === '23503';
}
