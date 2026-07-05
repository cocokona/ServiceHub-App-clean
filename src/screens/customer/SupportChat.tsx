import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Message } from '../../types';

function getMockSupportResponse(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes('gate') || lower.includes('code')) return "I've contacted the customer for the updated gate code. Please stand by.";
  if (lower.includes('arrive') || lower.includes('here')) return "Thank you for letting us know. The customer has been notified of your arrival.";
  if (lower.includes('cancel')) return "I can help with that. Would you like me to process a cancellation request?";
  if (lower.includes('complete') || lower.includes('done')) return "Great! I'll mark this service as completed. Thank you for your excellent work!";
  if (lower.includes('hello') || lower.includes('hi')) return "Hello! How can I assist you with this service order today?";
  return "Thank you for your message. I'm looking into this and will have an update for you shortly.";
}

export default function SupportChat({ route, navigation }: any) {
  const { job } = route.params || {};
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'sys1',
      sender: 'system',
      senderName: 'System',
      content: `Connecting regarding Job ID: ${job?.id || '#8849-AC'}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;
    const userMsg: Message = {
      id: `u${Date.now()}`,
      sender: 'customer',
      senderName: 'You',
      content: input.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    const text = input;
    setInput('');

    setTimeout(() => {
      const supportMsg: Message = {
        id: `s${Date.now()}`,
        sender: 'support',
        senderName: 'Sarah',
        content: getMockSupportResponse(text),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, supportMsg]);
    }, 1500);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    if (item.sender === 'system') {
      return (
        <View style={{ alignSelf: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginVertical: 6 }}>
          <Text style={{ fontSize: 10, color: '#666', textAlign: 'center' }}>{item.content}</Text>
        </View>
      );
    }

    const isUser = item.sender === 'customer';
    return (
      <View style={{ flexDirection: 'row', justifyContent: isUser ? 'flex-end' : 'flex-start', marginVertical: 4, paddingHorizontal: 16 }}>
        {!isUser && (
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#003d9b', justifyContent: 'center', alignItems: 'center', marginRight: 8, marginTop: 4 }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>S</Text>
          </View>
        )}
        <View style={{ maxWidth: '75%' }}>
          <View style={{
            backgroundColor: isUser ? '#003d9b' : '#fff',
            borderWidth: isUser ? 0 : 1,
            borderColor: '#e0e2ec',
            borderRadius: 14,
            borderTopRightRadius: isUser ? 4 : 14,
            borderTopLeftRadius: isUser ? 14 : 4,
            padding: 12,
          }}>
            <Text style={{ fontSize: 13, color: isUser ? '#fff' : '#333', lineHeight: 18 }}>{item.content}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, paddingHorizontal: 4 }}>
            <Text style={{ fontSize: 9, color: '#999' }}>{item.timestamp}</Text>
            {isUser && <Ionicons name="checkmark-done" size={12} color="#003d9b" />}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e2ec' }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={22} color="#333" />
        </TouchableOpacity>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#003d9b', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>S</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a' }}>Sarah - Support</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' }} />
            <Text style={{ fontSize: 10, color: '#22c55e', fontWeight: '600' }}>Online</Text>
          </View>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={{ paddingVertical: 12 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {/* Input */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, paddingBottom: 32, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e0e2ec', gap: 8 }}>
        <TouchableOpacity style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="add-circle-outline" size={20} color="#666" />
        </TouchableOpacity>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          style={{ flex: 1, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e0e2ec', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 13 }}
          placeholderTextColor="#aaa"
        />
        <TouchableOpacity
          onPress={sendMessage}
          disabled={!input.trim()}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: input.trim() ? '#003d9b' : '#ccc', justifyContent: 'center', alignItems: 'center' }}
        >
          <Ionicons name="send" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>
);
}
