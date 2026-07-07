import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppContext } from '../../navigation/AppNavigator';
import { Job } from '../../types';
import { reviewTags, defaultRating, defaultSelectedTags, streakMessage, technicianSharePercent } from '../../data';
import { PINK, PINK_SOFT, INK, MUTED, ACCENT, ACCENT_SOFT } from '../../theme/colors';

export default function ServiceCompletion({ route, navigation }: any) {
  const { job } = route.params || {};
  const { refreshJobs } = useContext(AppContext);
  const [technicianNotes, setTechnicianNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // ─── Delightful Success State ───
  const [rating, setRating] = useState(defaultRating);
  const [selectedTags, setSelectedTags] = useState<string[]>([...defaultSelectedTags]);

  const toggleTag = (key: string) => {
    setSelectedTags((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const handleSubmit = () => {
    setSubmitted(true);
    refreshJobs();
  };

  if (submitted) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFBFC' }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Trophy with golden glow */}
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <View
              style={{
                width: 140,
                height: 140,
                borderRadius: 70,
                backgroundColor: ACCENT_SOFT,
                justifyContent: 'center',
                alignItems: 'center',
                position: 'relative',
              }}
            >
              <View
                style={{
                  position: 'absolute',
                  width: 140,
                  height: 140,
                  borderRadius: 70,
                  backgroundColor: ACCENT,
                  opacity: 0.12,
                  top: 10,
                }}
              />
              <View
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: 42,
                  backgroundColor: ACCENT,
                  justifyContent: 'center',
                  alignItems: 'center',
                  shadowColor: ACCENT,
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.35,
                  shadowRadius: 16,
                  elevation: 5,
                }}
              >
                <Ionicons name="trophy" size={42} color="#fff" />
              </View>
            </View>
          </View>

          {/* Headline */}
          <Text
            style={{
              fontSize: 26,
              fontWeight: '800',
              color: INK,
              textAlign: 'center',
              letterSpacing: -0.5,
            }}
          >
            Boom! You're all set. 🎉
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: MUTED,
              textAlign: 'center',
              marginTop: 8,
              lineHeight: 19,
              fontWeight: '500',
            }}
          >
            Marcus finished your deep cleaning. How was it?
          </Text>

          {/* Stars */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
              marginTop: 24,
              marginBottom: 8,
            }}
          >
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => setRating(star)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={star <= rating ? 'star' : 'star-outline'}
                  size={36}
                  color={star <= rating ? ACCENT : '#CBD5E1'}
                />
              </TouchableOpacity>
            ))}
          </View>

          {/* Quick tags */}
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: MUTED,
              textAlign: 'center',
              marginTop: 16,
              marginBottom: 10,
            }}
          >
            What went well?
          </Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 8,
              marginBottom: 24,
            }}
          >
            {reviewTags.map((tag) => {
              const isSelected = selectedTags.includes(tag.key);
              return (
                <TouchableOpacity
                  key={tag.key}
                  onPress={() => toggleTag(tag.key)}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 16,
                    borderRadius: 999,
                    borderWidth: 1.5,
                    borderColor: isSelected ? tag.color : '#E5E7EB',
                    backgroundColor: isSelected ? tag.soft : '#fff',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: isSelected ? tag.color : MUTED,
                    }}
                  >
                    {tag.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Streak unlock — yellow achievement card */}
          <View
            style={{
              backgroundColor: ACCENT_SOFT,
              borderRadius: 16,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              marginBottom: 28,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: ACCENT,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons name="flame" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: INK }}>
                {streakMessage.title}
              </Text>
              <Text style={{ fontSize: 11, color: MUTED, marginTop: 2, lineHeight: 15 }}>
                {streakMessage.subtitle}
              </Text>
            </View>
          </View>

          {/* Send High Five pill button */}
          <TouchableOpacity
            onPress={() => navigation.navigate('Jobs')}
            activeOpacity={0.85}
            style={{
              backgroundColor: PINK,
              paddingVertical: 16,
              borderRadius: 999,
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 8,
              shadowColor: PINK,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 16,
              elevation: 4,
            }}
          >
            <Ionicons name="hand-left" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>
              Send High Five
            </Text>
            <Ionicons name="sparkles" size={14} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('Jobs')}
            style={{ alignItems: 'center', marginTop: 16, paddingVertical: 8 }}
          >
            <Text style={{ fontSize: 13, color: MUTED, fontWeight: '600' }}>
              Skip for now
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFBFC' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={22} color={INK} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '800', color: INK }}>Service Summary</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        {/* Summary Card */}
        <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 }}>
            Service Summary
          </Text>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 12, color: MUTED }}>Service</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: INK }}>{job.serviceType}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 12, color: MUTED }}>Customer</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: INK }}>{job.customerName}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 12, color: MUTED }}>Duration</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: INK }}>{formatTime(job.elapsedTime)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 12, color: MUTED }}>Rooms</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: INK }}>{job.rooms}</Text>
            </View>
          </View>
        </View>

        {/* Checklist Completion */}
        <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 16 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 }}>
            Checklist Completed
          </Text>
          {job.checklist.map((item: any, i: number) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}>
              <Ionicons name="checkmark-circle" size={18} color={ACCENT} />
              <Text style={{ fontSize: 12, color: INK, flex: 1, fontWeight: '500' }}>{item.text}</Text>
            </View>
          ))}
        </View>

        {/* Payment Summary */}
        <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 16 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 }}>
            Payment
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ fontSize: 12, color: MUTED }}>Service Total</Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: INK }}>${job.totalPrice?.toFixed(2)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: MUTED }}>Your Earnings ({technicianSharePercent}%)</Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: PINK }}>${(job.totalPrice * technicianSharePercent / 100).toFixed(2)}</Text>
          </View>
        </View>

        {/* Technician Notes */}
        <Text style={{ fontSize: 11, fontWeight: '800', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>
          Service Notes
        </Text>
        <TextInput
          value={technicianNotes}
          onChangeText={setTechnicianNotes}
          placeholder="Add notes about the service..."
          multiline
          numberOfLines={4}
          style={{
            backgroundColor: '#fff',
            borderWidth: 1.5,
            borderColor: '#E5E7EB',
            borderRadius: 16,
            padding: 14,
            fontSize: 13,
            marginBottom: 16,
            textAlignVertical: 'top',
            color: INK,
          }}
          placeholderTextColor="#94A3B8"
        />
      </ScrollView>

      {/* Bottom Bar — Submit pill */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F1F5F9', padding: 16, paddingBottom: 32 }}>
        <TouchableOpacity
          onPress={handleSubmit}
          activeOpacity={0.85}
          style={{
            backgroundColor: PINK,
            paddingVertical: 16,
            borderRadius: 999,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 8,
            shadowColor: PINK,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 4,
          }}
        >
          <Ionicons name="checkmark-circle" size={18} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>Submit Completion</Text>
          <Ionicons name="sparkles" size={14} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
