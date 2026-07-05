import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Job } from '../../types';
import { IMAGE_URLS } from '../../data/constants';

const STEPS = ['Booked', 'On Way', 'Arrived', 'In Service'];

export default function Tracking({ route, navigation }: any) {
  const { job } = route.params || {};
  if (!job) return null;

  const getStatusIndex = () => {
    switch (job.status) {
      case 'pending': return 0;
      case 'confirmed': return 0;
      case 'on_the_way': return 1;
      case 'arrived': return 2;
      case 'in_progress': return 3;
      case 'completed': return 3;
      default: return 0;
    }
  };

  const statusIndex = getStatusIndex();

  const getStatusInfo = () => {
    switch (job.status) {
      case 'on_the_way': return { title: 'On the Way', subtitle: 'Technician is heading to your location' };
      case 'arrived': return { title: 'Arrived', subtitle: 'Technician has arrived at your location' };
      case 'in_progress': return { title: 'In Progress', subtitle: 'Service is currently being performed' };
      case 'completed': return { title: 'Completed', subtitle: 'Service has been completed' };
      default: return { title: 'Confirmed', subtitle: 'Waiting for technician assignment' };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e2ec' }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={22} color="#333" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#1a1a1a' }}>{statusInfo.title}</Text>
          <Text style={{ fontSize: 11, color: '#666' }}>{statusInfo.subtitle}</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
        {/* Map */}
        <View style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 20, position: 'relative' }}>
          <Image source={{ uri: IMAGE_URLS.routeMap }} style={{ width: '100%', height: 180 }} resizeMode="cover" />
          <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(0,61,155,0.9)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>Live Tracking</Text>
          </View>
        </View>

        {/* Timeline */}
        <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: '#e0e2ec', marginBottom: 20 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 16 }}>Progress</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            {STEPS.map((step, i) => (
              <View key={step} style={{ alignItems: 'center', flex: 1 }}>
                <View style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: i <= statusIndex ? '#003d9b' : '#e0e2ec',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 6,
                }}>
                  {i < statusIndex ? (
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  ) : i === statusIndex ? (
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' }} />
                  ) : null}
                </View>
                <Text style={{ fontSize: 9, fontWeight: '600', color: i <= statusIndex ? '#003d9b' : '#999', textAlign: 'center' }}>{step}</Text>
                {i < STEPS.length - 1 && (
                  <View style={{
                    position: 'absolute',
                    top: 16,
                    left: '60%',
                    right: '-60%',
                    height: 2,
                    backgroundColor: i < statusIndex ? '#003d9b' : '#e0e2ec',
                  }} />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Technician Card */}
        <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e0e2ec', marginBottom: 20 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 }}>Your Technician</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {job.technicianAvatar ? (
              <Image source={{ uri: job.technicianAvatar }} style={{ width: 48, height: 48, borderRadius: 24 }} />
            ) : (
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#d8e2ff', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#003d9b' }}>{(job.technicianName || 'T')[0]}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a' }}>{job.technicianName || 'Assigned Technician'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Ionicons name="star" size={12} color="#f59e0b" />
                <Text style={{ fontSize: 11, color: '#666' }}>4.9</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#f0f7ff', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="call" size={16} color="#003d9b" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation.navigate('SupportChat', { job })}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#003d9b', justifyContent: 'center', alignItems: 'center' }}
              >
                <Ionicons name="chatbubble" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Service Details */}
        <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e0e2ec' }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 }}>Service Details</Text>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="briefcase-outline" size={14} color="#666" />
              <Text style={{ fontSize: 12, color: '#333', flex: 1 }}>{job.serviceType}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="location-outline" size={14} color="#666" />
              <Text style={{ fontSize: 12, color: '#333', flex: 1 }}>{job.address}, {job.city}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="time-outline" size={14} color="#666" />
              <Text style={{ fontSize: 12, color: '#333', flex: 1 }}>{job.rooms} - {job.duration}h</Text>
            </View>
            <View style={{ borderTopWidth: 1, borderTopColor: '#e0e2ec', marginTop: 4, paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#1a1a1a' }}>Total</Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#003d9b' }}>${job.totalPrice.toFixed(2)}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
