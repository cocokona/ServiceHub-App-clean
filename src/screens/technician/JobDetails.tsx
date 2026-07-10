import React, { useContext } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppContext } from '../../navigation/AppNavigator';
import { Job } from '../../types';
import { technicianSharePercent } from '../../data';
import { normalizePhoneForDial } from '../../services/validation';
import * as Location from 'expo-location';
import { startLocationSharing } from '../../services/location.service';
import { openInMaps } from '../../services/mapLink.service';

export default function JobDetails({ route, navigation }: any) {
  const { job } = route.params || {};
  const { updateJobStatus, user } = useContext(AppContext);
  if (!job) return null;

  const estimatedEarnings = (job.totalPrice * technicianSharePercent / 100).toFixed(2);

  const handleStartJob = async () => {
    updateJobStatus(job.id, { status: 'in_progress' });
    navigation.navigate('ActiveService', { job: { ...job, status: 'in_progress' } });
    // Start live location sharing (fire-and-forget). If the user denies
    // permission or sharing fails, the job still proceeds — location is
    // best-effort, never a blocker for starting the service.
    try {
      await startLocationSharing(job.id, user?.id ?? '');
    } catch {
      // error already logged by the service; nothing else to do here.
    }
  };

  // Dial the customer directly. The order already carries customerPhone
  // (snapshot at creation), so we normalize and open a tel: deep link.
  const handleCallCustomer = () => {
    const dial = normalizePhoneForDial(job.customerPhone);
    if (!dial) {
      Alert.alert('No Phone Number', 'This customer has not provided a phone number yet.');
      return;
    }
    Linking.openURL(`tel:${dial}`);
  };

  // Open the customer's address in the native maps app for turn-by-turn
  // navigation. Resolves the destination via the OS geocoder (no key).
  const handleNavigateToCustomer = async () => {
    try {
      const res = await Location.geocodeAsync(`${job.address}, ${job.city}, ${job.zipCode}`);
      if (!res[0]) {
        Alert.alert('Address not found', 'Could not locate the customer address.');
        return;
      }
      await openInMaps(res[0].latitude, res[0].longitude, { label: job.customerName });
    } catch {
      Alert.alert('Navigation unavailable', 'Could not start navigation right now.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFBFC' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A' }}>Job Details</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        {/* Service Header */}
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 12, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <View>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A' }}>{job.serviceType}</Text>
              <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{job.jobCode || job.id} - {job.rooms}</Text>
            </View>
            <View style={{ backgroundColor: '#FFE2EC', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#FF4F8B' }}>${estimatedEarnings}</Text>
              <Text style={{ fontSize: 9, color: '#FF4F8B', textAlign: 'center' }}>est. earnings</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="calendar-outline" size={12} color="#64748B" />
              <Text style={{ fontSize: 11, color: '#64748B' }}>{job.date}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="time-outline" size={12} color="#64748B" />
              <Text style={{ fontSize: 11, color: '#64748B' }}>{job.timeSlot}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="cash-outline" size={12} color="#64748B" />
              <Text style={{ fontSize: 11, color: '#64748B' }}>${job.totalPrice}</Text>
            </View>
          </View>
        </View>

        {/* Customer Bio */}
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 12, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 10 }}>Customer</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {job.customerAvatar ? (
              <Image source={{ uri: job.customerAvatar }} style={{ width: 44, height: 44, borderRadius: 22 }} />
            ) : (
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFE2EC', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#FF4F8B' }}>{job.customerName[0]}</Text>
              </View>
            )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }}>{job.customerName}</Text>
            <Text style={{ fontSize: 12, color: '#64748B' }}>{job.customerPhone || 'No phone provided'}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={handleCallCustomer}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF1F6', justifyContent: 'center', alignItems: 'center' }}
            >
              <Ionicons name="call" size={16} color="#FF4F8B" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('SupportChat', { job })}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF1F6', justifyContent: 'center', alignItems: 'center' }}
            >
              <Ionicons name="chatbubble" size={16} color="#FF4F8B" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Prominent Call Customer action, positioned right under the customer
            information section. Disabled when no number is available. */}
        <TouchableOpacity
          onPress={handleCallCustomer}
          disabled={!normalizePhoneForDial(job.customerPhone)}
          style={{
            marginTop: 14,
            backgroundColor: normalizePhoneForDial(job.customerPhone) ? '#FF4F8B' : '#F1F5F9',
            borderRadius: 12,
            paddingVertical: 13,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Ionicons name="call" size={18} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Call Customer</Text>
          <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12 }}>
            {job.customerPhone || 'No number'}
          </Text>
        </TouchableOpacity>
        </View>

        {/* Address */}
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 12, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 8 }}>Address</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <Ionicons name="location-outline" size={16} color="#64748B" style={{ marginTop: 2 }} />
            <Text style={{ fontSize: 13, color: '#0F172A', flex: 1, lineHeight: 18 }}>
              {job.address}{job.apartment ? `, ${job.apartment}` : ''}{'\n'}{job.city}, {job.zipCode}
            </Text>
          </View>
        </View>

        {/* Notes */}
        {job.notes && (
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 12, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 8 }}>Customer Notes</Text>
            <View style={{ backgroundColor: '#FAFBFC', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#F1F5F9', borderStyle: 'dashed' }}>
              <Text style={{ fontSize: 12, color: '#64748B', lineHeight: 18 }}>{job.notes}</Text>
            </View>
          </View>
        )}

        {/* Checklist Preview */}
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 12, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 10 }}>Checklist</Text>
          {job.checklist && job.checklist.length > 0 ? (
            job.checklist.map((item: any, i: number) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}>
                <Ionicons name={item.completed ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={item.completed ? '#10B981' : '#CBD5E1'} />
                <Text style={{ fontSize: 12, color: item.completed ? '#10B981' : '#0F172A', textDecorationLine: item.completed ? 'line-through' : 'none' }}>{item.text}</Text>
              </View>
            ))
          ) : (
            <Text style={{ fontSize: 12, color: '#94A3B8' }}>No checklist items selected for this job.</Text>
          )}
        </View>
      </ScrollView>

      {/* Bottom Bar */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F1F5F9', padding: 16, paddingBottom: 32, flexDirection: 'row', gap: 12 }}>
        <TouchableOpacity onPress={handleNavigateToCustomer} style={{ flex: 1, paddingVertical: 14, borderRadius: 999, borderWidth: 1, borderColor: '#F1F5F9', alignItems: 'center' }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748B' }}>Navigate</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleStartJob} style={{ flex: 2, backgroundColor: '#FF4F8B', paddingVertical: 14, borderRadius: 999, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
          <Ionicons name="play" size={16} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Start Job</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
