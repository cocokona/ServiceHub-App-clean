import React, { useState, useEffect, useContext, memo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { AppContext } from '../../navigation/AppNavigator';
import { IMAGE_URLS, RECOMMENDED_TECHNICIANS } from '../../data/constants';
import { Technician, Job } from '../../types';
import { apiGet } from '../../api/client';

const CATEGORIES = [
  { key: 'cleaning', label: 'Cleaning', icon: 'sparkles' as const, color: '#dbeafe' },
  { key: 'repair', label: 'Repair', icon: 'construct' as const, color: '#fef3c7' },
  { key: 'electrical', label: 'Electrical', icon: 'flash' as const, color: '#dcfce7' },
  { key: 'beauty', label: 'Beauty', icon: 'flower' as const, color: '#fce7f3' },
];

export default memo(function CustomerHome({ route, navigation }: any) {
  const { user, jobs, logout, refreshJobs } = useContext(AppContext);
  const activeTab = route?.params?.tab || 'home';
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState('San Francisco, CA');
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications] = useState([
    { id: '1', title: 'Service Confirmed', message: 'Your cleaning service is confirmed for tomorrow', read: false },
    { id: '2', title: 'Promo', message: '20% off your next booking', read: true },
    { id: '3', title: 'Reminder', message: 'Rate your last service experience', read: true },
  ]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profilePhone, setProfilePhone] = useState(user?.phone || '(555) 019-9800');
  const [profileAddress, setProfileAddress] = useState('123 Main St');
  const [editingProfile, setEditingProfile] = useState(false);

  useEffect(() => {
    apiGet('/api/technicians').then((data) => {
      if (Array.isArray(data)) {
        setTechnicians(data.map((t: any) => ({
          name: t.name,
          avatar: t.avatar || '',
          rating: t.rating || 0,
          reviewsCount: t.reviewsCount || 0,
          specialty: t.specialty || t.workCategory,
          ratePerHour: t.ratePerHour || 45,
        })));
      }
    }).catch(() => {});
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshJobs();
    setRefreshing(false);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const hasActiveBooking = jobs.some((j) => j.status !== 'completed' && j.status !== 'reported');

  const startBooking = (category: string, technician?: Technician) => {
    navigation.navigate('ServiceDetails', { category, technician });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'confirmed': return '#3b82f6';
      case 'on_the_way': return '#8b5cf6';
      case 'arrived': return '#06b6d4';
      case 'in_progress': return '#10b981';
      case 'completed': return '#22c55e';
      default: return '#6b7280';
    }
  };

  // Profile Tab
  if (activeTab === 'profile') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#1a1a1a', marginBottom: 20 }}>Profile</Text>
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#e0e2ec', marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#d8e2ff', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 24, fontWeight: '700', color: '#003d9b' }}>
                {(user?.name || 'U')[0]}
              </Text>
            </View>
            <View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#1a1a1a' }}>{user?.name}</Text>
              <Text style={{ fontSize: 12, color: '#666' }}>{user?.email}</Text>
            </View>
          </View>

          {editingProfile ? (
            <View style={{ gap: 12 }}>
              <TextInput value={profileName} onChangeText={setProfileName} style={{ borderWidth: 1, borderColor: '#e0e2ec', borderRadius: 12, padding: 12, fontSize: 13 }} />
              <TextInput value={profilePhone} onChangeText={setProfilePhone} style={{ borderWidth: 1, borderColor: '#e0e2ec', borderRadius: 12, padding: 12, fontSize: 13 }} />
              <TextInput value={profileAddress} onChangeText={setProfileAddress} style={{ borderWidth: 1, borderColor: '#e0e2ec', borderRadius: 12, padding: 12, fontSize: 13 }} />
              <TouchableOpacity onPress={() => setEditingProfile(false)} style={{ backgroundColor: '#003d9b', padding: 12, borderRadius: 12, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Save</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="person-outline" size={16} color="#666" />
                <Text style={{ fontSize: 13, color: '#333' }}>{profileName || 'No name set'}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="call-outline" size={16} color="#666" />
                <Text style={{ fontSize: 13, color: '#333' }}>{profilePhone}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="location-outline" size={16} color="#666" />
                <Text style={{ fontSize: 13, color: '#333' }}>{profileAddress}</Text>
              </View>
              <TouchableOpacity onPress={() => setEditingProfile(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Ionicons name="create-outline" size={14} color="#003d9b" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#003d9b' }}>Edit Profile</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={{ backgroundColor: '#f0fdf4', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <Ionicons name="shield-checkmark" size={18} color="#006c47" />
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#006c47', flex: 1 }}>Escrow protection active on all bookings</Text>
        </View>

        <TouchableOpacity onPress={logout} style={{ borderWidth: 1, borderColor: '#fecaca', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Ionicons name="log-out-outline" size={16} color="#dc2626" />
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#dc2626' }}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
  }

  // Orders Tab
  if (activeTab === 'orders') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#1a1a1a', marginBottom: 20 }}>My Orders</Text>
        {jobs.length === 0 ? (
          <View style={{ borderWidth: 2, borderColor: '#e0e2ec', borderStyle: 'dashed', borderRadius: 16, padding: 40, alignItems: 'center' }}>
            <Ionicons name="receipt-outline" size={40} color="#ccc" />
            <Text style={{ fontSize: 14, color: '#999', marginTop: 12 }}>No orders yet</Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {jobs.map((job) => (
              <TouchableOpacity
                key={job.id}
                onPress={() => navigation.navigate('Tracking', { job })}
                style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e0e2ec' }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a' }}>{job.serviceType}</Text>
                    <Text style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{job.id}</Text>
                  </View>
                  <View style={{ backgroundColor: getStatusColor(job.status) + '20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: getStatusColor(job.status) }}>
                      {job.status.replace(/_/g, ' ').toUpperCase()}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Ionicons name="location-outline" size={12} color="#666" />
                  <Text style={{ fontSize: 12, color: '#666' }}>{job.address}, {job.city}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#003d9b' }}>${job.totalPrice.toFixed(2)}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#003d9b' }}>Track</Text>
                    <Ionicons name="arrow-forward" size={12} color="#003d9b" />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
  }

  // Home Tab (default)
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 12 }}>
        <View>
          <Text style={{ fontSize: 11, color: '#666', fontWeight: '600' }}>Current Location</Text>
          <TouchableOpacity onPress={() => setShowLocationModal(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="location" size={14} color="#003d9b" />
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#1a1a1a' }}>{selectedLocation}</Text>
            <Ionicons name="chevron-down" size={14} color="#666" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => setShowNotifications(true)} style={{ position: 'relative' }}>
          <Ionicons name="notifications-outline" size={24} color="#333" />
          {unreadCount > 0 && (
            <View style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>{unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Active Booking Alert */}
      {hasActiveBooking && (
        <TouchableOpacity
          onPress={() => {
            const activeJob = jobs.find((j) => j.status !== 'completed' && j.status !== 'reported');
            if (activeJob) navigation.navigate('Tracking', { job: activeJob });
          }}
          style={{ marginHorizontal: 20, marginBottom: 16, backgroundColor: '#dbeafe', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}
        >
          <Ionicons name="information-circle" size={20} color="#3b82f6" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#1e40af' }}>Active Service</Text>
            <Text style={{ fontSize: 11, color: '#3b82f6' }}>You have a service in progress</Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color="#3b82f6" />
        </TouchableOpacity>
      )}

      {/* Hero Banner */}
      <View style={{ marginHorizontal: 20, marginBottom: 20, borderRadius: 16, overflow: 'hidden' }}>
        <Image source={{ uri: IMAGE_URLS.heroBanner }} style={{ width: '100%', height: 180 }} resizeMode="cover" />
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 4 }}>Expert Home Services</Text>
          <Text style={{ color: '#fff', fontSize: 12, opacity: 0.9, marginBottom: 8 }}>Book trusted professionals today</Text>
          <TouchableOpacity style={{ backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, alignSelf: 'flex-start' }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#003d9b' }}>Book Now</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Categories */}
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#1a1a1a', paddingHorizontal: 20, marginBottom: 12 }}>Services</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 12, marginBottom: 24 }}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            onPress={() => startBooking(cat.key)}
            style={{ width: '47%', backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e0e2ec', alignItems: 'center', gap: 8 }}
          >
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: cat.color, justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name={cat.icon} size={20} color="#333" />
            </View>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#333' }}>{cat.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Recommended Technicians */}
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#1a1a1a', paddingHorizontal: 20, marginBottom: 12 }}>Recommended</Text>
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 12 }}>
        {(technicians.length > 0 ? technicians : RECOMMENDED_TECHNICIANS).slice(0, 2).map((tech, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => startBooking('cleaning', tech)}
            style={{ flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#e0e2ec' }}
          >
            {tech.avatar ? (
              <Image source={{ uri: tech.avatar }} style={{ width: 48, height: 48, borderRadius: 24, marginBottom: 8 }} />
            ) : (
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#d8e2ff', justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#003d9b' }}>{tech.name[0]}</Text>
              </View>
            )}
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#1a1a1a' }}>{tech.name}</Text>
            <Text style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>{tech.specialty}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <Ionicons name="star" size={12} color="#f59e0b" />
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#333' }}>{tech.rating}</Text>
              <Text style={{ fontSize: 10, color: '#999' }}>({tech.reviewsCount})</Text>
            </View>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#003d9b' }}>${tech.ratePerHour}/hr</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Location Modal */}
      <Modal visible={showLocationModal} transparent animationType="slide">
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }} onPress={() => setShowLocationModal(false)}>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <TouchableOpacity activeOpacity={1} style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '60%' }}>
              <View style={{ width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />
              <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 16 }}>Select Location</Text>
              {['San Francisco, CA', 'Los Angeles, CA', 'New York, NY', 'Chicago, IL', 'Seattle, WA'].map((city) => (
                <TouchableOpacity
                  key={city}
                  onPress={() => { setSelectedLocation(city); setShowLocationModal(false); }}
                  style={{ paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}
                >
                  <Text style={{ fontSize: 14, color: '#333' }}>{city}</Text>
                  {selectedLocation === city && <Ionicons name="checkmark" size={18} color="#003d9b" />}
                </TouchableOpacity>
              ))}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Notifications Modal */}
      <Modal visible={showNotifications} transparent animationType="slide">
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }} onPress={() => setShowNotifications(false)}>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <TouchableOpacity activeOpacity={1} style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '70%' }}>
              <View style={{ width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />
              <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 16 }}>Notifications</Text>
              {notifications.map((n) => (
                <View key={n.id} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#1a1a1a' }}>{n.title}</Text>
                  <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{n.message}</Text>
                </View>
              ))}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  </SafeAreaView>
  );
});
