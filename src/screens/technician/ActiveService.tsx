import React, { useState, useEffect, useCallback, useContext } from 'react';
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
import { addOnStandardRate, activeServiceMenuOptions } from '../../data';
import { stopLocationSharing } from '../../services/location.service';

export default function ActiveService({ route, navigation }: any) {
  const { job } = route.params || {};
  const { updateJobStatus, startServiceTimer, getServiceElapsed, clearServiceTimer, getServiceChecklist, setServiceChecklist } = useContext(AppContext);
  // Seed from the central start timestamp so the counter resumes exactly where
  // it left off after navigating back — falling back to a persisted elapsedTime
  // (e.g. a job resumed from a prior session) when no live timer is running.
  const [seconds, setSeconds] = useState(() =>
    getServiceElapsed(job?.id) || job?.elapsedTime || 0
  );
  // Seed the checklist from the job's persisted checklist (now derived from the
  // customer's selected add-on services) and fall back to the selected
  // focusAreas if, for any reason, the job carries no checklist yet.
  const deriveInitialChecklist = useCallback((): { text: string; completed: boolean }[] => {
    if (job?.checklist && job.checklist.length > 0) return job.checklist;
    return (job?.focusAreas || []).map((f: string) => ({ text: f, completed: false }));
  }, [job?.checklist, job?.focusAreas]);

  // Seed from the navigation-persistent store when we have already tracked this
  // job (e.g. after navigating away and back), otherwise from the job's own
  // checklist/focus areas. Keeping the live progress in AppContext — a ref
  // keyed by job id — is what lets the ticked items survive a goBack + re-enter
  // cycle that would otherwise throw away the component's local state.
  const [checklist, setChecklist] = useState<{ text: string; completed: boolean }[]>(() => {
    const stored = getServiceChecklist(job?.id);
    if (stored && stored.length > 0) return stored;
    return deriveInitialChecklist();
  });

  // Mirror every checklist change into the persistent store so the selection is
  // restored on the next visit. This also primes the store on first mount with
  // the derived seed, and re-persists whenever the technician toggles an item
  // or adds a service add-on.
  useEffect(() => {
    setServiceChecklist(job?.id, checklist);
  }, [job?.id, checklist, setServiceChecklist]);
  const [showAddOnModal, setShowAddOnModal] = useState(false);
  const [addOnName, setAddOnName] = useState('');
  const [addOnsPrice, setAddOnsPrice] = useState(0);
  const [totalPrice, setTotalPrice] = useState(job?.totalPrice || 0);
  const [showOptions, setShowOptions] = useState(false);

  useEffect(() => {
    // Ensure a running timer exists (idempotent) — this also covers any path
    // that lands on Active Service without going through the Start Job confirm.
    if (job?.id && job?.status === 'in_progress') startServiceTimer(job.id);
    // Re-derive elapsed every second from the central start timestamp rather
    // than incrementing a local counter, so the clock keeps counting in real
    // time even across unmount/remount when the technician navigates back.
    const interval = setInterval(() => setSeconds(getServiceElapsed(job?.id)), 1000);
    return () => clearInterval(interval);
  }, [job?.id, job?.status, getServiceElapsed, startServiceTimer]);

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
    // Read the authoritative elapsed value from the central timer so it is
    // accurate to the second even if the display tick lagged slightly.
    const elapsed = getServiceElapsed(job.id);
    stopLocationSharing(); // stop live sharing when the job ends
    clearServiceTimer(job.id); // stop counting; the job is done
    updateJobStatus(job.id, { status: 'completed', elapsedTime: elapsed, addOnsPrice, totalPrice });
    // Carry the live checklist (including any add-ons added during the visit)
    // into the completion summary so it reflects every task performed.
    navigation.navigate('ServiceCompletion', { job: { ...job, status: 'completed', elapsedTime: elapsed, addOnsPrice, totalPrice, checklist } });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFBFC' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A' }}>Active Service</Text>
          <Text style={{ fontSize: 11, color: '#10B981', fontWeight: '600' }}>Checked In</Text>
        </View>
        <TouchableOpacity onPress={() => setShowOptions(true)}>
          <Ionicons name="ellipsis-vertical" size={20} color="#64748B" />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        {/* Timer */}
        <View style={{ backgroundColor: '#FF4F8B', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 20, shadowColor: '#FF4F8B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4 }}>
          <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Elapsed Time</Text>
          <Text style={{ fontSize: 40, fontWeight: '800', color: '#fff', fontVariant: ['tabular-nums'], letterSpacing: 2 }}>{formatTime(seconds)}</Text>
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 8 }}>{job.serviceType} - {job.jobCode || job.id}</Text>
        </View>

        {/* Checklist */}
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 16, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 12 }}>Task Checklist</Text>
          {checklist.map((item: any, i: number) => (
            <TouchableOpacity
              key={i}
              onPress={() => toggleChecklist(i)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: i < checklist.length - 1 ? 1 : 0, borderBottomColor: '#F1F5F9' }}
            >
              <Ionicons name={item.completed ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={item.completed ? '#FF4F8B' : '#CBD5E1'} />
              <Text style={{ fontSize: 13, color: '#0F172A', flex: 1, textDecorationLine: item.completed ? 'line-through' : 'none' }}>{item.text}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Add-ons */}
        <TouchableOpacity
          onPress={() => setShowAddOnModal(true)}
          style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
        >
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFE2EC', justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="add" size={18} color="#FF4F8B" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#0F172A' }}>Add Service Add-on</Text>
            <Text style={{ fontSize: 11, color: '#64748B' }}>+${addOnStandardRate.toFixed(2)} standard rate</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
        </TouchableOpacity>

        {/* Running Total */}
        <View style={{ backgroundColor: '#D1FAE5', borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#10B981' }}>Running Total</Text>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#10B981' }}>${totalPrice.toFixed(2)}</Text>
        </View>
      </ScrollView>

      {/* Bottom Bar */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F1F5F9', padding: 16, paddingBottom: 32 }}>
        <TouchableOpacity
          onPress={handleComplete}
          style={{ backgroundColor: '#FF4F8B', paddingVertical: 14, borderRadius: 999, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}
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
              <View style={{ width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />
              <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 16 }}>Add Service Add-on</Text>
              <TextInput
                value={addOnName}
                onChangeText={setAddOnName}
                placeholder="Add-on name"
                style={{ borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, padding: 12, fontSize: 13, marginBottom: 12 }}
                placeholderTextColor="#94A3B8"
              />
              <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 16 }}>+${addOnStandardRate.toFixed(2)} Standard Rate</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={() => setShowAddOnModal(false)} style={{ flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748B' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setAddOnsPrice((p) => p + addOnStandardRate);
                    // A service add-on is also a task on the job checklist so the
                    // technician can mark it complete alongside the customer's
                    // selections. Falls back to a generic label when unnamed.
                    const label = addOnName.trim() || 'Additional Service';
                    setChecklist((prev: any[]) => [...prev, { text: label, completed: false }]);
                    setShowAddOnModal(false);
                    setAddOnName('');
                  }}
                  style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: '#FF4F8B', alignItems: 'center' }}
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
              <View style={{ width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />
              {activeServiceMenuOptions.map((option) => (
                <TouchableOpacity
                  key={option}
                  onPress={() => { setShowOptions(false); Alert.alert('Action', option); }}
                  style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}
                >
                  <Text style={{ fontSize: 14, color: '#0F172A' }}>{option}</Text>
                </TouchableOpacity>
              ))}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
