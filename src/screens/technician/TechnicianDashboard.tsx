import React, { useState, useContext, useEffect, memo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { AppContext } from '../../navigation/AppNavigator';
import { Job } from '../../types';
import { apiPut } from '../../api/client';
import { daysOfWeek, scheduleSlots, technicianFilters, getStatusColor, defaultTechnicianRating } from '../../data';

export default memo(function TechnicianDashboard({ route, navigation }: any) {
  const { user, jobs, logout, updateJobStatus } = useContext(AppContext);
  const activeTab = route?.params?.tab || 'jobs';
  const [isOnline, setIsOnline] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [bio, setBio] = useState(user?.bio || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [hourlyRate, setHourlyRate] = useState(String(user?.hourlyRate || 45));

  // Schedule state
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const days = daysOfWeek;

  const filteredJobs = categoryFilter === 'all'
    ? jobs
    : jobs.filter((j) => j.serviceCategory === categoryFilter);

  const getStatusColorFn = (status: string) => getStatusColor(status, 'technician');

  const handleSaveProfile = async () => {
    try {
      await apiPut('/api/technician/profile', {
        userId: user?.id,
        bio,
        phone,
        hourlyRate: Number(hourlyRate),
      });
      setEditingProfile(false);
      Alert.alert('Success', 'Profile updated');
    } catch (err) {
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  // Profile Tab
  if (activeTab === 'profile') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFBFC' }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 20 }}>Profile</Text>
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 20 }}>Profile</Text>

        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#F1F5F9', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#FF4F8B', justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="construct" size={24} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A' }}>{user?.name}</Text>
              <Text style={{ fontSize: 12, color: '#64748B' }}>{user?.workCategory || 'All Services'}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="star" size={14} color="#F59E0B" />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>{defaultTechnicianRating}</Text>
            </View>
          </View>

          {editingProfile ? (
            <View style={{ gap: 12 }}>
              <TextInput value={bio} onChangeText={setBio} placeholder="Bio" multiline style={{ borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, padding: 12, fontSize: 13, textAlignVertical: 'top' }} placeholderTextColor="#94A3B8" />
              <TextInput value={phone} onChangeText={setPhone} placeholder="Phone" style={{ borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, padding: 12, fontSize: 13 }} placeholderTextColor="#94A3B8" />
              <TextInput value={hourlyRate} onChangeText={setHourlyRate} placeholder="Hourly Rate" keyboardType="numeric" style={{ borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, padding: 12, fontSize: 13 }} placeholderTextColor="#94A3B8" />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={() => setEditingProfile(false)} style={{ flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748B' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveProfile} style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: '#FF4F8B', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="call-outline" size={14} color="#64748B" />
                <Text style={{ fontSize: 13, color: '#0F172A' }}>{phone || 'No phone set'}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="cash-outline" size={14} color="#64748B" />
                <Text style={{ fontSize: 13, color: '#0F172A' }}>${hourlyRate}/hr</Text>
              </View>
              <Text style={{ fontSize: 12, color: '#64748B', lineHeight: 18 }}>{bio || 'No bio yet.'}</Text>
              <TouchableOpacity onPress={() => setEditingProfile(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <Ionicons name="create-outline" size={14} color="#FF4F8B" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#FF4F8B' }}>Edit Profile</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <TouchableOpacity onPress={logout} style={{ borderWidth: 1, borderColor: '#FEF2F2', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Ionicons name="log-out-outline" size={16} color="#EF4444" />
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#EF4444' }}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
  }

  // Schedule Tab
  if (activeTab === 'schedule') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFBFC' }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 20 }}>Schedule</Text>
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 20 }}>Schedule</Text>

        {/* Week Strip */}
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 20 }}>
          {days.map((day, i) => (
            <TouchableOpacity
              key={day}
              onPress={() => setSelectedDay(i)}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: selectedDay === i ? '#FF4F8B' : '#FFFFFF',
                borderWidth: 1,
                borderColor: selectedDay === i ? '#FF4F8B' : '#F1F5F9',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '600', color: selectedDay === i ? '#FFFFFF' : '#64748B' }}>{day}</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: selectedDay === i ? '#FFFFFF' : '#0F172A', marginTop: 2 }}>{i + 1}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Availability Toggles */}
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 12 }}>Availability</Text>
          {scheduleSlots.map((slot) => (
            <View key={slot} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}>
              <Text style={{ fontSize: 13, color: '#0F172A' }}>{slot}</Text>
              <Switch value={true} trackColor={{ false: '#F1F5F9', true: '#FFE2EC' }} thumbColor={true ? '#FF4F8B' : '#F1F5F9'} />
            </View>
          ))}
        </View>

        {/* Today's Jobs */}
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 10 }}>Today's Jobs</Text>
        {jobs.length === 0 ? (
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 32, borderWidth: 1, borderColor: '#F1F5F9', alignItems: 'center' }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFE2EC', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <Ionicons name="sparkles" size={28} color="#FF4F8B" />
            </View>
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#0F172A', marginBottom: 4 }}>All Clear!</Text>
            <Text style={{ fontSize: 13, color: '#64748B' }}>No jobs scheduled for today</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {jobs.map((job) => (
              <TouchableOpacity
                key={job.id}
                onPress={() => navigation.navigate('JobDetails', { job })}
                style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F1F5F9', flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
              >
                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#FFE2EC', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="briefcase" size={18} color="#FF4F8B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#0F172A' }}>{job.serviceType}</Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>{job.timeSlot}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
  }

  // Jobs Tab (default)
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFBFC' }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); setRefreshing(false); }} />}
      >
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <View>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#0F172A' }}>Hello, {user?.name?.split(' ')[0] || 'Tech'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isOnline ? '#10B981' : '#94A3B8' }} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: isOnline ? '#10B981' : '#94A3B8' }}>{isOnline ? 'Active & Online' : 'Offline'}</Text>
          </View>
        </View>
        <Switch value={isOnline} onValueChange={setIsOnline} trackColor={{ false: '#F1F5F9', true: '#FFE2EC' }} thumbColor={isOnline ? '#FF4F8B' : '#F1F5F9'} />
      </View>

      {/* Stats */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Jobs', value: jobs.length.toString(), icon: 'briefcase' as const },
          { label: 'Earnings', value: `$${jobs.reduce((s, j) => s + j.totalPrice, 0).toFixed(0)}`, icon: 'cash' as const },
        ].map((stat) => (
          <View key={stat.label} style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F1F5F9', alignItems: 'center', gap: 4 }}>
            <Ionicons name={stat.icon} size={18} color="#FF4F8B" />
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A' }}>{stat.value}</Text>
            <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '600' }}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Category Filter */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        {technicianFilters.map((cat) => (
          <TouchableOpacity
            key={cat}
            onPress={() => setCategoryFilter(cat)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: categoryFilter === cat ? '#FF4F8B' : '#FFFFFF',
              borderWidth: 1,
              borderColor: categoryFilter === cat ? '#FF4F8B' : '#F1F5F9',
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '600', color: categoryFilter === cat ? '#FFFFFF' : '#64748B' }}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Job List */}
      {filteredJobs.length === 0 ? (
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 40, borderWidth: 1, borderColor: '#F1F5F9', alignItems: 'center' }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFE2EC', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
            <Ionicons name="sparkles" size={32} color="#FF4F8B" />
          </View>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#0F172A', marginBottom: 4 }}>No Jobs Yet</Text>
          <Text style={{ fontSize: 13, color: '#64748B' }}>New job requests will appear here</Text>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {filteredJobs.map((job) => (
            <TouchableOpacity
              key={job.id}
              onPress={() => navigation.navigate('JobDetails', { job })}
              style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }}>{job.serviceType}</Text>
                  <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{job.customerName}</Text>
                </View>
                <View style={{ backgroundColor: getStatusColorFn(job.status) + '20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: getStatusColorFn(job.status) }}>{job.status.replace(/_/g, ' ').toUpperCase()}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Ionicons name="location-outline" size={12} color="#64748B" />
                <Text style={{ fontSize: 12, color: '#64748B' }}>{job.city}, {job.zipCode}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#FF4F8B' }}>${job.totalPrice.toFixed(2)}</Text>
                <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  </SafeAreaView>
  );
});
