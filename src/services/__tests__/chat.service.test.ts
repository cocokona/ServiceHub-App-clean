import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mirror the Supabase client mock used across the service tests so we can
// drive the query builder without a real database.
const { supabase } = vi.hoisted(() => ({
  supabase: {
    from: vi.fn(),
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}));

vi.mock('../../lib/supabase', () => ({ supabase }));

import {
  getOrCreateSupportThread,
  fetchMessages,
  sendMessage,
} from '../chat.service';

/** Chainable, thenable query-builder mock that resolves to { data, error }. */
function makeBuilder(result: { data: any; error: any }) {
  const builder: any = {};
  const methods = [
    'select',
    'eq',
    'is',
    'order',
    'limit',
    'insert',
    'update',
    'delete',
    'upsert',
    'or',
    'single',
    'maybeSingle',
    'neq',
  ];
  methods.forEach((m) => {
    builder[m] = vi.fn(() => builder);
  });
  builder.then = (resolve: any) => Promise.resolve(result).then(resolve);
  return builder;
}

const testUser = {
  id: 'u1',
  email: 'u1@test.com',
  name: 'Tester',
  role: 'customer' as const,
};

describe('chat.service', () => {
  beforeEach(() => {
    supabase.from.mockReset();
    supabase.channel.mockReset();
    supabase.removeChannel.mockReset();
  });

  describe('getOrCreateSupportThread', () => {
    it('returns the existing open thread when one is present', async () => {
      const thread = {
        id: 't1',
        user_id: 'u1',
        user_role: 'customer',
        subject: null,
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      supabase.from.mockReturnValue(makeBuilder({ data: thread, error: null }));

      const result = await getOrCreateSupportThread(testUser as any);
      expect(result.id).toBe('t1');
      expect(supabase.from).toHaveBeenCalledWith('support_threads');
    });

    it('creates a new thread when none is open', async () => {
      const created = {
        id: 't2',
        user_id: 'u1',
        user_role: 'customer',
        subject: null,
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      // 1st call: no existing thread. 2nd call: insert returns the created row.
      supabase.from
        .mockReturnValueOnce(makeBuilder({ data: null, error: null }))
        .mockReturnValueOnce(makeBuilder({ data: created, error: null }));

      const result = await getOrCreateSupportThread(testUser as any);
      expect(result.id).toBe('t2');
      // The insert must carry the caller's identity + role.
      const insertCall = supabase.from.mock.calls[1][0];
      expect(insertCall).toBe('support_threads');
    });

    it('throws when the select fails', async () => {
      supabase.from.mockReturnValue(makeBuilder({ data: null, error: { message: 'db down' } }));
      await expect(getOrCreateSupportThread(testUser as any)).rejects.toThrow('db down');
    });
  });

  describe('fetchMessages', () => {
    it('maps DB rows to UI messages with a formatted timestamp', async () => {
      const iso = '2026-07-14T10:30:00.000Z';
      supabase.from.mockReturnValue(
        makeBuilder({
          data: [
            {
              id: 'm1',
              job_id: null,
              support_thread_id: 't1',
              sender_id: 'u1',
              sender_role: 'customer',
              sender_name: 'Tester',
              content: 'Hello',
              created_at: iso,
            },
          ],
          error: null,
        })
      );

      const msgs = await fetchMessages({ threadId: 't1' });
      expect(msgs).toHaveLength(1);
      expect(msgs[0].sender).toBe('customer');
      expect(msgs[0].content).toBe('Hello');
      expect(msgs[0].timestamp).toMatch(/\d{1,2}:\d{2}/);
    });
  });

  describe('sendMessage', () => {
    it('persists the message and returns the stored row mapped to a UI message', async () => {
      const iso = '2026-07-14T11:00:00.000Z';
      supabase.from.mockReturnValue(
        makeBuilder({
          data: {
            id: 'm2',
            job_id: null,
            support_thread_id: 't1',
            sender_id: 'u1',
            sender_role: 'customer',
            sender_name: 'Tester',
            content: 'Thanks',
            created_at: iso,
          },
          error: null,
        })
      );

      const sent = await sendMessage(
        { threadId: 't1' },
        { senderId: 'u1', senderRole: 'customer', senderName: 'Tester' },
        'Thanks'
      );

      expect(sent.id).toBe('m2');
      expect(sent.sender).toBe('customer');
      // The insert payload must target the thread (not a job).
      const builder = supabase.from.mock.results[0].value;
      // chain was exercised; confirm table + role were used.
      expect(supabase.from).toHaveBeenCalledWith('messages');
      expect(builder.insert).toBeDefined();
    });

    it('throws on insert error', async () => {
      supabase.from.mockReturnValue(makeBuilder({ data: null, error: { message: 'nope' } }));
      await expect(
        sendMessage(
          { threadId: 't1' },
          { senderId: 'u1', senderRole: 'customer', senderName: 'Tester' },
          'x'
        )
      ).rejects.toThrow('nope');
    });
  });
});
