import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppContext } from '../../navigation/AppNavigator';
import { Job, SavedPaymentMethod } from '../../types';
import { defaultTravelFee } from '../../data';
import { PINK, PINK_SOFT, INK, MUTED, SUCCESS, SUCCESS_SOFT, CANVAS } from '../../theme/colors';
import { createOrderInProgress, ensureProfile } from '../../services/database.service';
import { getPaymentMethods } from '../../services/payment.service';
import { validateCustomerOrderProfile } from '../../services/validation';

export default function Checkout({ route, navigation }: any) {
  const { bookingData } = route.params || {};
  const { user, setJobs, refreshJobs } = useContext(AppContext);

  // Payment methods are managed in the customer's profile and stored in the
  // private (RLS-scoped) payment_methods table. New accounts have none, so the
  // selector below renders an empty state with a link to the profile.
  useEffect(() => {
    let active = true;
    getPaymentMethods()
      .then((methods) => {
        if (!active) return;
        setSavedMethods(methods);
        const preferred = methods.find((m) => m.isDefault) || methods[0];
        setSelectedPaymentId(preferred ? preferred.id : null);
      })
      .catch((err) => console.error('Failed to load payment methods:', err));
    return () => {
      active = false;
    };
  }, []);
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  // The customer profile must have a service address and phone before any
  // order can be placed. We compute this once per render so both the Pay
  // button (disabled state) and the inline warning banner stay in sync.
  const profileCheck = validateCustomerOrderProfile({
    address: user?.address,
    phone: user?.phone,
  });
  const profileReady = profileCheck.isValid;

  const handlePay = async () => {
    setPaying(true);
    try {
      // Validate user ID exists before proceeding
      if (!user?.id) {
        Alert.alert('Error', 'Please log in to continue with checkout.');
        return;
      }

      // Enforce mandatory customer profile fields (address + phone) before
      // placing an order. Without these, the technician cannot reach the
      // customer or contact them about the job.
      if (!profileReady) {
        Alert.alert(
          'Profile Incomplete',
          `Please add your ${profileCheck.errors.join(' and ')} in your profile before placing an order.`,
          [
            {
              text: 'Edit Profile',
              onPress: () => navigation.navigate('CustomerTabs', { screen: 'Profile' }),
            },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return;
      }

      // Validate that a real, active technician was assigned. The selection is
      // captured as a profiles.id at ServiceDetails and must be present here so
      // the order persists the correct technician reference (technician_id).
      if (!bookingData?.technicianId) {
        Alert.alert(
          'Missing Technician',
          'No technician is assigned to this order. Please go back and select a technician.'
        );
        return;
      }

      // Guarantee the user's profile row exists before writing the order.
      // Accounts created before the signup trigger (or with a missing/soft-
      // deleted profile) would otherwise fail the customer_id FK with a
      // "profile not found" error. ensureProfile creates it on the fly.
      await ensureProfile();

      const newJob = await createOrderInProgress({
        customerId: user.id,
        serviceType: bookingData?.serviceType || 'Service',
        serviceCategory: bookingData?.serviceCategory || 'cleaning',
        customerName: user?.name || '',
        customerPhone: user?.phone || '',
        customerAvatar: '',
        address: bookingData?.address || '',
        apartment: bookingData?.apartment || '',
        city: bookingData?.city || '',
        zipCode: bookingData?.zipCode || '',
        date: bookingData?.date || new Date().toISOString().split('T')[0],
        timeSlot: bookingData?.timeSlot || 'morning',
        rooms: bookingData?.rooms || '',
        duration: bookingData?.duration || 2,
        focusAreas: bookingData?.focusAreas || [],
        notes: bookingData?.notes || '',
        baseRate: bookingData?.baseRate || 0,
        tax: 0,
        travelFee: defaultTravelFee,
        addOnsPrice: bookingData?.addOnsPrice || 0,
        totalPrice: bookingData?.totalPrice || 0,
        technicianId: bookingData?.technicianId,
        technicianName: bookingData?.technicianName,
        technicianAvatar: bookingData?.technicianAvatar,
      });

      if (newJob) {
        setJobs((prev: Job[]) => [newJob, ...prev]);
        navigation.navigate('Tracking', { job: newJob });
      }
    } catch (err: any) {
      console.error(err);
      const message = err?.message || 'An error occurred while processing your payment.';
      // Show sign-out guidance if profile issue
      const needsRelogin = message.toLowerCase().includes('profile') || message.toLowerCase().includes('sign out');
      Alert.alert(
        'Payment Failed',
        needsRelogin ? `${message}\n\nPlease go to Profile > Sign Out, then sign in again.` : message
      );
    } finally {
      setPaying(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFBFC' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={22} color={INK} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '800', color: INK }}>Checkout</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        {/* Profile completeness gate — shown when address/phone are missing */}
        {!profileReady && (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 14, padding: 14, marginBottom: 20 }}>
            <Ionicons name="warning" size={18} color="#EF4444" style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#B91C1C' }}>Profile information required</Text>
              <Text style={{ fontSize: 12, color: '#7F1D1D', marginTop: 2, lineHeight: 16 }}>
                Add your {profileCheck.errors.join(' and ')} in your profile before placing an order.
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('CustomerTabs', { screen: 'Profile' })}
                style={{ marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#EF4444', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>Go to Profile</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Service Review */}
        <Text style={{ fontSize: 11, fontWeight: '700', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>
          Service Review
        </Text>
        <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: INK }}>{bookingData?.serviceType}</Text>
            <View style={{ backgroundColor: SUCCESS_SOFT, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: SUCCESS }}>{bookingData?.duration}h</Text>
            </View>
          </View>
          <Text style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>{bookingData?.address}, {bookingData?.city}</Text>
          <Text style={{ fontSize: 12, color: MUTED }}>{bookingData?.rooms} - {bookingData?.date}</Text>
          {bookingData?.technicianName && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: PINK_SOFT, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="person" size={14} color={PINK} />
              </View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: INK }}>{bookingData.technicianName}</Text>
            </View>
          )}
        </View>

        {/* Payment Method — sourced from the customer's saved (profile-managed) cards */}
        <Text style={{ fontSize: 11, fontWeight: '700', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>
          Payment Method
        </Text>
        {savedMethods.length === 0 ? (
          <View style={{ backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F1F5F9', flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <Ionicons name="card-outline" size={22} color="#94A3B8" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: INK }}>No payment method saved</Text>
              <Text style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Add a card in your profile to check out faster.</Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('CustomerTabs', { screen: 'Profile' })}
              style={{ backgroundColor: PINK, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>Add</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ gap: 10, marginBottom: 24 }}>
            {savedMethods.map((pm) => (
              <TouchableOpacity
                key={pm.id}
                onPress={() => setSelectedPaymentId(pm.id)}
                activeOpacity={0.85}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 14,
                  borderRadius: 16,
                  borderWidth: 1.5,
                  borderColor: selectedPaymentId === pm.id ? PINK : '#E5E7EB',
                  backgroundColor: selectedPaymentId === pm.id ? PINK_SOFT : '#fff',
                  gap: 12,
                }}
              >
                <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: selectedPaymentId === pm.id ? PINK : '#CBD5E1', justifyContent: 'center', alignItems: 'center' }}>
                  {selectedPaymentId === pm.id && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: PINK }} />}
                </View>
                <Ionicons name="card-outline" size={20} color={selectedPaymentId === pm.id ? PINK : MUTED} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: INK, flex: 1 }}>
                  {pm.brand.charAt(0).toUpperCase() + pm.brand.slice(1)} •••• {pm.last4}
                </Text>
                <Text style={{ fontSize: 11, color: MUTED }}>
                  {String(pm.expMonth).padStart(2, '0')}/{String(pm.expYear).slice(-2)}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => navigation.navigate('CustomerTabs', { screen: 'Profile' })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}
            >
              <Ionicons name="create-outline" size={14} color={PINK} />
              <Text style={{ fontSize: 12, fontWeight: '600', color: PINK }}>Manage in Profile</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Payment Summary */}
        <Text style={{ fontSize: 11, fontWeight: '700', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>
          Payment Summary
        </Text>
        <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={{ fontSize: 12, color: MUTED }}>Service Fee</Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: INK }}>${bookingData?.baseRate?.toFixed(2) || '0.00'}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={{ fontSize: 12, color: MUTED }}>Add-ons</Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: INK }}>${bookingData?.addOnsPrice?.toFixed(2) || '0.00'}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={{ fontSize: 12, color: MUTED }}>Travel Fee</Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: INK }}>${defaultTravelFee.toFixed(2)}</Text>
          </View>
          <View style={{ borderTopWidth: 1, borderTopColor: '#F1F5F9', marginTop: 8, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: INK }}>Total</Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: PINK }}>${((bookingData?.totalPrice || 0) + defaultTravelFee).toFixed(2)}</Text>
          </View>
        </View>

        {/* Escrow Badge */}
        <View style={{ backgroundColor: SUCCESS_SOFT, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: SUCCESS, justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="shield-checkmark" size={18} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: SUCCESS }}>Escrow Protected</Text>
            <Text style={{ fontSize: 11, color: MUTED, marginTop: 2, lineHeight: 15 }}>
              Payment held until service is confirmed complete.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Bar — Pay pill button */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F1F5F9', padding: 16, paddingBottom: 32 }}>
        <TouchableOpacity
          onPress={handlePay}
          disabled={paying || !profileReady}
          activeOpacity={0.85}
          style={{
            backgroundColor: paying || !profileReady ? PINK_SOFT : PINK,
            paddingVertical: 16,
            borderRadius: 999,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 8,
            shadowColor: paying || !profileReady ? 'transparent' : PINK,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: paying || !profileReady ? 0 : 0.3,
            shadowRadius: 16,
            elevation: paying || !profileReady ? 0 : 4,
          }}
        >
          {paying ? (
            <ActivityIndicator size="small" color={PINK} />
          ) : (
            <>
              <Ionicons name="lock-closed" size={16} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>
                Pay ${((bookingData?.totalPrice || 0) + defaultTravelFee).toFixed(2)}
              </Text>
              <Ionicons name="sparkles" size={14} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
