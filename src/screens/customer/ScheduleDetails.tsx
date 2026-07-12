import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { timeSlots, categoryConfig } from '../../data';
import { AppContext } from '../../navigation/AppNavigator';
import {
  ADDRESS_FIELDS,
  emptyAddressFields,
  validateAddressFields,
  profileToAddressFields,
  type AddressFields,
} from '../../services/address';

export default function ScheduleDetails({ route, navigation }: any) {
  const { bookingData } = route.params || {};
  const { user } = useContext(AppContext);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [timeSlot, setTimeSlot] = useState('morning');
  // Address fields start EMPTY on load — nothing is pre-filled from the
  // profile. The only ways they get populated are the two VALID address
  // sources exposed by the UI below: the customer's saved profile address,
  // or their live current location (resolved via GPS). The old "sample
  // location" demo option has been removed entirely.
  const [address, setAddress] = useState<AddressFields>(emptyAddressFields());
  const [addressSource, setAddressSource] = useState<'none' | 'saved' | 'current'>('none');
  const [locating, setLocating] = useState(false);
  const [instructions, setInstructions] = useState('');

  // The customer's structured profile address — one of the two accepted
  // address sources. Used by the "Use My Saved Address" action.
  const savedAddress = profileToAddressFields(user);
  const hasSavedAddress = !!(
    savedAddress.street.trim() ||
    savedAddress.city.trim() ||
    savedAddress.zipCode.trim()
  );

  const handleNext = () => {
    const addressCheck = validateAddressFields(address);
    if (!addressCheck.isValid) {
      Alert.alert(
        'Address Required',
        `Please enter your ${addressCheck.errors.join(' and ')} to continue.`
      );
      return;
    }
    const updated = {
      ...bookingData,
      date: date.toISOString().split('T')[0],
      timeSlot,
      address: address.street,
      apartment: address.apartment,
      city: address.city,
      zipCode: address.zipCode,
      notes: (bookingData?.notes || '') + '\n' + instructions,
    };
    navigation.navigate('Checkout', { bookingData: updated });
  };

  // Accepted address source #1: copy the customer's structured profile
  // address into the form.
  const handleUseSavedAddress = () => {
    setAddress(savedAddress);
    setAddressSource('saved');
  };

  // Accepted address source #2: resolve the device's live GPS position and
  // reverse-geocode it into the structured address fields. This is the only
  // other valid source — the sample/demo location option was removed.
  const handleUseCurrentLocation = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location permission required',
          'Enable location access to use your current location as the service address.'
        );
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.LocationAccuracy.Balanced,
      });
      const [place] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      if (!place) {
        Alert.alert(
          'Could not resolve address',
          'We could not match your current location to a street address. You can enter it manually.'
        );
        return;
      }
      setAddress({
        street: [place.streetNumber, place.name].filter(Boolean).join(' ').trim(),
        apartment: '',
        city: place.city ?? '',
        zipCode: place.postalCode ?? '',
      });
      setAddressSource('current');
    } catch (err) {
      console.error('Failed to resolve current location:', err);
      Alert.alert(
        'Location unavailable',
        'We could not retrieve your current location. Please enter the address manually.'
      );
    } finally {
      setLocating(false);
    }
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

        {/* Address — same structured fields / validation / formatting as the
            customer profile form, rendered from the shared ADDRESS_FIELDS. */}
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 10 }}>Service Address</Text>
        <View style={{ gap: 10, marginBottom: 16 }}>
          {ADDRESS_FIELDS.map((f) => (
            <TextInput
              key={f.key}
              value={address[f.key]}
              onChangeText={(text) => setAddress((prev) => ({ ...prev, [f.key]: text }))}
              placeholder={f.placeholder}
              keyboardType={f.keyboardType || 'default'}
              maxLength={f.maxLength}
              style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, padding: 12, fontSize: 13 }}
              placeholderTextColor="#94A3B8"
            />
          ))}
          <TextInput value={instructions} onChangeText={setInstructions} placeholder="Gate code, parking, etc." multiline numberOfLines={2} style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, padding: 12, fontSize: 13, textAlignVertical: 'top' }} placeholderTextColor="#94A3B8" />
        </View>

        {/* Address source actions — the ONLY accepted ways to populate the
            service address are the customer's saved profile address or their
            live current location. The "sample location" option was removed.
            The fields below can still be edited once a source is chosen. */}
        <View style={{ gap: 10, marginBottom: 24 }}>
          <TouchableOpacity
            onPress={handleUseSavedAddress}
            disabled={!hasSavedAddress}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              padding: 12,
              backgroundColor: hasSavedAddress ? '#FFF1F6' : '#F8FAFC',
              borderRadius: 10,
              opacity: hasSavedAddress ? 1 : 0.6,
            }}
          >
            <Ionicons name="bookmark-outline" size={16} color={hasSavedAddress ? '#FF4F8B' : '#94A3B8'} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: hasSavedAddress ? '#FF4F8B' : '#94A3B8' }}>
              {hasSavedAddress ? 'Use My Saved Address' : 'No saved address yet'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleUseCurrentLocation}
            disabled={locating}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              padding: 12,
              backgroundColor: '#FFF1F6',
              borderRadius: 10,
              opacity: locating ? 0.6 : 1,
            }}
          >
            <Ionicons name="location" size={16} color="#FF4F8B" />
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#FF4F8B' }}>
              {locating ? 'Locating…' : 'Use Current Location'}
            </Text>
          </TouchableOpacity>

          {addressSource !== 'none' && (
            <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
              {addressSource === 'saved'
                ? 'Service address set from your saved profile.'
                : 'Service address set from your current location.'}
            </Text>
          )}
        </View>

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
