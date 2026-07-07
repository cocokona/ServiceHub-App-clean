import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { timeSlots, currentLocationDemo, categoryConfig } from '../../data';

export default function ScheduleDetails({ route, navigation }: any) {
  const { bookingData } = route.params || {};
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [timeSlot, setTimeSlot] = useState('morning');
  const [street, setStreet] = useState('');
  const [apartment, setApartment] = useState('');
  const [city, setCity] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [instructions, setInstructions] = useState('');

  const handleNext = () => {
    if (!street || !city || !zipCode) {
      return;
    }
    const updated = {
      ...bookingData,
      date: date.toISOString().split('T')[0],
      timeSlot,
      address: street,
      apartment,
      city,
      zipCode,
      notes: (bookingData?.notes || '') + '\n' + instructions,
    };
    navigation.navigate('Checkout', { bookingData: updated });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFBFC' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A' }}>Schedule & Address</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        {/* Date */}
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 10 }}>Service Date</Text>
        <TouchableOpacity
          onPress={() => setShowDatePicker(true)}
          style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}
        >
          <Text style={{ fontSize: 13, color: '#0F172A' }}>{date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</Text>
          <Ionicons name="calendar-outline" size={18} color="#64748B" />
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            minimumDate={new Date()}
            onChange={(_, selectedDate) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (selectedDate) setDate(selectedDate);
            }}
          />
        )}

        {/* Time Slot */}
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 10, marginTop: 16 }}>Preferred Time</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
          {timeSlots.map((slot) => (
            <TouchableOpacity
              key={slot.key}
              onPress={() => setTimeSlot(slot.key)}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: timeSlot === slot.key ? '#FF4F8B' : '#F1F5F9',
                backgroundColor: timeSlot === slot.key ? 'rgba(255,79,139,0.05)' : '#fff',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Ionicons name={slot.icon as keyof typeof Ionicons.glyphMap} size={20} color={timeSlot === slot.key ? '#FF4F8B' : '#64748B'} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: timeSlot === slot.key ? '#FF4F8B' : '#64748B' }}>{slot.label}</Text>
              <Text style={{ fontSize: 9, color: '#94A3B8' }}>{slot.time}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Address */}
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 10 }}>Service Address</Text>
        <View style={{ gap: 10, marginBottom: 16 }}>
          <TextInput value={street} onChangeText={setStreet} placeholder="Street Address *" style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, padding: 12, fontSize: 13 }} placeholderTextColor="#94A3B8" />
          <TextInput value={apartment} onChangeText={setApartment} placeholder="Apt / Suite / Floor" style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, padding: 12, fontSize: 13 }} placeholderTextColor="#94A3B8" />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput value={city} onChangeText={setCity} placeholder="City *" style={{ flex: 2, backgroundColor: '#fff', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, padding: 12, fontSize: 13 }} placeholderTextColor="#94A3B8" />
            <TextInput value={zipCode} onChangeText={setZipCode} placeholder="ZIP *" keyboardType="numeric" maxLength={5} style={{ flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, padding: 12, fontSize: 13 }} placeholderTextColor="#94A3B8" />
          </View>
          <TextInput value={instructions} onChangeText={setInstructions} placeholder="Gate code, parking, etc." multiline numberOfLines={2} style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, padding: 12, fontSize: 13, textAlignVertical: 'top' }} placeholderTextColor="#94A3B8" />
        </View>

        {/* Use Current Location */}
        <TouchableOpacity
          onPress={() => { setStreet(currentLocationDemo.street); setCity(currentLocationDemo.city); setZipCode(currentLocationDemo.zipCode); }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: '#FFF1F6', borderRadius: 10, marginBottom: 24 }}
        >
          <Ionicons name="location" size={16} color="#FF4F8B" />
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#FF4F8B' }}>Use Current Location</Text>
        </TouchableOpacity>

        {/* Summary */}
        <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#F1F5F9' }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 10 }}>Booking Summary</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ fontSize: 12, color: '#64748B' }}>Service</Text>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#0F172A' }}>{bookingData?.serviceType}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ fontSize: 12, color: '#64748B' }}>{categoryConfig[bookingData?.serviceCategory]?.fieldLabel || 'Option'}</Text>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#0F172A' }}>{bookingData?.rooms}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ fontSize: 12, color: '#64748B' }}>Duration</Text>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#0F172A' }}>{bookingData?.duration}h</Text>
          </View>
          <View style={{ borderTopWidth: 1, borderTopColor: '#F1F5F9', marginTop: 8, paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>Total</Text>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#FF4F8B' }}>${bookingData?.totalPrice?.toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Bar */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F1F5F9', padding: 16, paddingBottom: 32, flexDirection: 'row', gap: 12 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9', alignItems: 'center' }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748B' }}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleNext} style={{ flex: 2, backgroundColor: '#FF4F8B', paddingVertical: 14, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Continue to Payment</Text>
          <Ionicons name="arrow-forward" size={14} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
