import React, { useState, useRef, useEffect, useContext } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppContext } from '../../navigation/AppNavigator';
import { Message } from '../../types';
import {
  fetchMessages,
  subscribeMessages,
  sendMessage,
  getOrCreateSupportThread,
} from '../../services/chat.service';
import { logger } from '../../services/logger';

/**
 * Customer-service chat. Two entry points:
 *   - Job chat (`route.params.job`): tied to a specific job, opened from
 *     Tracking / JobDetails. Messages persist with `job_id` set.
 *   - Support chat (`route.params.support`): a general conversation with no
 *     job, opened from the profile-page "Contact support" button. Messages
 *     persist against a `support_thread_id` so the admin console can read and
 *     reply to them. Both modes read/write the SAME Supabase `messages` table
 *     the admin Messages page consumes — i.e. genuinely connected to admin.
 */
export default function SupportChat({ route, navigation }: any) {
  const { job, support } = route.params || {};
  const { user } = useContext(AppContext);
  const isSupport = !!support;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [threadId, setThreadId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    let active = true;
    let unsub = () => {};

    (async () => {
      try {
        if (isSupport) {
          if (!user) throw new Error('You must be signed in to contact support.');
          const thread = await getOrCreateSupportThread(user);
          if (!active) return;
          setThreadId(thread.id);

          const history = await fetchMessages({ threadId: thread.id });
          if (!active) return;

          const welcome: Message = {
            id: 'welcome',
            sender: 'system',
            senderName: 'System',
            content:
              "You're connected with the ServiceHub support team. How can we help you today?",
            timestamp: '',
          };
          setMessages([welcome, ...history]);

          unsub = subscribeMessages({ threadId: thread.id }, (m) => {
            setMessages((prev) =>
              prev.some((x) => x.id === m.id) ? prev : [...prev, m]
            );
          });
        } else if (job) {
          const history = await fetchMessages({ jobId: job.id });
          if (!active) return;

          const sys: Message = {
            id: 'sys1',
            sender: 'system',
            senderName: 'System',
            content: `Connecting regarding Job ID: ${job.jobCode || job.id || '#8849-AC'}`,
            timestamp: '',
          };
          setMessages([sys, ...history]);

          unsub = subscribeMessages({ jobId: job.id }, (m) => {
            setMessages((prev) =>
              prev.some((x) => x.id === m.id) ? prev : [...prev, m]
            );
          });
        } else {
          setMessages([
            {
              id: 'sys1',
              sender: 'system',
              senderName: 'System',
              content: 'No conversation selected.',
              timestamp: '',
            },
          ]);
        }
      } catch (e) {
        logger.error('[SupportChat] load failed', {
          error: e instanceof Error ? e.message : String(e),
        });
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      unsub();
    };
  }, [isSupport, job?.id, user?.id]);

  useEffect(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const sendMessageHandler = async () => {
    const text = input.trim();
    if (!text || !user) return;

    setInput('');
    const target = isSupport ? { threadId } : { jobId: job?.id };
    // Guard: support mode requires a resolved thread id.
    if (isSupport && !threadId) return;

    try {
      const sent = await sendMessage(
        target,
        {
          senderId: user.id,
          senderRole: user.role,
          senderName: user.name,
        },
        text
      );
      setMessages((prev) =>
        prev.some((x) => x.id === sent.id) ? prev : [...prev, sent]
      );
    } catch (e) {
      logger.error('[SupportChat] send failed', {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    if (item.sender === 'system') {
      return (
        <View
          style={{
            alignSelf: 'center',
            backgroundColor: '#F1F5F9',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 12,
            marginVertical: 6,
            maxWidth: '85%',
          }}
        >
          <Text style={{ fontSize: 10, color: '#64748B', textAlign: 'center' }}>
            {item.content}
          </Text>
        </View>
      );
    }

    const isUser = item.sender === 'customer' || item.sender === 'technician';
    return (
      <View
        style={{
          flexDirection: 'row',
          justifyContent: isUser ? 'flex-end' : 'flex-start',
          marginVertical: 4,
          paddingHorizontal: 16,
        }}
      >
        {!isUser && (
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: '#FF4F8B',
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 8,
              marginTop: 4,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>S</Text>
          </View>
        )}
        <View style={{ maxWidth: '75%' }}>
          <View
            style={{
              backgroundColor: isUser ? '#FF4F8B' : '#F1F5F9',
              borderWidth: isUser ? 0 : 1,
              borderColor: '#F1F5F9',
              borderRadius: 14,
              borderTopRightRadius: isUser ? 4 : 14,
              borderTopLeftRadius: isUser ? 14 : 4,
              padding: 12,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                color: isUser ? '#fff' : '#0F172A',
                lineHeight: 18,
              }}
            >
              {item.content}
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              marginTop: 2,
              paddingHorizontal: 4,
            }}
          >
            <Text style={{ fontSize: 9, color: '#94A3B8' }}>{item.timestamp}</Text>
            {isUser && (
              <Ionicons name="checkmark-done" size={12} color="#FF4F8B" />
            )}
          </View>
        </View>
      </View>
    );
  };

  const headerTitle = isSupport ? 'Support Team' : 'Support';
  const headerSubtitle = isSupport
    ? 'We typically reply within a few minutes'
    : `Job ${job?.jobCode || (job?.id ? `#${String(job.id).slice(0, 8)}` : '')}`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFBFC' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 16,
            backgroundColor: '#fff',
            borderBottomWidth: 1,
            borderBottomColor: '#F1F5F9',
          }}
        >
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ marginRight: 12 }}
          >
            <Ionicons name="arrow-back" size={22} color="#0F172A" />
          </TouchableOpacity>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: '#FF4F8B',
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 10,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>S</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }}>
              {headerTitle}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: '#10B981',
                }}
              />
              <Text style={{ fontSize: 10, color: '#10B981', fontWeight: '600' }}>
                {headerSubtitle}
              </Text>
            </View>
          </View>
        </View>

        {/* Messages */}
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#FF4F8B" />
            <Text style={{ marginTop: 12, color: '#64748B', fontWeight: '600' }}>
              Loading conversation…
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={{ paddingVertical: 12 }}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
          />
        )}

        {/* Input */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 12,
            paddingBottom: 32,
            backgroundColor: '#fff',
            borderTopWidth: 1,
            borderTopColor: '#F1F5F9',
            gap: 8,
          }}
        >
          <TouchableOpacity
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: '#F1F5F9',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons name="add-circle-outline" size={20} color="#64748B" />
          </TouchableOpacity>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Type a message..."
            style={{
              flex: 1,
              backgroundColor: '#FAFBFC',
              borderWidth: 1,
              borderColor: '#F1F5F9',
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 10,
              fontSize: 13,
            }}
            placeholderTextColor="#94A3B8"
          />
          <TouchableOpacity
            onPress={sendMessageHandler}
            disabled={!input.trim() || loading}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: input.trim() && !loading ? '#FF4F8B' : '#CBD5E1',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons name="send" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
