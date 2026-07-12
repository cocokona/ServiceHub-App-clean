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
import { updateProfile } from '../../services/auth.service';
import ProfilePictureUploader from '../../components/ProfilePictureUploader';
import { validateTechnicianAcceptProfile } from '../../services/validation';
import { fetchAllOrdersInProgress, acceptOrderInProgress, fetchTechnicianAvailability, setTechnicianAvailability } from '../../services/database.service';
import { scheduleSlots, technicianFilters, getStatusColor } from '../../data';

export default memo(function TechnicianDashboard({ route, navigation }: any) {
  const { user, setUser, jobs, logout, updateJobStatus, refreshJobs } = useContext(AppContext);
  const activeTab = route?.params?.tab || 'jobs';
  const [isOnline, setIsOnline] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState(user?.workCategory || 'all');
  const [refreshing, setRefreshing] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [bio, setBio] = useState(user?.bio || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [hourlyRate, setHourlyRate] = useState(user?.hourlyRate?.toString() || '');

  // Pending orders state
  const [pendingOrders, setPendingOrders] = useState<Job[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  // Schedule state — today + next 6 days
  const [weekDays, setWeekDays] = useState(() => {
    const result = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      result.push(d);
    }
    return result;
  });
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const selectedDate = weekDays[selectedDayIndex];
  // JS getDay(): 0=Sun,1=Mon...6=Sat. DB day_of_week: 0=Mon...6=Sun (Mon-first).
  // But we just use the JS day as the key for availability since we control both sides.
  const selectedDayOfWeek = selectedDate.getDay();

  // Availability state: map of "dayOfWeek-timeSlot" -> boolean
  const [availability, setAvailability] = useState<Record<string, boolean>>({});
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  // Map display slot labels to database time_slot keys
  const slotKeyMap: Record<string, string> = {
    'Morning (8AM-12PM)': 'morning',
    'Afternoon (12PM-5PM)': 'afternoon',
    'Evening (5PM-9PM)': 'evening',
  };

  // Fetch availability for the selected day
  const loadAvailability = async () => {
    if (!user?.id) return;
    setLoadingAvailability(true);
    try {
      const data = await fetchTechnicianAvailability(user.id);
      setAvailability(data);
    } catch (err) {
      console.error('Failed to load availability:', err);
    } finally {
      setLoadingAvailability(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'schedule') {
      loadAvailability();
    }
  }, [activeTab, user?.id]);

  // Toggle a slot and save to database
  const toggleAvailability = async (slotLabel: string) => {
    if (!user?.id) return;
    const key = slotKeyMap[slotLabel] || slotLabel;
    const currentVal = availability[`${selectedDayOfWeek}-${key}`] ?? true;
    const newVal = !currentVal;

    // Optimistic update
    setAvailability((prev) => ({ ...prev, [`${selectedDayOfWeek}-${key}`]: newVal }));

    try {
      await setTechnicianAvailability(user.id, selectedDayOfWeek, key, newVal);
    } catch (err) {
      // Revert on failure
      setAvailability((prev) => ({ ...prev, [`${selectedDayOfWeek}-${key}`]: currentVal }));
      Alert.alert('Error', 'Failed to update availability');
    }
  };

  const formatDayLabel = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short' });
  const formatDayNum = (d: Date) => d.getDate();
  const isToday = (d: Date) => {
    const now = new Date();
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  };

  const filteredJobs = categoryFilter === 'all'
    ? jobs
    : jobs.filter((j) => j.serviceCategory === categoryFilter);

  const getStatusColorFn = (status: string) => getStatusColor(status, 'technician');

  // Fetch pending orders from order_in_progress
  const fetchPendingOrders = async () => {
    setLoadingPending(true);
    try {
      const orders = await fetchAllOrdersInProgress();
      setPendingOrders(orders);
    } catch (err) {
      console.error('Failed to fetch pending orders:', err);
    } finally {
      setLoadingPending(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'pending') {
      fetchPendingOrders();
    }
  }, [activeTab]);

  // Accept an order — moves it from order_in_progress to jobs
  const handleAcceptOrder = async (orderId: string) => {
    if (!user?.id) return;

    // Enforce mandatory technician phone before accepting an order. Customers
    // need a way to reach the technician about their job, so a technician
    // without a phone on file cannot take work.
    const phoneCheck = validateTechnicianAcceptProfile({ phone: user?.phone });
    if (!phoneCheck.isValid) {
      Alert.alert(
        'Phone Number Required',
        'You must add a phone number to your profile before accepting orders, so customers can reach you.',
        [
          { text: 'Edit Profile', onPress: () => navigation.navigate('Profile') },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    setAcceptingId(orderId);
    try {
      await acceptOrderInProgress(orderId, user.id);
      // Remove from pending list
      setPendingOrders((prev) => prev.filter((o) => o.id !== orderId));
      // Refresh jobs to show the newly accepted order
      refreshJobs();
      Alert.alert('Accepted', 'Order accepted successfully!');
    } catch (err) {
      Alert.alert('Error', 'Failed to accept order. Please try again.');
    } finally {
      setAcceptingId(null);
    }
  };

  const handleAvatarUploaded = async (url: string) => {
    const result = await updateProfile({ avatarUrl: url });
    if (result.error) {
      Alert.alert('Error', result.error);
    } else if (result.user) {
      setUser(result.user);
    }
  };

  const handleAvatarRemoved = async () => {
    const result = await updateProfile({ avatarUrl: '' });
    if (result.error) {
      Alert.alert('Error', result.error);
    } else if (result.user) {
      setUser(result.user);
    }
  };

  const handleSaveProfile = async () => {
    // Technicians must keep a phone number on file (required to accept orders).
    if (user?.role === 'technician' && !phone.trim()) {
      Alert.alert('Phone Required', 'A phone number is required for technicians so customers can reach you.');
      return;
    }

    try {
      const result = await updateProfile({
        bio: bio || undefined,
        phone: phone || undefined,
        hourlyRate: hourlyRate ? Number(hourlyRate) : undefined,
      });
      if (result.error) {
        Alert.alert('Error', result.error);
      } else {
        setUser(result.user);
        setEditingProfile(false);
        Alert.alert('Success', 'Profile updated');
      }
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
            <ProfilePictureUploader
              uri={user?.avatarUrl}
              name={user?.name}
              size={56}
              shape="circle"
              fallbackIcon="construct"
              editButtonColor="#FF4F8B"
              onUploaded={handleAvatarUploaded}
              onRemove={handleAvatarRemoved}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A' }}>{user?.name}</Text>
              <Text style={{ fontSize: 12, color: '#64748B' }}>{user?.workCategory || 'All Services'}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="star" size={14} color="#F59E0B" />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>{user?.rating?.toFixed(1) || '—'}</Text>
            </View>
          </View>

          {editingProfile ? (
            <View style={{ gap: 12 }}>
              <TextInput value={bio} onChangeText={setBio} placeholder="Bio" multiline style={{ borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, padding: 12, fontSize: 13, textAlignVertical: 'top' }} placeholderTextColor="#94A3B8" />
              <TextInput value={phone} onChangeText={setPhone} placeholder="Phone * (required to accept orders)" keyboardType="phone-pad" style={{ borderWidth: 1, borderColor: phone.trim() ? '#F1F5F9' : '#FECACA', borderRadius: 12, padding: 12, fontSize: 13 }} placeholderTextColor="#94A3B8" />
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
                <Ionicons name="call-outline" size={14} color={phone ? '#64748B' : '#EF4444'} />
                <Text style={{ fontSize: 13, color: phone ? '#0F172A' : '#EF4444', fontWeight: phone ? '400' : '700' }}>{phone || 'No phone set (required)'}</Text>
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

  // Pending Orders Tab
  if (activeTab === 'pending') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFBFC' }}>
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={loadingPending} onRefresh={fetchPendingOrders} />}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 24, fontWeight: '800', color: '#0F172A' }}>Pending Orders</Text>
            <View style={{ backgroundColor: '#FFE2EC', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#FF4F8B' }}>{pendingOrders.length}</Text>
            </View>
          </View>

          {pendingOrders.length === 0 ? (
            <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 40, borderWidth: 1, borderColor: '#F1F5F9', alignItems: 'center' }}>
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                <Ionicons name="checkmark-done" size={32} color="#10B981" />
              </View>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#0F172A', marginBottom: 4 }}>All Caught Up</Text>
              <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center' }}>No pending orders right now.{'\n'}New orders from customers will appear here.</Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {pendingOrders.map((order) => (
                <View
                  key={order.id}
                  style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
                >
                  {/* Order Header */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: '#0F172A' }}>{order.serviceType}</Text>
                      <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>by {order.customerName}</Text>
                    </View>
                    <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#D97706' }}>PENDING</Text>
                    </View>
                  </View>

                  {/* Order Details */}
                  <View style={{ gap: 6, marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="location-outline" size={13} color="#64748B" />
                      <Text style={{ fontSize: 12, color: '#64748B' }}>{order.address}{order.city ? `, ${order.city}` : ''}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="calendar-outline" size={13} color="#64748B" />
                      <Text style={{ fontSize: 12, color: '#64748B' }}>{order.date} - {order.timeSlot}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="time-outline" size={13} color="#64748B" />
                      <Text style={{ fontSize: 12, color: '#64748B' }}>{order.duration}h duration</Text>
                    </View>
                    {order.focusAreas.length > 0 && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                        {order.focusAreas.map((area, i) => (
                          <View key={i} style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                            <Text style={{ fontSize: 10, color: '#475569' }}>{area}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Price + Accept */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 }}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: '#FF4F8B' }}>${order.totalPrice.toFixed(2)}</Text>
                    <TouchableOpacity
                      onPress={() => handleAcceptOrder(order.id)}
                      disabled={acceptingId === order.id}
                      style={{
                        backgroundColor: acceptingId === order.id ? '#FFE2EC' : '#FF4F8B',
                        paddingHorizontal: 20,
                        paddingVertical: 10,
                        borderRadius: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {acceptingId === order.id ? (
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#FF4F8B' }}>Accepting...</Text>
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>Accept</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
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

        {/* Week Strip — Today + Next 6 Days */}
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 20 }}>
          {weekDays.map((d, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => setSelectedDayIndex(i)}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: selectedDayIndex === i ? '#FF4F8B' : '#FFFFFF',
                borderWidth: 1,
                borderColor: selectedDayIndex === i ? '#FF4F8B' : '#F1F5F9',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '600', color: selectedDayIndex === i ? '#FFFFFF' : '#64748B' }}>{formatDayLabel(d)}</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: selectedDayIndex === i ? '#FFFFFF' : '#0F172A', marginTop: 2 }}>{formatDayNum(d)}</Text>
              {isToday(d) && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: selectedDayIndex === i ? '#fff' : '#FF4F8B', marginTop: 4 }} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Availability Toggles */}
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 12 }}>Availability — {formatDayLabel(selectedDate)} {formatDayNum(selectedDate)}</Text>
          {scheduleSlots.map((slot) => {
            const key = slotKeyMap[slot] || slot;
            const isOn = availability[`${selectedDayOfWeek}-${key}`] ?? true;
            return (
              <View key={slot} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}>
                <Text style={{ fontSize: 13, color: '#0F172A' }}>{slot}</Text>
                <Switch
                  value={isOn}
                  onValueChange={() => toggleAvailability(slot)}
                  trackColor={{ false: '#F1F5F9', true: '#FFE2EC' }}
                  thumbColor={isOn ? '#FF4F8B' : '#F1F5F9'}
                />
              </View>
            );
          })}
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

      {/* Category Filter — only show categories the technician can do */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        {(user?.workCategory && user.workCategory !== 'all'
          ? technicianFilters.filter((cat) => cat === 'all' || cat === user.workCategory)
          : technicianFilters
        ).map((cat) => (
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
