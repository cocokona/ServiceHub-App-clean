import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppContext } from '../navigation/AppNavigator';

export default function SelectRole({ navigation }: any) {
  const { setUser, user } = useContext(AppContext);

  const handleSelect = (role: 'customer' | 'technician') => {
    if (user) {
      setUser({ ...user, role });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      {/* Header */}
      <View style={{ alignItems: 'center', marginBottom: 40 }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 12,
            backgroundColor: '#003d9b',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 24,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }}
        >
          <Ionicons name="construct" size={32} color="#fff" />
        </View>
        <Text style={{ fontSize: 32, fontWeight: '800', color: '#003d9b', letterSpacing: -0.5, marginBottom: 8 }}>
          ServiceHub
        </Text>
        <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', maxWidth: 280 }}>
          The standard for home service excellence. Select your path to begin.
        </Text>
      </View>

      {/* Role Cards */}
      <View style={{ width: '100%', gap: 16 }}>
        <TouchableOpacity
          onPress={() => handleSelect('customer')}
          style={{
            backgroundColor: '#fff',
            borderWidth: 1,
            borderColor: '#e0e2ec',
            borderRadius: 16,
            padding: 32,
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: '#d8e2ff',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 20,
            }}
          >
            <Ionicons name="home" size={24} color="#003d9b" />
          </View>
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 8, textAlign: 'center' }}>
            I am a Customer
          </Text>
          <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20 }}>
            Book verified professionals for your home repair, maintenance, and improvement needs.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleSelect('technician')}
          style={{
            backgroundColor: '#fff',
            borderWidth: 1,
            borderColor: '#e0e2ec',
            borderRadius: 16,
            padding: 32,
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: '#003d9b',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 20,
            }}
          >
            <Ionicons name="construct" size={24} color="#fff" />
          </View>
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 8, textAlign: 'center' }}>
            I am a Technician
          </Text>
          <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20 }}>
            Manage your jobs, schedule, and earnings with our streamlined professional tools.
          </Text>
        </TouchableOpacity>
      </View>

      {/* Help */}
      <TouchableOpacity
        onPress={() =>
          Alert.alert(
            'ServiceHub Guide',
            'Customers can browse and schedule expert helpers. Technicians can manage service calls, checklists, timelines, and claim payouts.'
          )
        }
        style={{ marginTop: 32, flexDirection: 'row', alignItems: 'center', gap: 6 }}
      >
        <Ionicons name="help-circle" size={14} color="#003d9b" />
        <Text style={{ fontSize: 12, fontWeight: '600', color: '#003d9b' }}>Need help deciding?</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
