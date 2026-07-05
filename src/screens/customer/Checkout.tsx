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

const PAYMENT_METHODS = [
  { key: 'credit_card', label: 'Credit Card', icon: 'card-outline' as const, last4: '4242' },
  { key: 'digital_wallet', label: 'Digital Wallet', icon: 'wallet-outline' as const },
  { key: 'cash', label: 'Cash on Delivery', icon: 'cash-outline' as const },
];

export default function Checkout({ route, navigation }: any) {
  const { bookingData } = route.params || {};
  const { setJobs, refreshJobs } = useContext(AppContext);
  const [paymentMethod, setPaymentMethod] = useState('credit_card');
  const [paying, setPaying] = useState(false);

  const handlePay = async () => {
    setPaying(true);
    try {
      const newJob: Job = {
        id: `#SH-${Math.floor(1000 + Math.random() * 9000)}`,
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
        travelFee: 10,
        addOnsPrice: bookingData?.addOnsPrice || 0,
        totalPrice: bookingData?.totalPrice || 0,
        elapsedTime: 0,
        checklist: [
          { text: 'Service started', completed: false },
          { text: 'Service completed', completed: false },
        ],
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e2ec' }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={22} color="#333" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#1a1a1a' }}>Checkout</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        {/* Service Review */}
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 }}>Service Review</Text>
        <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e0e2ec', marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a' }}>{bookingData?.serviceType}</Text>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#006c47', backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>{bookingData?.duration}h</Text>
          </View>
          <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{bookingData?.address}, {bookingData?.city}</Text>
          <Text style={{ fontSize: 12, color: '#666' }}>{bookingData?.rooms} - {bookingData?.date}</Text>
          {bookingData?.technicianName && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e0e2ec' }}>
              <Ionicons name="person-circle" size={16} color="#003d9b" />
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#333' }}>{bookingData.technicianName}</Text>
            </View>
          )}
        </View>

        {/* Payment Method */}
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 }}>Payment Method</Text>
        <View style={{ gap: 10, marginBottom: 24 }}>
          {PAYMENT_METHODS.map((pm) => (
            <TouchableOpacity
              key={pm.key}
              onPress={() => setPaymentMethod(pm.key)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: paymentMethod === pm.key ? '#003d9b' : '#e0e2ec',
                backgroundColor: paymentMethod === pm.key ? 'rgba(0,61,155,0.05)' : '#fff',
                gap: 12,
              }}
            >
              <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: paymentMethod === pm.key ? '#003d9b' : '#ccc', justifyContent: 'center', alignItems: 'center' }}>
                {paymentMethod === pm.key && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#003d9b' }} />}
              </View>
              <Ionicons name={pm.icon} size={20} color="#666" />
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#333', flex: 1 }}>{pm.label}</Text>
              {pm.last4 && <Text style={{ fontSize: 12, color: '#999' }}>****{pm.last4}</Text>}
            </TouchableOpacity>
          ))}
        </View>

        {/* Payment Summary */}
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 }}>Payment Summary</Text>
        <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e0e2ec', marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 12, color: '#666' }}>Service Fee</Text>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#333' }}>${bookingData?.baseRate?.toFixed(2) || '0.00'}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 12, color: '#666' }}>Add-ons</Text>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#333' }}>${bookingData?.addOnsPrice?.toFixed(2) || '0.00'}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 12, color: '#666' }}>Travel Fee</Text>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#333' }}>$10.00</Text>
          </View>
          <View style={{ borderTopWidth: 1, borderTopColor: '#e0e2ec', marginTop: 8, paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a' }}>Total</Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#003d9b' }}>${((bookingData?.totalPrice || 0) + 10).toFixed(2)}</Text>
          </View>
        </View>

        {/* Escrow Badge */}
        <View style={{ backgroundColor: '#f0fdf4', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ionicons name="shield-checkmark" size={20} color="#006c47" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#006c47' }}>Escrow Protected</Text>
            <Text style={{ fontSize: 11, color: '#006c47', opacity: 0.8 }}>Payment held until service is confirmed complete</Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Bar */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e0e2ec', padding: 16, paddingBottom: 32 }}>
        <TouchableOpacity
          onPress={handlePay}
          disabled={paying}
          style={{ backgroundColor: paying ? '#d8e2ff' : '#003d9b', paddingVertical: 14, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}
        >
          {paying ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="lock-closed" size={14} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Pay ${((bookingData?.totalPrice || 0) + 10).toFixed(2)}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
