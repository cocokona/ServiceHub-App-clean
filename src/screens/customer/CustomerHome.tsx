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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { AppContext } from '../../navigation/AppNavigator';
import { getImageUrl, categories, recommendedTechnicians, mockNotifications, cities, defaultLocation, getStatusColor, categoryConfig } from '../../data';
import { PINK, PINK_SOFT, INK, MUTED, ACCENT, ACCENT_SOFT, CANVAS } from '../../theme/colors';
import { Technician, Job } from '../../types';
import { updateProfile } from '../../services/auth.service';
import { fetchTechnicians } from '../../services/database.service';

// Delight Experience palette — imported from theme/colors

export default memo(function CustomerHome({ route, navigation }: any) {
  const { user, setUser, jobs, logout, refreshJobs } = useContext(AppContext);
  const activeTab = route?.params?.tab || 'home';
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(defaultLocation);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications] = useState(mockNotifications);
  const [showNotifications, setShowNotifications] = useState(false);
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profilePhone, setProfilePhone] = useState(user?.phone || '');
  const [profileAddress, setProfileAddress] = useState(user?.address || '');
  const [editingProfile, setEditingProfile] = useState(false);

  useEffect(() => {
    fetchTechnicians().then((data) => {
      setTechnicians(data);
    }).catch((err) => {
      console.error('Failed to fetch technicians:', err);
    });
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

  const getStatusColorFn = (status: string) => getStatusColor(status, 'customer');

  // Profile Tab
  if (activeTab === 'profile') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFBFC' }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 20 }}>Profile</Text>
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFE2EC', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 24, fontWeight: '700', color: '#FF4F8B' }}>
                {(user?.name || 'U')[0]}
              </Text>
            </View>
            <View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A' }}>{user?.name}</Text>
              <Text style={{ fontSize: 12, color: '#64748B' }}>{user?.email}</Text>
            </View>
          </View>

          {editingProfile ? (
            <View style={{ gap: 12 }}>
              <TextInput value={profileName} onChangeText={setProfileName} style={{ borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, padding: 12, fontSize: 13 }} />
              <TextInput value={profilePhone} onChangeText={setProfilePhone} style={{ borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, padding: 12, fontSize: 13 }} />
              <TextInput value={profileAddress} onChangeText={setProfileAddress} style={{ borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, padding: 12, fontSize: 13 }} />
              <TouchableOpacity onPress={async () => {
                const result = await updateProfile({
                  name: profileName || undefined,
                  phone: profilePhone || undefined,
                  address: profileAddress || undefined,
                });
                if (result.error) {
                  Alert.alert('Error', result.error);
                } else {
                  setUser(result.user);
                  setEditingProfile(false);
                }
              }} style={{ backgroundColor: '#FF4F8B', padding: 12, borderRadius: 12, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Save</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="person-outline" size={16} color="#64748B" />
                <Text style={{ fontSize: 13, color: '#0F172A' }}>{profileName || 'No name set'}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="call-outline" size={16} color="#64748B" />
                <Text style={{ fontSize: 13, color: '#64748B' }}>{profilePhone || 'No phone set'}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="location-outline" size={16} color="#64748B" />
                <Text style={{ fontSize: 13, color: '#64748B' }}>{profileAddress || 'No address set'}</Text>
              </View>
              <TouchableOpacity onPress={() => setEditingProfile(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Ionicons name="create-outline" size={14} color="#FF4F8B" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#FF4F8B' }}>Edit Profile</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={{ backgroundColor: '#D1FAE5', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <Ionicons name="shield-checkmark" size={18} color="#10B981" />
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#10B981', flex: 1 }}>Escrow protection active on all bookings</Text>
        </View>

        <TouchableOpacity onPress={logout} style={{ borderWidth: 1, borderColor: '#FEF2F2', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Ionicons name="log-out-outline" size={16} color="#EF4444" />
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#EF4444' }}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
  }

  // Orders Tab
  if (activeTab === 'orders') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFBFC' }}>
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 20 }}>My Orders</Text>
        {jobs.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            {/* Pink glow + sparkles illustration */}
            <View
              style={{
                width: 160,
                height: 160,
                borderRadius: 80,
                backgroundColor: PINK_SOFT,
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 24,
                position: 'relative',
              }}
            >
              <View
                style={{
                  position: 'absolute',
                  width: 160,
                  height: 160,
                  borderRadius: 80,
                  backgroundColor: PINK,
                  opacity: 0.08,
                  top: 8,
                }}
              />
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <Ionicons name="sparkles" size={20} color={ACCENT} />
                <Ionicons name="star" size={28} color={PINK} />
                <Ionicons name="sparkles" size={16} color="#FF4F8B" />
              </View>
            </View>

            <Text style={{ fontSize: 22, fontWeight: '800', color: INK, textAlign: 'center', letterSpacing: -0.4 }}>
              Your adventure starts here!
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: MUTED,
                textAlign: 'center',
                marginTop: 10,
                lineHeight: 19,
                paddingHorizontal: 12,
                fontWeight: '500',
              }}
            >
              No bookings yet — but that's about to change.{'\n'}Your spotless home is just one tap away.
            </Text>

            <TouchableOpacity
              onPress={() => startBooking('cleaning')}
              activeOpacity={0.85}
              style={{
                marginTop: 24,
                backgroundColor: PINK,
                paddingVertical: 16,
                paddingHorizontal: 28,
                borderRadius: 999,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                shadowColor: PINK,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.3,
                shadowRadius: 14,
                elevation: 5,
              }}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>
                Book Your First Service
              </Text>
            </TouchableOpacity>

            {/* First-time bonus card */}
            <View
              style={{
                marginTop: 18,
                backgroundColor: ACCENT_SOFT,
                borderRadius: 16,
                padding: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                alignSelf: 'stretch',
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: ACCENT,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="gift" size={18} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: INK }}>
                  First-time bonus 🎁
                </Text>
                <Text style={{ fontSize: 11, color: MUTED, marginTop: 2, lineHeight: 15 }}>
                  Get 20% off your first booking — automatically applied at checkout.
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {jobs.map((job) => (
              <TouchableOpacity
                key={job.id}
                onPress={() => navigation.navigate('Tracking', { job })}
                style={{
                  backgroundColor: '#fff',
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: '#F1F5F9',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.06,
                  shadowRadius: 8,
                  elevation: 2,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }}>{job.serviceType}</Text>
                    <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{job.jobCode || job.id}</Text>
                  </View>
                  <View style={{ backgroundColor: getStatusColorFn(job.status) + '20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: getStatusColorFn(job.status) }}>
                      {job.status.replace(/_/g, ' ').toUpperCase()}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Ionicons name="location-outline" size={12} color="#64748B" />
                  <Text style={{ fontSize: 12, color: '#64748B' }}>{job.address}, {job.city}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#FF4F8B' }}>${job.totalPrice.toFixed(2)}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#FF4F8B' }}>Track</Text>
                    <Ionicons name="arrow-forward" size={12} color="#FF4F8B" />
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFBFC' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 12 }}>
        <View>
          <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600' }}>Current Location</Text>
          <TouchableOpacity onPress={() => setShowLocationModal(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="location" size={14} color="#FF4F8B" />
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>{selectedLocation}</Text>
            <Ionicons name="chevron-down" size={14} color="#64748B" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => setShowNotifications(true)} style={{ position: 'relative' }}>
          <Ionicons name="notifications-outline" size={24} color="#0F172A" />
          {unreadCount > 0 && (
            <View style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center' }}>
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
          style={{ marginHorizontal: 20, marginBottom: 16, backgroundColor: '#FFE2EC', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}
        >
          <Ionicons name="information-circle" size={20} color="#FF4F8B" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#E03572' }}>Active Service</Text>
            <Text style={{ fontSize: 11, color: '#FF4F8B' }}>You have a service in progress</Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color="#FF4F8B" />
        </TouchableOpacity>
      )}

      {/* Category Promotional Banners */}
      <View style={{ marginBottom: 20 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
          {categories.map((cat) => {
            const cfg = categoryConfig[cat.key];
            return (
              <TouchableOpacity
                key={cat.key}
                onPress={() => startBooking(cat.key)}
                style={{ width: 260, borderRadius: 16, overflow: 'hidden', backgroundColor: cat.color }}
              >
                <View style={{ padding: 18 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.6)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                    <Ionicons name={(cfg?.bannerIcon || cat.icon) as keyof typeof Ionicons.glyphMap} size={20} color="#0F172A" />
                  </View>
                  <Text style={{ color: '#0F172A', fontSize: 17, fontWeight: '800', marginBottom: 4 }}>{cfg?.bannerTitle || cat.label}</Text>
                  <Text style={{ color: '#475569', fontSize: 11, marginBottom: 12, lineHeight: 16 }}>{cfg?.bannerSubtitle || 'Professional services at your door'}</Text>
                  <View style={{ backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#FF4F8B' }}>Book Now</Text>
                    <Ionicons name="arrow-forward" size={11} color="#FF4F8B" />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Categories */}
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A', paddingHorizontal: 20, marginBottom: 12 }}>Services</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 12, marginBottom: 24 }}>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            onPress={() => startBooking(cat.key)}
            style={{
              width: '47%',
              backgroundColor: '#fff',
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: '#F1F5F9',
              alignItems: 'center',
              gap: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: cat.color, justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name={cat.icon as keyof typeof Ionicons.glyphMap} size={20} color={INK} />
            </View>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#0F172A' }}>{cat.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Recommended Technicians */}
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A', paddingHorizontal: 20, marginBottom: 12 }}>Recommended</Text>
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 12 }}>
        {(technicians.length > 0 ? technicians : recommendedTechnicians).slice(0, 2).map((tech, i) => (
          <TouchableOpacity
            key={tech.id || i}
            onPress={() => startBooking(tech.specialty || 'cleaning', tech)}
            style={{
              flex: 1,
              backgroundColor: '#fff',
              borderRadius: 16,
              padding: 14,
              borderWidth: 1,
              borderColor: '#F1F5F9',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            {tech.avatar ? (
              <Image source={{ uri: tech.avatar }} style={{ width: 48, height: 48, borderRadius: 24, marginBottom: 8 }} />
            ) : (
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFE2EC', justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#FF4F8B' }}>{tech.name[0]}</Text>
              </View>
            )}
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>{tech.name}</Text>
            <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 6 }}>{tech.specialty}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <Ionicons name="star" size={12} color="#f59e0b" />
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#0F172A' }}>{tech.rating}</Text>
              <Text style={{ fontSize: 10, color: '#94A3B8' }}>({tech.reviewsCount})</Text>
            </View>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#FF4F8B' }}>${tech.ratePerHour}/hr</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Location Modal */}
      <Modal visible={showLocationModal} transparent animationType="slide">
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }} onPress={() => setShowLocationModal(false)}>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <TouchableOpacity activeOpacity={1} style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '60%' }}>
              <View style={{ width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />
              <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 16 }}>Select Location</Text>
              {cities.map((city) => (
                <TouchableOpacity
                  key={city}
                  onPress={() => { setSelectedLocation(city); setShowLocationModal(false); }}
                  style={{ paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}
                >
                  <Text style={{ fontSize: 14, color: '#0F172A' }}>{city}</Text>
                  {selectedLocation === city && <Ionicons name="checkmark" size={18} color="#FF4F8B" />}
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
              <View style={{ width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />
              <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 16 }}>Notifications</Text>
              {notifications.map((n) => (
                <View key={n.id} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>{n.title}</Text>
                  <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{n.message}</Text>
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
