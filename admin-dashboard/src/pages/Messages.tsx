import { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Search, Phone, Video, MoreVertical, ArrowLeft, Circle, MessagesSquare, Headset } from 'lucide-react';
import Card from '../components/ui/Card';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '../hooks/useQuery';
import {
  getConversations,
  getMessages,
  subscribeMessages,
  sendMessage,
  getSupportThreads,
  getSupportMessages,
  subscribeSupportMessages,
  sendSupportMessage,
} from '../data/queries';
import type { ChatMessage, Conversation, SupportThread } from '../data/types';
import { LoadingBlock, ErrorState, EmptyState } from '../components/feedback/States';
import { useMessageCount } from '../context/MessageCountContext';
import { cn, formatTime, formatDay, initials } from '../lib/utils';

type View = 'jobs' | 'support';

export default function Messages() {
  const { user } = useAuth();
  const { markRead, setInboxOpen } = useMessageCount();
  const convosQ = useQuery(getConversations, []);
  const supportQ = useQuery(getSupportThreads, []);

  // Opening the inbox clears the unread counter and pauses new-message counting
  // until the user leaves. Closing the inbox resumes counting.
  useEffect(() => {
    setInboxOpen(true);
    markRead();
    return () => setInboxOpen(false);
  }, [setInboxOpen, markRead]);

  const [view, setView] = useState<View>('jobs');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeSupportId, setActiveSupportId] = useState<string | null>(null);
  const activeId = view === 'jobs' ? activeJobId : activeSupportId;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [msgError, setMsgError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Default to the first conversation/thread of the active view.
  useEffect(() => {
    if (view === 'jobs') {
      if (convosQ.data && convosQ.data.length && !activeJobId) {
        setActiveJobId(convosQ.data[0].jobId);
      }
    } else {
      if (supportQ.data && supportQ.data.length && !activeSupportId) {
        setActiveSupportId(supportQ.data[0].id);
      }
    }
  }, [view, convosQ.data, supportQ.data, activeJobId, activeSupportId]);

  // Load thread + subscribe to live inserts for the active conversation.
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    let active = true;
    let unsub = () => {};

    const load = async () => {
      setLoadingMsgs(true);
      setMsgError(null);
      try {
        const m =
          view === 'jobs'
            ? await getMessages(activeId)
            : await getSupportMessages(activeId);
        if (active) setMessages(m);
      } catch (e: any) {
        if (active) setMsgError(e?.message || 'Failed to load messages.');
      } finally {
        if (active) setLoadingMsgs(false);
      }
    };
    load();
    unsub =
      view === 'jobs'
        ? subscribeMessages(activeId, (incoming) => {
            if (!active) return;
            setMessages((prev) =>
              prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]
            );
          })
        : subscribeSupportMessages(activeId, (incoming) => {
            if (!active) return;
            setMessages((prev) =>
              prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]
            );
          });

    return () => {
      active = false;
      unsub();
    };
  }, [view, activeId]);

  // Auto-scroll to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  // Keep the support-thread list live: when a user opens a thread or sends a
  // message (the DB trigger bumps updated_at), refresh the list so new threads
  // and latest-message previews surface without a manual reload.
  useEffect(() => {
    const channel = supabase
      .channel('admin-support-threads-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_threads' },
        () => supportQ.refetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supportQ]);

  const jobConvo = convosQ.data?.find((c) => c.jobId === activeJobId) || null;
  const supportConvo = supportQ.data?.find((c) => c.id === activeSupportId) || null;

  const headerName =
    view === 'jobs'
      ? jobConvo?.customerName ?? 'Customer'
      : supportConvo?.userName ?? 'User';
  const headerSub =
    view === 'jobs'
      ? `${jobConvo?.online ? 'Online' : 'Offline'} · ${jobConvo?.code || 'Job'}${
          jobConvo?.technicianName ? ` · ${jobConvo.technicianName}` : ''
        }`
      : `${supportConvo?.userRole === 'technician' ? 'Technician' : 'Customer'} · ${
          supportConvo?.status ?? 'open'
        }`;
  const composerPlaceholder =
    view === 'jobs'
      ? `Message ${jobConvo?.customerName?.split(' ')[0] ?? 'customer'}…`
      : `Reply to ${supportConvo?.userName ?? 'user'}…`;

  const filteredConvos = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return convosQ.data ?? [];
    return (convosQ.data ?? []).filter(
      (c: Conversation) =>
        c.customerName.toLowerCase().includes(term) ||
        (c.technicianName || '').toLowerCase().includes(term) ||
        c.code.toLowerCase().includes(term)
    );
  }, [convosQ.data, search]);

  const filteredSupport = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return supportQ.data ?? [];
    return (supportQ.data ?? []).filter(
      (c: SupportThread) =>
        c.userName.toLowerCase().includes(term) ||
        (c.subject || '').toLowerCase().includes(term)
    );
  }, [supportQ.data, search]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !activeId || !user) return;
    setDraft('');
    try {
      if (view === 'jobs') {
        await sendMessage(activeId, user.id, user.name, text);
        const m = await getMessages(activeId);
        setMessages(m);
      } else {
        await sendSupportMessage(activeId, user.id, user.name, text);
        const m = await getSupportMessages(activeId);
        setMessages(m);
      }
    } catch (err: any) {
      setMsgError(err?.message || 'Failed to send message.');
    }
  };

  return (
    <div className="space-y-lg">
      <div className="flex flex-wrap items-end justify-between gap-md">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">
            Integrated Chat
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Coordinate with technicians, customers, and support in one place.
          </p>
        </div>
        {/* View toggle: job chats vs. general support threads */}
        <div className="flex rounded-lg border border-outline-variant bg-surface-container-low p-1">
          <button
            onClick={() => setView('jobs')}
            className={cn(
              'flex items-center gap-xs rounded px-md py-sm font-label-md text-label-md transition-colors',
              view === 'jobs'
                ? 'bg-primary-container text-white'
                : 'text-on-surface-variant hover:bg-surface-container-high'
            )}
          >
            <MessagesSquare className="h-4 w-4" /> Job Chats
          </button>
          <button
            onClick={() => setView('support')}
            className={cn(
              'flex items-center gap-xs rounded px-md py-sm font-label-md text-label-md transition-colors',
              view === 'support'
                ? 'bg-primary-container text-white'
                : 'text-on-surface-variant hover:bg-surface-container-high'
            )}
          >
            <Headset className="h-4 w-4" /> Support
            {supportQ.data && supportQ.data.length > 0 && (
              <span className="ml-1 rounded-full bg-white/25 px-1.5 font-mono-sm text-mono-sm">
                {supportQ.data.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <Card bodyClassName="p-0" className="h-[calc(100vh-220px)] min-h-[480px]">
        <div className="flex h-full">
          {/* Conversation list */}
          <aside
            className={cn(
              'flex w-full flex-col border-r border-outline-variant sm:w-80',
              activeId && 'hidden sm:flex'
            )}
          >
            <div className="border-b border-outline-variant p-md">
              <div className="relative flex items-center">
                <Search className="pointer-events-none absolute left-2 h-[18px] w-[18px] text-on-surface-variant" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 w-full rounded border border-outline-variant bg-surface-container-low py-1 pl-xl pr-sm font-body-sm text-body-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder={view === 'jobs' ? 'Search conversations…' : 'Search support…'}
                  aria-label="Search"
                />
              </div>
            </div>

            {view === 'jobs' ? (
              <>
                {convosQ.loading && <LoadingBlock label="Loading conversations…" />}
                {convosQ.error && <ErrorState message={convosQ.error} onRetry={convosQ.refetch} />}
                {convosQ.data && convosQ.data.length === 0 && !convosQ.loading && (
                  <div className="p-lg">
                    <EmptyState
                      title="No conversations yet"
                      desc="Messages tied to jobs will appear here."
                    />
                  </div>
                )}
                <ul className="flex-1 overflow-y-auto scroll-thin">
                  {filteredConvos.map((c: Conversation) => (
                    <li key={c.jobId}>
                      <button
                        onClick={() => setActiveJobId(c.jobId)}
                        className={cn(
                          'flex w-full items-center gap-md border-b border-outline-variant/60 px-md py-sm text-left transition-colors hover:bg-surface-container-low',
                          c.jobId === activeJobId && 'bg-primary-fixed/40'
                        )}
                      >
                        <div className="relative shrink-0">
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary-fixed text-on-secondary-container font-label-md text-label-md">
                            {initials(c.customerName)}
                          </span>
                          {c.online && (
                            <Circle className="absolute -bottom-0.5 -right-0.5 h-3 w-3 fill-emerald-500 text-surface" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-xs">
                            <p className="truncate font-body-sm text-body-sm text-on-surface">
                              {c.customerName}
                            </p>
                            <span className="shrink-0 font-label-sm text-label-sm text-on-surface-variant">
                              {formatDay(c.lastTime)}
                            </span>
                          </div>
                          <p className="truncate font-label-sm text-label-sm text-on-surface-variant">
                            {c.lastMessage || 'No messages'}
                          </p>
                        </div>
                        {c.unread > 0 && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-container px-1 font-mono-sm text-mono-sm text-white">
                            {c.unread}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                {supportQ.loading && <LoadingBlock label="Loading support threads…" />}
                {supportQ.error && <ErrorState message={supportQ.error} onRetry={supportQ.refetch} />}
                {supportQ.data && supportQ.data.length === 0 && !supportQ.loading && (
                  <div className="p-lg">
                    <EmptyState
                      title="No support threads"
                      desc="When a user opens customer service from the app, their conversation appears here."
                    />
                  </div>
                )}
                <ul className="flex-1 overflow-y-auto scroll-thin">
                  {filteredSupport.map((c: SupportThread) => (
                    <li key={c.id}>
                      <button
                        onClick={() => setActiveSupportId(c.id)}
                        className={cn(
                          'flex w-full items-center gap-md border-b border-outline-variant/60 px-md py-sm text-left transition-colors hover:bg-surface-container-low',
                          c.id === activeSupportId && 'bg-primary-fixed/40'
                        )}
                      >
                        <div className="relative shrink-0">
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary-fixed text-on-secondary-container font-label-md text-label-md">
                            {initials(c.userName)}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-xs">
                            <p className="truncate font-body-sm text-body-sm text-on-surface">
                              {c.userName}
                            </p>
                            <span className="shrink-0 font-label-sm text-label-sm text-on-surface-variant">
                              {formatDay(c.lastTime)}
                            </span>
                          </div>
                          <p className="truncate font-label-sm text-label-sm text-on-surface-variant">
                            {c.lastMessage || 'No messages'}
                          </p>
                        </div>
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-1.5 py-0.5 font-label-sm text-label-sm',
                            c.userRole === 'technician'
                              ? 'bg-tertiary/20 text-tertiary'
                              : 'bg-primary-container/15 text-primary-container'
                          )}
                        >
                          {c.userRole === 'technician' ? 'Tech' : 'Cust'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </aside>

          {/* Thread */}
          <section className={cn('flex min-w-0 flex-1 flex-col', !activeId && 'hidden sm:flex')}>
            {!activeId ? (
              <div className="flex flex-1 items-center justify-center">
                <EmptyState
                  title="Select a conversation"
                  desc={
                    view === 'jobs'
                      ? 'Choose a chat from the list to view messages.'
                      : 'Choose a support thread to view messages.'
                  }
                />
              </div>
            ) : (
              <>
                {/* Thread header */}
                <div className="flex items-center gap-md border-b border-outline-variant px-md py-sm">
                  <button
                    className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high sm:hidden"
                    onClick={() => (view === 'jobs' ? setActiveJobId('') : setActiveSupportId(''))}
                    aria-label="Back to list"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary-fixed text-on-secondary-container font-label-md text-label-md">
                    {initials(headerName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-body-sm text-body-sm text-on-surface">{headerName}</p>
                    <p className="font-label-sm text-label-sm text-on-surface-variant">{headerSub}</p>
                  </div>
                  <div className="flex items-center gap-xs text-on-surface-variant">
                    <button className="rounded p-1 hover:bg-surface-container-high" aria-label="Call">
                      <Phone className="h-5 w-5" />
                    </button>
                    <button className="rounded p-1 hover:bg-surface-container-high" aria-label="Video">
                      <Video className="h-5 w-5" />
                    </button>
                    <button className="rounded p-1 hover:bg-surface-container-high" aria-label="More">
                      <MoreVertical className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Messages */}
                <div
                  ref={scrollRef}
                  className="flex-1 space-y-md overflow-y-auto bg-surface-container-lowest p-md scroll-thin"
                >
                  {loadingMsgs && <LoadingBlock />}
                  {msgError && (
                    <ErrorState
                      message={msgError}
                      onRetry={() =>
                        activeId &&
                        (view === 'jobs'
                          ? getMessages(activeId)
                          : getSupportMessages(activeId)
                        )
                          .then(setMessages)
                          .catch(() => {})
                      }
                    />
                  )}
                  {!loadingMsgs &&
                    messages.map((m) => (
                      <div
                        key={m.id}
                        className={cn('flex', m.from === 'me' ? 'justify-end' : 'justify-start')}
                      >
                        <div
                          className={cn(
                            'max-w-[80%] rounded-lg px-md py-sm font-body-sm text-body-sm',
                            m.from === 'me'
                              ? 'bg-primary-container text-white'
                              : 'bg-surface-container-high text-on-surface'
                          )}
                        >
                          <p>{m.text}</p>
                          <p
                            className={cn(
                              'mt-xs text-right font-label-sm text-label-sm',
                              m.from === 'me' ? 'text-white/70' : 'text-on-surface-variant'
                            )}
                          >
                            {formatTime(m.time)}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>

                {/* Composer */}
                <div className="border-t border-outline-variant p-md">
                  <form className="flex items-center gap-xs" onSubmit={send}>
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      className="h-9 flex-1 rounded border border-outline-variant bg-surface-container-low px-md font-body-sm text-body-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:ring-1 focus:ring-primary"
                      placeholder={composerPlaceholder}
                      aria-label="Message"
                    />
                    <button
                      type="submit"
                      className="flex h-9 w-9 items-center justify-center rounded bg-primary-container text-white transition-colors hover:bg-primary"
                      aria-label="Send"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              </>
            )}
          </section>
        </div>
      </Card>
    </div>
  );
}
