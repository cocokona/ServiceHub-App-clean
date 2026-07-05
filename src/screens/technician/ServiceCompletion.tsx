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

export default function ServiceCompletion({ route, navigation }: any) {
  const { job } = route.params || {};
  const { refreshJobs } = useContext(AppContext);
  const [technicianNotes, setTechnicianNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

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
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#dcfce7', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
          <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
        </View>
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#1a1a1a', marginBottom: 8, textAlign: 'center' }}>Service Completed!</Text>
        <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 32 }}>
          Thank you for completing this service. The customer will be notified.
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('Jobs')}
          style={{ backgroundColor: '#003d9b', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 }}
        >
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Back to Jobs</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e2ec' }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={22} color="#333" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#1a1a1a' }}>Service Summary</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        {/* Summary Card */}
        <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e0e2ec', marginBottom: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 }}>Service Summary</Text>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 12, color: '#666' }}>Service</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#333' }}>{job.serviceType}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 12, color: '#666' }}>Customer</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#333' }}>{job.customerName}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 12, color: '#666' }}>Duration</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#333' }}>{formatTime(job.elapsedTime)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 12, color: '#666' }}>Rooms</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#333' }}>{job.rooms}</Text>
            </View>
          </View>
        </View>

        {/* Checklist Completion */}
        <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e0e2ec', marginBottom: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 }}>Checklist Completed</Text>
          {job.checklist.map((item: any, i: number) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}>
              <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
              <Text style={{ fontSize: 12, color: '#333', flex: 1 }}>{item.text}</Text>
            </View>
          ))}
        </View>

        {/* Payment Summary */}
        <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e0e2ec', marginBottom: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 }}>Payment</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ fontSize: 12, color: '#666' }}>Service Total</Text>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#333' }}>${job.totalPrice?.toFixed(2)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ fontSize: 12, color: '#666' }}>Your Earnings (70%)</Text>
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#006c47' }}>${(job.totalPrice * 0.7).toFixed(2)}</Text>
          </View>
        </View>

        {/* Technician Notes */}
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 10 }}>Service Notes</Text>
        <TextInput
          value={technicianNotes}
          onChangeText={setTechnicianNotes}
          placeholder="Add notes about the service..."
          multiline
          numberOfLines={4}
          style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e2ec', borderRadius: 12, padding: 12, fontSize: 13, marginBottom: 16, textAlignVertical: 'top' }}
          placeholderTextColor="#aaa"
        />
      </ScrollView>

      {/* Bottom Bar */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e0e2ec', padding: 16, paddingBottom: 32 }}>
        <TouchableOpacity
          onPress={handleSubmit}
          style={{ backgroundColor: '#22c55e', paddingVertical: 14, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}
        >
          <Ionicons name="checkmark-circle" size={18} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Submit Completion</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
