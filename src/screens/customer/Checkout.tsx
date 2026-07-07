import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppContext } from '../../navigation/AppNavigator';
import { Job } from '../../types';
import { paymentMethods, defaultChecklist, defaultTravelFee, jobIdPrefix } from '../../data';
import { PINK, PINK_SOFT, INK, MUTED, SUCCESS, SUCCESS_SOFT, CANVAS } from '../../theme/colors';

export default function Checkout({ route, navigation }: any) {
  const { bookingData } = route.params || {};
  const { setJobs, refreshJobs } = useContext(AppContext);
  const [paymentMethod, setPaymentMethod] = useState('credit_card');
  const [paying, setPaying] = useState(false);

  const handlePay = async () => {
    setPaying(true);
    try {
      const newJob: Job = {
        id: `${jobIdPrefix}-${Math.floor(1000 + Math.random() * 9000)}`,
        serviceType: bookingData?.serviceType || 'Service',
        serviceCategory: bookingData?.serviceCategory || 'cleaning',
        customerName: 'Customer',
        customerPhone: '(555) 019-9800',
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
        status: 'on_the_way',
        baseRate: bookingData?.baseRate || 0,
        tax: 0,
        travelFee: defaultTravelFee,
        addOnsPrice: bookingData?.addOnsPrice || 0,
        totalPrice: bookingData?.totalPrice || 0,
        elapsedTime: 0,
        checklist: defaultChecklist.map((item) => ({ ...item })),
        technicianName: bookingData?.technicianName,
        technicianAvatar: bookingData?.technicianAvatar,
      };

      await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newJob),
      }).catch(() => {});

      setJobs((prev: Job[]) => [newJob, ...prev]);
      navigation.navigate('Tracking', { job: newJob });
    } catch (err) {
      console.error(err);
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

        {/* Payment Method */}
        <Text style={{ fontSize: 11, fontWeight: '700', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>
          Payment Method
        </Text>
        <View style={{ gap: 10, marginBottom: 24 }}>
          {paymentMethods.map((pm) => (
            <TouchableOpacity
              key={pm.key}
              onPress={() => setPaymentMethod(pm.key)}
              activeOpacity={0.85}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 14,
                borderRadius: 16,
                borderWidth: 1.5,
                borderColor: paymentMethod === pm.key ? PINK : '#E5E7EB',
                backgroundColor: paymentMethod === pm.key ? PINK_SOFT : '#fff',
                gap: 12,
              }}
            >
              <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: paymentMethod === pm.key ? PINK : '#CBD5E1', justifyContent: 'center', alignItems: 'center' }}>
                {paymentMethod === pm.key && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: PINK }} />}
              </View>
              <Ionicons name={pm.icon as keyof typeof Ionicons.glyphMap} size={20} color={paymentMethod === pm.key ? PINK : MUTED} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: INK, flex: 1 }}>{pm.label}</Text>
              {pm.last4 && <Text style={{ fontSize: 12, color: MUTED }}>****{pm.last4}</Text>}
            </TouchableOpacity>
          ))}
        </View>

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
          disabled={paying}
          activeOpacity={0.85}
          style={{
            backgroundColor: paying ? PINK_SOFT : PINK,
            paddingVertical: 16,
            borderRadius: 999,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 8,
            shadowColor: paying ? 'transparent' : PINK,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: paying ? 0 : 0.3,
            shadowRadius: 16,
            elevation: paying ? 0 : 4,
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
