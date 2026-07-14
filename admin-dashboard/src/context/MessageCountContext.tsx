import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

// ---------------------------------------------------------------------------
// Unread (newly received) message counter for the Admin Console.
//
// The inbox badge must reflect ONLY messages that arrived live (while the
// admin was NOT looking at the inbox) — never a hardcoded number and never
// historical rows. This context:
//   - subscribes to INSERTs on `messages` via Supabase Realtime,
//   - increments only for incoming messages (sender_role != 'support'),
//   - pauses counting while the inbox is open (the admin is reading them),
//   - exposes markRead() to clear the count when the inbox is opened.
// ---------------------------------------------------------------------------

interface MessageCountValue {
  /** Number of newly received (unread) messages this session. Starts at 0. */
  count: number;
  /** Clear the counter (call when the inbox is opened). */
  markRead: () => void;
  /** Tell the provider the inbox is open/closed so it can pause counting. */
  setInboxOpen: (open: boolean) => void;
}

const MessageCountContext = createContext<MessageCountValue | null>(null);

export function MessageCountProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [inboxOpen, setInboxOpen] = useState(false);

  // Refs so the realtime callback always reads fresh values without
  // re-subscribing on every render.
  const countRef = useRef(count);
  const inboxOpenRef = useRef(inboxOpen);
  useEffect(() => {
    countRef.current = count;
  }, [count]);
  useEffect(() => {
    inboxOpenRef.current = inboxOpen;
  }, [inboxOpen]);

  useEffect(() => {
    // Only subscribe once a session exists (RLS scopes messages to the admin).
    if (!user) return;

    const channel = supabase
      .channel('admin-inbox-unread')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload: { new?: { sender_role?: string } }) => {
          const role = payload?.new?.sender_role;
          // Count only messages received FROM others (not the admin's own sends).
          // And only when the inbox isn't currently open (the admin is reading).
          if (role && role !== 'support' && !inboxOpenRef.current) {
            setCount((c) => c + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const markRead = useCallback(() => setCount(0), []);

  return (
    <MessageCountContext.Provider value={{ count, markRead, setInboxOpen }}>
      {children}
    </MessageCountContext.Provider>
  );
}

export function useMessageCount(): MessageCountValue {
  const ctx = useContext(MessageCountContext);
  if (!ctx) {
    throw new Error('useMessageCount must be used within a MessageCountProvider');
  }
  return ctx;
}
