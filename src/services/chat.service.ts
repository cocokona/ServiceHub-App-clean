/**
 * chat.service.ts — Real-time chat data layer for the mobile app.
 *
 * Replaces the previous mock-only SupportChat. Every message is persisted to
 * the shared Supabase `messages` table (the same one the admin console reads),
 * so a conversation opened from a profile page is genuinely "connected to the
 * admin panel".
 *
 * Two conversation shapes are supported:
 *   - Job chat:   messages where `job_id` is set (opened from Tracking / JobDetails).
 *   - Support chat: messages where `support_thread_id` is set (opened from the
 *                  profile-page "Contact support" button, with no job).
 *
 * RLS (see supabase/migrations/00018_support_threads.sql) guarantees a user can
 * only read/write their own thread, while admins can see and reply to all.
 */

import { supabase } from '../lib/supabase';
import { logger } from './logger';
import type { Message, User } from '../types';

/** A support conversation not tied to a job. */
export interface SupportThread {
  id: string;
  user_id: string;
  user_role: 'customer' | 'technician';
  subject: string | null;
  status: 'open' | 'resolved' | 'closed';
  created_at: string;
  updated_at: string;
}

/** Raw row shape returned by Supabase for the `messages` table. */
interface DbMessageRow {
  id: string;
  job_id: string | null;
  support_thread_id: string | null;
  sender_id: string | null;
  sender_role: 'customer' | 'technician' | 'support' | 'system';
  sender_name: string | null;
  content: string;
  created_at: string;
}

/** Either a job conversation or a support-thread conversation. */
export interface ChatTarget {
  jobId?: string | null;
  threadId?: string | null;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Resolve the *authenticated* user id that Row Level Security evaluates
 * against (`auth.uid()`), rather than trusting the app-level `user.id` which
 * can be restored from stale `AsyncStorage` and diverge from the live
 * session. RLS policies on `messages` / `support_threads` gate writes on
 * `auth.uid()`, so sending `user.id` here is what caused
 * "new row violates row-level security policy" when the two ids disagreed
 * (the SELECT succeeded because it only checks participation, the INSERT
 * additionally requires `sender_id = auth.uid()`).
 *
 * Falls back to `fallback` when no live session is reachable (e.g. unit
 * tests), so callers keep working if the session can't be read.
 */
async function resolveAuthUserId(fallback: string): Promise<string> {
  try {
    const auth = (supabase as unknown as { auth?: { getUser?: () => Promise<{ data?: { user?: { id?: string } } }> } }).auth;
    if (auth && typeof auth.getUser === 'function') {
      const { data } = await auth.getUser();
      if (data?.user?.id) return data.user.id;
    }
  } catch {
    // Session can't be read right now — use the provided id as a fallback.
  }
  return fallback;
}

/** Map a DB row to the UI-facing `Message` type used by SupportChat. */
function toUiMessage(r: DbMessageRow): Message {
  const role = r.sender_role;
  const fallbackName =
    role === 'support' ? 'Support' : role === 'system' ? 'System' : 'User';
  return {
    id: r.id,
    sender: role,
    senderName: r.sender_name || fallbackName,
    content: r.content,
    timestamp: formatTime(r.created_at),
  };
}

/**
 * Find the user's open support thread, creating one if none exists. A user is
 * limited to a single open thread so the admin sees one tidy conversation per
 * person (resolved threads are ignored when re-opening).
 */
export async function getOrCreateSupportThread(user: User): Promise<SupportThread> {
  // Always gate the thread on the live session id (see resolveAuthUserId).
  const authUserId = await resolveAuthUserId(user.id);

  const { data: existing, error: selErr } = await supabase
    .from('support_threads')
    .select('*')
    .eq('user_id', authUserId)
    .eq('status', 'open')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selErr) {
    logger.error('[chat.service] getOrCreateSupportThread select failed', {
      error: selErr.message,
    });
    throw selErr;
  }
  if (existing) return existing as SupportThread;

  const { data: created, error: insErr } = await supabase
    .from('support_threads')
    .insert({
      user_id: authUserId,
      user_role: user.role,
      subject: null,
      status: 'open',
    })
    .select()
    .single();

  if (insErr) {
    logger.error('[chat.service] getOrCreateSupportThread insert failed', {
      error: insErr.message,
    });
    throw insErr;
  }
  return created as SupportThread;
}

/** Load the full message history for a job or support thread. */
export async function fetchMessages(target: ChatTarget): Promise<Message[]> {
  let query = supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: true });

  if (target.jobId) query = query.eq('job_id', target.jobId);
  else if (target.threadId) query = query.eq('support_thread_id', target.threadId);
  else return [];

  const { data, error } = await query;
  if (error) {
    logger.error('[chat.service] fetchMessages failed', { error: error.message, target });
    throw error;
  }
  return ((data as DbMessageRow[]) ?? []).map(toUiMessage);
}

/**
 * Subscribe to live INSERTs for a job or support thread. Returns an
 * unsubscribe function. Duplicate deliveries (same id) are filtered by the
 * caller, so this just forwards every new row as a UI message.
 */
export function subscribeMessages(
  target: ChatTarget,
  onMessage: (message: Message) => void
): () => void {
  const filterKey = target.jobId
    ? `job_id=eq.${target.jobId}`
    : `support_thread_id=eq.${target.threadId}`;

  const channelName = `chat-${target.jobId || target.threadId}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: filterKey,
      },
      (payload: any) => {
        if (payload?.new) onMessage(toUiMessage(payload.new));
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export interface MessageSender {
  senderId: string;
  senderRole: 'customer' | 'technician' | 'support';
  senderName: string;
}

/**
 * Persist a message and return the stored row mapped to a UI message. We
 * `.select().single()` so the caller can append the authoritative record
 * immediately (optimistic + dedupe friendly).
 */
export async function sendMessage(
  target: ChatTarget,
  sender: MessageSender,
  content: string
): Promise<Message> {
  // RLS evaluates `sender_id = auth.uid()`, so use the live session id — not
  // the potentially-stale AppContext `user.id` — to avoid an RLS violation.
  const authUserId = await resolveAuthUserId(sender.senderId);

  const { data, error } = await supabase
    .from('messages')
    .insert({
      job_id: target.jobId ?? null,
      support_thread_id: target.threadId ?? null,
      sender_id: authUserId,
      sender_role: sender.senderRole,
      sender_name: sender.senderName,
      content,
    })
    .select()
    .single();

  if (error) {
    logger.error('[chat.service] sendMessage failed', { error: error.message, target });
    throw error;
  }
  return toUiMessage(data as DbMessageRow);
}
