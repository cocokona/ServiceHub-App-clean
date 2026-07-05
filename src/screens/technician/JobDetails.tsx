import React, { useContext } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppContext } from '../../navigation/AppNavigator';
import { Job } from '../../types';

export default function JobDetails({ route, navigation }: any) {
  const { job } = route.params || {};
  const { updateJobStatus } = useContext(AppContext);
  if (!job) return null;

  const estimatedEarnings = (job.totalPrice * 0.7).toFixed(2);

  const handleStartJob = () => {
    updateJobStatus(job.id, { status: 'in_progress' });
    navigation.navigate('ActiveService', { job: { ...job, status: 'in_progress' } });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e2ec' }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={22} color="#333" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#1a1a1a' }}>Job Details</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        {/* Service Header */}
        <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e0e2ec', marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <View>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#1a1a1a' }}>{job.serviceType}</Text>
              <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{job.id} - {job.rooms}</Text>
            </View>
            <View style={{ backgroundColor: '#dbeafe', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#003d9b' }}>${estimatedEarnings}</Text>
              <Text style={{ fontSize: 9, color: '#3b82f6', textAlign: 'center' }}>est. earnings</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="calendar-outline" size={12} color="#666" />
              <Text style={{ fontSize: 11, color: '#666' }}>{job.date}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="time-outline" size={12} color="#666" />
              <Text style={{ fontSize: 11, color: '#666' }}>{job.timeSlot}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="cash-outline" size={12} color="#666" />
              <Text style={{ fontSize: 11, color: '#666' }}>${job.totalPrice}</Text>
            </View>
          </View>
        </View>

        {/* Customer Bio */}
        <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e0e2ec', marginBottom: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 10 }}>Customer</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {job.customerAvatar ? (
              <Image source={{ uri: job.customerAvatar }} style={{ width: 44, height: 44, borderRadius: 22 }} />
            ) : (
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#d8e2ff', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#003d9b' }}>{job.customerName[0]}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a' }}>{job.customerName}</Text>
              <Text style={{ fontSize: 12, color: '#666' }}>{job.customerPhone}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#f0f7ff', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="call" size={16} color="#003d9b" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation.navigate('SupportChat', { job })}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#f0f7ff', justifyContent: 'center', alignItems: 'center' }}
              >
                <Ionicons name="chatbubble" size={16} color="#003d9b" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Address */}
        <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e0e2ec', marginBottom: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 }}>Address</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <Ionicons name="location-outline" size={16} color="#666" style={{ marginTop: 2 }} />
            <Text style={{ fontSize: 13, color: '#333', flex: 1, lineHeight: 18 }}>
              {job.address}{job.apartment ? `, ${job.apartment}` : ''}{'\n'}{job.city}, {job.zipCode}
            </Text>
          </View>
        </View>

        {/* Notes */}
        {job.notes && (
          <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e0e2ec', marginBottom: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 }}>Customer Notes</Text>
            <View style={{ backgroundColor: '#f8fafc', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#e0e2ec', borderStyle: 'dashed' }}>
              <Text style={{ fontSize: 12, color: '#666', lineHeight: 18 }}>{job.notes}</Text>
            </View>
          </View>
        )}

        {/* Checklist Preview */}
        <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e0e2ec', marginBottom: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 10 }}>Checklist</Text>
          {job.checklist.map((item: any, i: number) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}>
              <Ionicons name={item.completed ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={item.completed ? '#22c55e' : '#ccc'} />
              <Text style={{ fontSize: 12, color: item.completed ? '#22c55e' : '#333', textDecorationLine: item.completed ? 'line-through' : 'none' }}>{item.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Bottom Bar */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e0e2ec', padding: 16, paddingBottom: 32, flexDirection: 'row', gap: 12 }}>
        <TouchableOpacity style={{ flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e0e2ec', alignItems: 'center' }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#666' }}>Navigate</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleStartJob} style={{ flex: 2, backgroundColor: '#003d9b', paddingVertical: 14, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
          <Ionicons name="play" size={16} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Start Job</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
