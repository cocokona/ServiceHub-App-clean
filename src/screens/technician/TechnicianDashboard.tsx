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
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const filteredJobs = categoryFilter === 'all'
    ? jobs
    : jobs.filter((j) => j.serviceCategory === categoryFilter);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'confirmed': return '#3b82f6';
      case 'on_the_way': return '#8b5cf6';
      case 'in_progress': return '#10b981';
      case 'completed': return '#22c55e';
      default: return '#6b7280';
    }
  };

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
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#1a1a1a', marginBottom: 20 }}>Profile</Text>
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#1a1a1a', marginBottom: 20 }}>Profile</Text>

        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#e0e2ec', marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#003d9b', justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="construct" size={24} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#1a1a1a' }}>{user?.name}</Text>
              <Text style={{ fontSize: 12, color: '#666' }}>{user?.workCategory || 'All Services'}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="star" size={14} color="#f59e0b" />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#333' }}>4.9</Text>
            </View>
          </View>

          {editingProfile ? (
            <View style={{ gap: 12 }}>
              <TextInput value={bio} onChangeText={setBio} placeholder="Bio" multiline style={{ borderWidth: 1, borderColor: '#e0e2ec', borderRadius: 12, padding: 12, fontSize: 13, textAlignVertical: 'top' }} placeholderTextColor="#aaa" />
              <TextInput value={phone} onChangeText={setPhone} placeholder="Phone" style={{ borderWidth: 1, borderColor: '#e0e2ec', borderRadius: 12, padding: 12, fontSize: 13 }} placeholderTextColor="#aaa" />
              <TextInput value={hourlyRate} onChangeText={setHourlyRate} placeholder="Hourly Rate" keyboardType="numeric" style={{ borderWidth: 1, borderColor: '#e0e2ec', borderRadius: 12, padding: 12, fontSize: 13 }} placeholderTextColor="#aaa" />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={() => setEditingProfile(false)} style={{ flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e0e2ec', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#666' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveProfile} style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: '#003d9b', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="call-outline" size={14} color="#666" />
                <Text style={{ fontSize: 13, color: '#333' }}>{phone || 'No phone set'}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="cash-outline" size={14} color="#666" />
                <Text style={{ fontSize: 13, color: '#333' }}>${hourlyRate}/hr</Text>
              </View>
              <Text style={{ fontSize: 12, color: '#666', lineHeight: 18 }}>{bio || 'No bio yet.'}</Text>
              <TouchableOpacity onPress={() => setEditingProfile(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <Ionicons name="create-outline" size={14} color="#003d9b" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#003d9b' }}>Edit Profile</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <TouchableOpacity onPress={logout} style={{ borderWidth: 1, borderColor: '#fecaca', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Ionicons name="log-out-outline" size={16} color="#dc2626" />
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#dc2626' }}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
  }

  // Schedule Tab
  if (activeTab === 'schedule') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#1a1a1a', marginBottom: 20 }}>Schedule</Text>
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#1a1a1a', marginBottom: 20 }}>Schedule</Text>

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
                backgroundColor: selectedDay === i ? '#003d9b' : '#fff',
                borderWidth: 1,
                borderColor: selectedDay === i ? '#003d9b' : '#e0e2ec',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '600', color: selectedDay === i ? '#fff' : '#666' }}>{day}</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: selectedDay === i ? '#fff' : '#333', marginTop: 2 }}>{i + 1}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Availability Toggles */}
        <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e0e2ec', marginBottom: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 }}>Availability</Text>
          {['Morning (8AM-12PM)', 'Afternoon (12PM-5PM)', 'Evening (5PM-9PM)'].map((slot) => (
            <View key={slot} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}>
              <Text style={{ fontSize: 13, color: '#333' }}>{slot}</Text>
              <Switch value={true} trackColor={{ false: '#e0e2ec', true: '#86d4ff' }} thumbColor={true ? '#003d9b' : '#f4f3f4'} />
            </View>
          ))}
        </View>

        {/* Today's Jobs */}
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 10 }}>Today's Jobs</Text>
        {jobs.length === 0 ? (
          <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 24, borderWidth: 1, borderColor: '#e0e2ec', alignItems: 'center' }}>
            <Ionicons name="calendar-outline" size={32} color="#ccc" />
            <Text style={{ fontSize: 13, color: '#999', marginTop: 8 }}>No jobs scheduled</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {jobs.map((job) => (
              <TouchableOpacity
                key={job.id}
                onPress={() => navigation.navigate('JobDetails', { job })}
                style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e0e2ec', flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#d8e2ff', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="briefcase" size={18} color="#003d9b" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#333' }}>{job.serviceType}</Text>
                  <Text style={{ fontSize: 11, color: '#666' }}>{job.timeSlot}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#ccc" />
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); setRefreshing(false); }} />}
      >
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <View>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#1a1a1a' }}>Hello, {user?.name?.split(' ')[0] || 'Tech'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isOnline ? '#22c55e' : '#999' }} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: isOnline ? '#22c55e' : '#999' }}>{isOnline ? 'Active & Online' : 'Offline'}</Text>
          </View>
        </View>
        <Switch value={isOnline} onValueChange={setIsOnline} trackColor={{ false: '#e0e2ec', true: '#86d4ff' }} thumbColor={isOnline ? '#003d9b' : '#f4f3f4'} />
      </View>

      {/* Stats */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Jobs', value: jobs.length.toString(), icon: 'briefcase' as const },
          { label: 'Earnings', value: `$${jobs.reduce((s, j) => s + j.totalPrice, 0).toFixed(0)}`, icon: 'cash' as const },
        ].map((stat) => (
          <View key={stat.label} style={{ flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e0e2ec', alignItems: 'center', gap: 4 }}>
            <Ionicons name={stat.icon} size={18} color="#003d9b" />
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#1a1a1a' }}>{stat.value}</Text>
            <Text style={{ fontSize: 10, color: '#666', fontWeight: '600' }}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Category Filter */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        {['all', 'cleaning', 'repair', 'electrical'].map((cat) => (
          <TouchableOpacity
            key={cat}
            onPress={() => setCategoryFilter(cat)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: categoryFilter === cat ? '#003d9b' : '#fff',
              borderWidth: 1,
              borderColor: categoryFilter === cat ? '#003d9b' : '#e0e2ec',
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '600', color: categoryFilter === cat ? '#fff' : '#666' }}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Job List */}
      {filteredJobs.length === 0 ? (
        <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 40, borderWidth: 1, borderColor: '#e0e2ec', alignItems: 'center' }}>
          <Ionicons name="briefcase-outline" size={40} color="#ccc" />
          <Text style={{ fontSize: 14, color: '#999', marginTop: 12 }}>No jobs found</Text>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {filteredJobs.map((job) => (
            <TouchableOpacity
              key={job.id}
              onPress={() => navigation.navigate('JobDetails', { job })}
              style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e0e2ec' }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a' }}>{job.serviceType}</Text>
                  <Text style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{job.customerName}</Text>
                </View>
                <View style={{ backgroundColor: getStatusColor(job.status) + '20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: getStatusColor(job.status) }}>{job.status.replace(/_/g, ' ').toUpperCase()}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Ionicons name="location-outline" size={12} color="#666" />
                <Text style={{ fontSize: 12, color: '#666' }}>{job.city}, {job.zipCode}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#003d9b' }}>${job.totalPrice.toFixed(2)}</Text>
                <Ionicons name="chevron-forward" size={16} color="#ccc" />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  </SafeAreaView>
  );
});
