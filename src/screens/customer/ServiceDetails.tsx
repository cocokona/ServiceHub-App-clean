import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Job } from '../../types';
import { apiGet } from '../../api/client';
import { durations, categoryConfig, durationUnitCost } from '../../data';
import type { CategoryFieldConfig, FocusArea } from '../../data';

interface TechProfile {
  id: string;
  name: string;
  avatar: string;
  specialty: string;
  workCategory: string;
  rating: number;
  reviewsCount: number;
  ratePerHour: number;
}

interface FocusAreaWithCheck extends FocusArea {
  checked: boolean;
}

const fallbackConfig: CategoryFieldConfig = {
  title: 'Service',
  subtitle: 'Book a professional',
  fieldLabel: 'Option',
  fieldOptions: ['Standard', 'Premium'],
  focusAreas: [],
  baseRatesByField: {},
  bannerTitle: 'Service',
  bannerSubtitle: '',
  bannerIcon: 'briefcase',
};

export default function ServiceDetails({ route, navigation }: any) {
  const { category, preferredTech } = route.params || {};
  const config: CategoryFieldConfig = categoryConfig[category] || fallbackConfig;

  const [helpers, setHelpers] = useState<TechProfile[]>([]);
  const [selectedTech, setSelectedTech] = useState<TechProfile | null>(preferredTech || null);
  const [selectedField, setSelectedField] = useState(config.fieldOptions[1] || config.fieldOptions[0] || '');
  const [selectedDuration, setSelectedDuration] = useState(durations[0] || 2);
  const [notes, setNotes] = useState('');
  const [focusAreaState, setFocusAreaState] = useState<FocusAreaWithCheck[]>(
    config.focusAreas.map((f) => ({ ...f, checked: false }))
  );

  useEffect(() => {
    apiGet(`/api/technicians?category=${category}`).then((data) => {
      if (Array.isArray(data)) {
        setHelpers(data.map((t: any) => ({
          id: t.id,
          name: t.name,
          avatar: t.avatar || '',
          specialty: t.specialty || t.workCategory,
          workCategory: t.workCategory || 'all',
          rating: t.rating || 0,
          reviewsCount: t.reviewsCount || 0,
          ratePerHour: t.ratePerHour || 45,
        })));
      }
    }).catch(() => {});
  }, [category]);

  useEffect(() => {
    if (helpers.length > 0 && preferredTech) {
      const match = helpers.find((h) => h.name === preferredTech.name);
      if (match) setSelectedTech(match);
    }
  }, [helpers, preferredTech]);

  const baseRate = config.baseRatesByField[selectedField] ?? 0;
  const durationCost = selectedDuration * durationUnitCost;
  const addOnsPrice = focusAreaState.filter((f) => f.checked).reduce((sum, f) => sum + f.price, 0);
  const totalPrice = baseRate + durationCost + addOnsPrice;

  const toggleFocus = (index: number) => {
    setFocusAreaState((prev) =>
      prev.map((f, i) => (i === index ? { ...f, checked: !f.checked } : f))
    );
  };

  const handleNext = () => {
    const bookingData: Partial<Job> = {
      serviceType: config.title,
      serviceCategory: category,
      rooms: selectedField,
      duration: selectedDuration,
      notes,
      focusAreas: focusAreaState.filter((f) => f.checked).map((f) => f.label),
      baseRate,
      addOnsPrice,
      totalPrice,
      technicianName: selectedTech?.name,
      technicianAvatar: selectedTech?.avatar,
    };
    navigation.navigate('ScheduleDetails', { bookingData });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFBFC' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={22} color="#333" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A' }}>{config.title}</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        {/* Field Selection (rooms / property type / scope / service type) */}
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 10 }}>{config.fieldLabel}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
          {config.fieldOptions.map((opt) => (
            <TouchableOpacity
              key={opt}
              onPress={() => setSelectedField(opt)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: selectedField === opt ? '#FF4F8B' : '#F1F5F9',
                backgroundColor: selectedField === opt ? 'rgba(255,79,139,0.05)' : '#FFFFFF',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: selectedField === opt ? '#FF4F8B' : '#64748B' }}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Duration */}
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 10 }}>Duration (hours)</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
          {durations.map((d) => (
            <TouchableOpacity
              key={d}
              onPress={() => setSelectedDuration(d)}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: selectedDuration === d ? '#FF4F8B' : '#F1F5F9',
                backgroundColor: selectedDuration === d ? 'rgba(255,79,139,0.05)' : '#FFFFFF',
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Ionicons name="time-outline" size={14} color={selectedDuration === d ? '#FF4F8B' : '#64748B'} />
              <Text style={{ fontSize: 12, fontWeight: '600', color: selectedDuration === d ? '#FF4F8B' : '#64748B' }}>{d}h</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Focus Areas / Add-ons */}
        {focusAreaState.length > 0 && (
          <>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 10 }}>Add-on Services</Text>
            <View style={{ gap: 8, marginBottom: 24 }}>
              {focusAreaState.map((area, i) => (
                <TouchableOpacity
                  key={area.key}
                  onPress={() => toggleFocus(i)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 12,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: area.checked ? '#FF4F8B' : '#F1F5F9',
                    backgroundColor: area.checked ? 'rgba(255,79,139,0.05)' : '#FFFFFF',
                    gap: 10,
                  }}
                >
                  <Ionicons name={area.checked ? 'checkbox' : 'square-outline'} size={20} color={area.checked ? '#FF4F8B' : '#ccc'} />
                  <Text style={{ fontSize: 13, flex: 1 }}>{area.emoji} {area.label}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#FF4F8B' }}>+${area.price}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Notes */}
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 10 }}>Special Instructions</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Any specific requests..."
          multiline
          numberOfLines={3}
          style={{ borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, padding: 12, fontSize: 13, backgroundColor: '#FFFFFF', marginBottom: 24, textAlignVertical: 'top' }}
          placeholderTextColor="#aaa"
        />

        {/* Technician Selection */}
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 10 }}>Select Technician</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
          {helpers.map((tech) => (
            <TouchableOpacity
              key={tech.id}
              onPress={() => setSelectedTech(tech)}
              style={{
                width: '47%',
                padding: 12,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: selectedTech?.id === tech.id ? '#FF4F8B' : '#F1F5F9',
                backgroundColor: selectedTech?.id === tech.id ? 'rgba(255,79,139,0.05)' : '#FFFFFF',
                alignItems: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              {tech.avatar ? (
                <Image source={{ uri: tech.avatar }} style={{ width: 40, height: 40, borderRadius: 20, marginBottom: 8 }} />
              ) : (
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFE2EC', justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#FF4F8B' }}>{tech.name[0]}</Text>
                </View>
              )}
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#333', textAlign: 'center' }}>{tech.name}</Text>
              <Text style={{ fontSize: 10, color: '#64748B', textAlign: 'center' }}>{tech.specialty}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 }}>
                <Ionicons name="star" size={10} color="#F59E0B" />
                <Text style={{ fontSize: 10, fontWeight: '600' }}>{tech.rating}</Text>
              </View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#FF4F8B', marginTop: 2 }}>${tech.ratePerHour}/hr</Text>
              {selectedTech?.id === tech.id && (
                <View style={{ position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: '#FF4F8B', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="checkmark" size={12} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Bottom Bar */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F1F5F9', padding: 16, paddingBottom: 32 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ fontSize: 12, color: '#64748B' }}>Estimated Total</Text>
          <Text style={{ fontSize: 20, fontWeight: '800', color: '#FF4F8B' }}>${totalPrice.toFixed(2)}</Text>
        </View>
        <TouchableOpacity onPress={handleNext} style={{ backgroundColor: '#FF4F8B', paddingVertical: 14, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Continue</Text>
          <Ionicons name="arrow-forward" size={14} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
