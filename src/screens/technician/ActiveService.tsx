import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppContext } from '../../navigation/AppNavigator';
import { Job } from '../../types';

export default function ActiveService({ route, navigation }: any) {
  const { job } = route.params || {};
  const { updateJobStatus } = useContext(AppContext);
  const [seconds, setSeconds] = useState(job?.elapsedTime || 0);
  const [checklist, setChecklist] = useState(job?.checklist || []);
  const [showAddOnModal, setShowAddOnModal] = useState(false);
  const [addOnName, setAddOnName] = useState('');
  const [addOnsPrice, setAddOnsPrice] = useState(0);
  const [totalPrice, setTotalPrice] = useState(job?.totalPrice || 0);
  const [showOptions, setShowOptions] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setSeconds((s: number) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setTotalPrice((job?.totalPrice || 0) + addOnsPrice);
  }, [addOnsPrice, job?.totalPrice]);

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const toggleChecklist = (index: number) => {
    setChecklist((prev: any[]) =>
      prev.map((item: any, i: number) =>
        i === index ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const handleComplete = () => {
    updateJobStatus(job.id, { status: 'completed', elapsedTime: seconds, addOnsPrice, totalPrice });
    navigation.navigate('ServiceCompletion', { job: { ...job, status: 'completed', elapsedTime: seconds, addOnsPrice, totalPrice } });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e2ec' }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={22} color="#333" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#1a1a1a' }}>Active Service</Text>
          <Text style={{ fontSize: 11, color: '#006c47', fontWeight: '600' }}>Checked In</Text>
        </View>
        <TouchableOpacity onPress={() => setShowOptions(true)}>
          <Ionicons name="ellipsis-vertical" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        {/* Timer */}
        <View style={{ backgroundColor: '#003d9b', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 20 }}>
          <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Elapsed Time</Text>
          <Text style={{ fontSize: 40, fontWeight: '800', color: '#fff', fontVariant: ['tabular-nums'], letterSpacing: 2 }}>{formatTime(seconds)}</Text>
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 8 }}>{job.serviceType} - {job.id}</Text>
        </View>

        {/* Checklist */}
        <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e0e2ec', marginBottom: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 }}>Task Checklist</Text>
          {checklist.map((item: any, i: number) => (
            <TouchableOpacity
              key={i}
              onPress={() => toggleChecklist(i)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: i < checklist.length - 1 ? 1 : 0, borderBottomColor: '#f0f0f0' }}
            >
              <Ionicons name={item.completed ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={item.completed ? '#22c55e' : '#ccc'} />
              <Text style={{ fontSize: 13, color: '#333', flex: 1, textDecorationLine: item.completed ? 'line-through' : 'none' }}>{item.text}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Add-ons */}
        <TouchableOpacity
          onPress={() => setShowAddOnModal(true)}
          style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e0e2ec', marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}
        >
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#dbeafe', justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="add" size={18} color="#3b82f6" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#333' }}>Add Service Add-on</Text>
            <Text style={{ fontSize: 11, color: '#666' }}>+$15.00 standard rate</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#ccc" />
        </TouchableOpacity>

        {/* Running Total */}
        <View style={{ backgroundColor: '#f0fdf4', borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#006c47' }}>Running Total</Text>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#006c47' }}>${totalPrice.toFixed(2)}</Text>
        </View>
      </ScrollView>

      {/* Bottom Bar */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e0e2ec', padding: 16, paddingBottom: 32 }}>
        <TouchableOpacity
          onPress={handleComplete}
          style={{ backgroundColor: '#22c55e', paddingVertical: 14, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}
        >
          <Ionicons name="checkmark-circle" size={18} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Complete Service</Text>
        </TouchableOpacity>
      </View>

      {/* Add-on Modal */}
      <Modal visible={showAddOnModal} transparent animationType="slide">
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }} onPress={() => setShowAddOnModal(false)}>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <TouchableOpacity activeOpacity={1} style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
              <View style={{ width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />
              <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 16 }}>Add Service Add-on</Text>
              <TextInput
                value={addOnName}
                onChangeText={setAddOnName}
                placeholder="Add-on name"
                style={{ borderWidth: 1, borderColor: '#e0e2ec', borderRadius: 12, padding: 12, fontSize: 13, marginBottom: 12 }}
                placeholderTextColor="#aaa"
              />
              <Text style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>+$15.00 Standard Rate</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={() => setShowAddOnModal(false)} style={{ flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e0e2ec', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#666' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setAddOnsPrice((p) => p + 15); setShowAddOnModal(false); setAddOnName(''); }}
                  style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: '#003d9b', alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Add</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Options Modal */}
      <Modal visible={showOptions} transparent animationType="slide">
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }} onPress={() => setShowOptions(false)}>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <TouchableOpacity activeOpacity={1} style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
              <View style={{ width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />
              {['Request Backup Dispatch', 'Pause Timer', 'Contact Customer Support'].map((option) => (
                <TouchableOpacity
                  key={option}
                  onPress={() => { setShowOptions(false); Alert.alert('Action', option); }}
                  style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}
                >
                  <Text style={{ fontSize: 14, color: '#333' }}>{option}</Text>
                </TouchableOpacity>
              ))}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
