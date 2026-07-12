import React, { useState, useEffect, useContext, useCallback, memo } from 'react';
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
import { Technician, Job, SavedPaymentMethod, Review } from '../../types';
import { updateProfile } from '../../services/auth.service';
import ProfilePictureUploader from '../../components/ProfilePictureUploader';
import { fetchTechnicians } from '../../services/database.service';
import { fetchTopReview } from '../../services/review.service';
import {
  getPaymentMethods,
  addPaymentMethod,
  deletePaymentMethod,
  setDefaultPaymentMethod,
  formatCardNumber,
  normalizeExpiry,
  detectCardBrand,
} from '../../services/payment.service';
import {
  ADDRESS_FIELDS,
  formatAddress,
  profileToAddressFields,
  addressFieldsToProfile,
  validateAddressFields,
  type AddressFields,
} from '../../services/address';

// Delight Experience palette — imported from theme/colors

const fieldStyle = {
  borderWidth: 1,
  borderColor: '#F1F5F9',
  borderRadius: 12,
  padding: 12,
  fontSize: 13,
  color: '#0F172A',
} as const;

export default memo(function CustomerHome({ route, navigation }: any) {
  const { user, setUser, jobs, logout, refreshJobs } = useContext(AppContext);
  const activeTab = route?.params?.tab || 'home';
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [techTopReviews, setTechTopReviews] = useState<Record<string, Review | null>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(defaultLocation);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications] = useState(mockNotifications);
  const [showNotifications, setShowNotifications] = useState(false);
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profilePhone, setProfilePhone] = useState(user?.phone || '');
  const [addr, setAddr] = useState<AddressFields>(profileToAddressFields(user));
  const [editingProfile, setEditingProfile] = useState(false);
  // Mirrors the order form's requirement: a non-empty street is the minimum
  // for a "complete" address (city + ZIP are enforced on save via validation).
  const profileAddressSet = !!(user?.address && user.address.trim());

  // Payment methods — managed in the profile, sourced from the customer's
  // private (RLS-scoped) payment_methods table. New accounts start empty.
  const [paymentMethods, setPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [savingCard, setSavingCard] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  // Recommended technicians + each one's highest-rated written review.
  // Refetched whenever the Home tab becomes active, so a review submitted on
  // the tracking screen is reflected here immediately after submission.
  const loadRecommended = useCallback(async () => {
    try {
      const data = await fetchTechnicians();
      setTechnicians(data);
      const topTechs = data.slice(0, 2).filter((t) => t.id);
      const tops = await Promise.all(
        topTechs.map((t) => fetchTopReview(t.id as string))
      );
      const map: Record<string, Review | null> = {};
      topTechs.forEach((t, i) => {
        map[t.id as string] = tops[i];
      });
      setTechTopReviews(map);
    } catch (err) {
      console.error('Failed to load recommended technicians:', err);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'home') {
      loadRecommended();
    }
  }, [activeTab, loadRecommended]);

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

  // Open the technician's full reviews list. Only meaningful for a real
  // technician record (mock fallbacks have no id / no reviews to fetch).
  const openReviews = (technician: Technician) => {
    if (!technician.id) return;
    navigation.navigate('TechnicianReviews', {
      technicianId: technician.id,
      technicianName: technician.name,
      technicianAvatar: technician.avatar,
    });
  };

  const getStatusColorFn = (status: string) => getStatusColor(status, 'customer');

  // ---- Payment method management (profile) -------------------------------
  const loadPaymentMethods = useCallback(async () => {
    setLoadingPayments(true);
    try {
      const methods = await getPaymentMethods();
      setPaymentMethods(methods);
    } catch (err) {
      console.error('Failed to load payment methods:', err);
    } finally {
      setLoadingPayments(false);
    }
  }, []);

  // Load saved cards whenever the Profile tab becomes active. New accounts
  // simply render an empty list — no payment data is seeded.
  useEffect(() => {
    if (activeTab === 'profile') {
      loadPaymentMethods();
    }
  }, [activeTab, loadPaymentMethods]);

  const handleAddCard = async () => {
    setCardError(null);
    const exp = normalizeExpiry(cardExpiry);
    if (!exp) {
      setCardError('Please enter a valid expiry date (MM/YY).');
      return;
    }
    setSavingCard(true);
    try {
      await addPaymentMethod({
        cardNumber,
        cardholderName: cardName,
        expiryMonth: exp.month,
        expiryYear: exp.year,
        cvv: cardCvv,
      });
      setShowCardModal(false);
      setCardName('');
      setCardNumber('');
      setCardExpiry('');
      setCardCvv('');
      await loadPaymentMethods();
    } catch (err: any) {
      setCardError(err?.message || 'Could not save this card.');
    } finally {
      setSavingCard(false);
    }
  };

  const handleDeleteCard = (method: SavedPaymentMethod) => {
    Alert.alert(
      'Remove card',
      `Remove ${method.brand.charAt(0).toUpperCase() + method.brand.slice(1)} •••• ${method.last4}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePaymentMethod(method.id);
              await loadPaymentMethods();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Could not remove this card.');
            }
          },
        },
      ]
    );
  };

  const handleSetDefault = async (method: SavedPaymentMethod) => {
    try {
      await setDefaultPaymentMethod(method.id);
      await loadPaymentMethods();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not update the default card.');
    }
  };

  // ---- Profile picture (upload / remove) -----------------------------------
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

  // Profile Tab
  if (activeTab === 'profile') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFBFC' }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 20 }}>Profile</Text>
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <ProfilePictureUploader
              uri={user?.avatarUrl}
              name={user?.name}
              size={56}
              shape="circle"
              onUploaded={handleAvatarUploaded}
              onRemove={handleAvatarRemoved}
            />
            <View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A' }}>{user?.name}</Text>
              <Text style={{ fontSize: 12, color: '#64748B' }}>{user?.email}</Text>
            </View>
          </View>

          {editingProfile ? (
            <View style={{ gap: 12 }}>
              <TextInput value={profileName} onChangeText={setProfileName} placeholder="Name" style={{ borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, padding: 12, fontSize: 13 }} />
              <TextInput value={profilePhone} onChangeText={setProfilePhone} placeholder="Phone * (required to order)" keyboardType="phone-pad" style={{ borderWidth: 1, borderColor: profilePhone.trim() ? '#F1F5F9' : '#FECACA', borderRadius: 12, padding: 12, fontSize: 13 }} />
              {/* Address — same structured fields / validation / formatting as the
                  order form, rendered from the shared ADDRESS_FIELDS config. */}
              {ADDRESS_FIELDS.map((f) => {
                const value = addr[f.key];
                const invalid = f.required && !value.trim();
                return (
                  <TextInput
                    key={f.key}
                    value={value}
                    onChangeText={(text) => setAddr((prev) => ({ ...prev, [f.key]: text }))}
                    placeholder={f.placeholder}
                    keyboardType={f.keyboardType || 'default'}
                    maxLength={f.maxLength}
                    style={{ borderWidth: 1, borderColor: invalid ? '#FECACA' : '#F1F5F9', borderRadius: 12, padding: 12, fontSize: 13 }}
                  />
                );
              })}
              <TouchableOpacity onPress={async () => {
                if (!profilePhone.trim()) {
                  Alert.alert('Required Fields', 'Please add your phone number — it is required before placing an order.');
                  return;
                }
                const addressCheck = validateAddressFields(addr);
                if (!addressCheck.isValid) {
                  Alert.alert('Address Required', `Please complete your ${addressCheck.errors.join(' and ')} — both are required before placing an order.`);
                  return;
                }
                const result = await updateProfile({
                  name: profileName || undefined,
                  phone: profilePhone || undefined,
                  ...addressFieldsToProfile(addr),
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
                <Ionicons name="call-outline" size={16} color={profilePhone ? '#64748B' : '#EF4444'} />
                <Text style={{ fontSize: 13, color: profilePhone ? '#0F172A' : '#EF4444', fontWeight: profilePhone ? '400' : '700' }}>{profilePhone || 'No phone set (required)'}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="location-outline" size={16} color={profileAddressSet ? '#64748B' : '#EF4444'} />
                <Text style={{ fontSize: 13, color: profileAddressSet ? '#0F172A' : '#EF4444', fontWeight: profileAddressSet ? '400' : '700' }}>{profileAddressSet ? formatAddress(profileToAddressFields(user)) : 'No address set (required)'}</Text>
              </View>
              <TouchableOpacity onPress={() => setEditingProfile(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Ionicons name="create-outline" size={14} color="#FF4F8B" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#FF4F8B' }}>Edit Profile</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Payment Methods — relocated here from Checkout; sourced from the
            customer's private (RLS-scoped) payment_methods table. */}
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A' }}>Payment Methods</Text>
            <TouchableOpacity onPress={() => { setCardError(null); setShowCardModal(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="add" size={14} color="#FF4F8B" />
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#FF4F8B' }}>Add Card</Text>
            </TouchableOpacity>
          </View>

          {loadingPayments ? (
            <Text style={{ fontSize: 12, color: '#64748B' }}>Loading…</Text>
          ) : paymentMethods.length === 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14 }}>
              <Ionicons name="card-outline" size={20} color="#94A3B8" />
              <Text style={{ fontSize: 12, color: '#64748B', flex: 1 }}>No cards saved yet. Add a card to check out faster.</Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {paymentMethods.map((m) => (
                <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14 }}>
                  <Ionicons name="card-outline" size={20} color="#FF4F8B" />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
                        {m.brand.charAt(0).toUpperCase() + m.brand.slice(1)} •••• {m.last4}
                      </Text>
                      {m.isDefault && (
                        <View style={{ backgroundColor: '#FFE2EC', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ fontSize: 9, fontWeight: '700', color: '#FF4F8B' }}>DEFAULT</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                      Exp {String(m.expMonth).padStart(2, '0')}/{String(m.expYear).slice(-2)}
                    </Text>
                  </View>
                  {!m.isDefault && (
                    <TouchableOpacity onPress={() => handleSetDefault(m)}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#FF4F8B' }}>Set default</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => handleDeleteCard(m)}>
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 10, lineHeight: 14 }}>
            Cards are stored privately and tokenized — your full number is never saved.
          </Text>
        </View>

        <View style={{ backgroundColor: '#D1FAE5', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <Ionicons name="shield-checkmark" size={18} color="#10B981" />
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#10B981', flex: 1 }}>Escrow protection active on all bookings</Text>
        </View>

        <TouchableOpacity onPress={logout} style={{ borderWidth: 1, borderColor: '#FEF2F2', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Ionicons name="log-out-outline" size={16} color="#EF4444" />
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#EF4444' }}>Log Out</Text>
        </TouchableOpacity>

        {/* Add Card Modal — all fields start EMPTY; only a tokenized record is saved */}
        <Modal visible={showCardModal} transparent animationType="slide">
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }} onPress={() => setShowCardModal(false)} activeOpacity={1}>
            <View style={{ flex: 1, justifyContent: 'flex-end' }}>
              <TouchableOpacity activeOpacity={1} style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
                <View style={{ width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 16 }}>Add a Card</Text>

                <TextInput
                  value={cardName}
                  onChangeText={setCardName}
                  placeholder="Cardholder Name"
                  autoCapitalize="words"
                  style={fieldStyle}
                />
                <View style={{ position: 'relative', marginTop: 12 }}>
                  <TextInput
                    value={formatCardNumber(cardNumber)}
                    onChangeText={(t) => setCardNumber(t.replace(/\D/g, ''))}
                    placeholder="Card Number"
                    keyboardType="number-pad"
                    maxLength={19}
                    style={fieldStyle}
                  />
                  {cardNumber.length >= 2 && detectCardBrand(cardNumber) !== 'unknown' && (
                    <Text style={{ position: 'absolute', right: 12, top: 14, fontSize: 12, fontWeight: '700', color: '#64748B' }}>
                      {detectCardBrand(cardNumber).toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                  <TextInput
                    value={cardExpiry}
                    onChangeText={(t) => {
                      const digits = t.replace(/\D/g, '').slice(0, 4);
                      setCardExpiry(digits.length >= 3 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits);
                    }}
                    placeholder="MM/YY"
                    keyboardType="number-pad"
                    maxLength={5}
                    style={[fieldStyle, { flex: 1 }]}
                  />
                  <TextInput
                    value={cardCvv}
                    onChangeText={(t) => setCardCvv(t.replace(/\D/g, '').slice(0, 4))}
                    placeholder="CVV"
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={4}
                    style={[fieldStyle, { flex: 1 }]}
                  />
                </View>

                {cardError && (
                  <Text style={{ fontSize: 12, color: '#EF4444', marginTop: 10 }}>{cardError}</Text>
                )}

                <TouchableOpacity
                  onPress={handleAddCard}
                  disabled={savingCard}
                  style={{ backgroundColor: savingCard ? '#FFE2EC' : '#FF4F8B', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{savingCard ? 'Saving…' : 'Save Card'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowCardModal(false)} style={{ alignItems: 'center', marginTop: 10 }}>
                  <Text style={{ color: '#64748B', fontSize: 13 }}>Cancel</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
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

      {/* Recommended Technicians — two-column card: technician identity on the
          left, their highest-rated review on the right for visual balance.
          Cards are full-width (stacked) so the left/right split stays readable
          even on small screens. */}
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A', paddingHorizontal: 20, marginBottom: 12 }}>Recommended</Text>
      <View style={{ paddingHorizontal: 16, gap: 12 }}>
        {(technicians.length > 0 ? technicians : recommendedTechnicians).slice(0, 2).map((tech, i) => {
          const top = tech.id ? techTopReviews[tech.id] : undefined;
          return (
          <View
            key={tech.id || i}
            style={{
              flexDirection: 'row',
              alignItems: 'stretch',
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
            {/* Left column: avatar + name + specialty + rating + rate (tap → book) */}
            <TouchableOpacity
              onPress={() => startBooking(tech.specialty || 'cleaning', tech)}
              activeOpacity={0.8}
              style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              {tech.avatar ? (
                <Image source={{ uri: tech.avatar }} style={{ width: 46, height: 46, borderRadius: 23 }} />
              ) : (
                <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFE2EC', justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#FF4F8B' }}>{tech.name[0]}</Text>
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>{tech.name}</Text>
                <Text numberOfLines={1} style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>{tech.specialty}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="star" size={12} color="#f59e0b" />
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#0F172A' }}>{tech.rating}</Text>
                  <Text style={{ fontSize: 10, color: '#94A3B8' }}>({tech.reviewsCount})</Text>
                </View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#FF4F8B', marginTop: 2 }}>${tech.ratePerHour}/hr</Text>
              </View>
            </TouchableOpacity>

            {/* Vertical divider separating identity from the review */}
            <View style={{ width: 1, backgroundColor: '#F1F5F9', marginLeft: 12, marginRight: 12 }} />

            {/* Right column: top (highest-rated) review — tappable link to all reviews */}
            {tech.id ? (
              <TouchableOpacity
                onPress={() => openReviews(tech)}
                activeOpacity={0.7}
                style={{ flex: 1.15, minWidth: 0, justifyContent: 'center' }}
              >
                {top?.comment ? (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                        Top Review
                      </Text>
                      <Ionicons name="chevron-forward" size={12} color="#94A3B8" />
                    </View>
                    <Text numberOfLines={3} style={{ fontSize: 10, color: '#475569', lineHeight: 14, fontStyle: 'italic' }}>
                      "{top.comment}"
                    </Text>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#FF4F8B', marginTop: 4 }}>
                      See all reviews
                    </Text>
                  </>
                ) : (
                  <Text style={{ fontSize: 10, color: '#94A3B8', fontStyle: 'italic' }}>No reviews yet</Text>
                )}
              </TouchableOpacity>
            ) : (
              <View style={{ flex: 1.15, minWidth: 0, justifyContent: 'center' }}>
                <Text style={{ fontSize: 10, color: '#94A3B8', fontStyle: 'italic' }}>No reviews yet</Text>
              </View>
            )}
          </View>
          );
        })}
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
