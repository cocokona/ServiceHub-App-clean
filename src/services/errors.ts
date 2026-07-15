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
  // IMPORTANT: include the real `message` in BOTH the log line and the
  // structured context. The previous version only logged code/details/hint,
  // which dropped the actionable text and surfaced as "[object Object]" in
  // the console. Consumers still catch a plain Error with the same message.
  logger.error(`[db:${operation}] ${dbErr.message || 'database operation failed'}`, {
    message: dbErr.message,
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

/**
 * True for Postgres unique-violation errors (SQLSTATE 23505).
 * Used by the data layer to translate a raw constraint violation (e.g. a
 * customer submitting two reviews for the same job, which violates the
 * UNIQUE(job_id) index on `reviews`) into a friendly, actionable message.
 */
export function isUniqueViolation(error: unknown): boolean {
  return toDbError(error).code === '23505';
}

/**
 * True for PostgREST schema-cache misses (error code PGRST204:
 * "Could not find the 'X' column of 'Y' in the schema cache").
 *
 * This happens when a column was added to the database (e.g. by a migration)
 * but PostgREST's cached introspection hasn't been refreshed yet
 * (`NOTIFY pgrst, 'reload schema';`). The column DOES exist in Postgres — the
 * REST layer just doesn't know about it yet. The data layer uses this to
 * retry an insert with the offending optional column omitted so a stale cache
 * never blocks a user action. Run `NOTIFY pgrst, 'reload schema';` (or the
 * remediation script) to clear it permanently.
 */
export function isSchemaCacheMiss(error: unknown): boolean {
  return toDbError(error).code === 'PGRST204';
}
