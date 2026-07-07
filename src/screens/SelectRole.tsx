import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppContext } from '../navigation/AppNavigator';
import { roleDescriptions } from '../data';
import { PINK, PINK_SOFT, INK, MUTED } from '../theme/colors';

export default function SelectRole({ navigation }: any) {
  const { setUser, user } = useContext(AppContext);

  const handleSelect = (role: 'customer' | 'technician') => {
    if (user) {
      setUser({ ...user, role });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFBFC', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      {/* Header */}
      <View style={{ alignItems: 'center', marginBottom: 40 }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 12,
            backgroundColor: PINK,
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
        <Text style={{ fontSize: 32, fontWeight: '800', color: PINK, letterSpacing: -0.5, marginBottom: 8 }}>
          {roleDescriptions.appName}
        </Text>
        <Text style={{ fontSize: 14, color: MUTED, textAlign: 'center', maxWidth: 280 }}>
          {roleDescriptions.appTagline}
        </Text>
      </View>

      {/* Role Cards */}
      <View style={{ width: '100%', gap: 16 }}>
        <TouchableOpacity
          onPress={() => handleSelect('customer')}
          style={{
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: '#F1F5F9',
            borderRadius: 16,
            padding: 32,
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
            backgroundColor: PINK_SOFT,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 20,
          }}
        >
            <Ionicons name="home" size={24} color={PINK} />
          </View>
          <Text style={{ fontSize: 20, fontWeight: '700', color: INK, marginBottom: 8, textAlign: 'center' }}>
            {roleDescriptions.customer.title}
          </Text>
          <Text style={{ fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 20 }}>
            {roleDescriptions.customer.description}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleSelect('technician')}
          style={{
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: '#F1F5F9',
            borderRadius: 16,
            padding: 32,
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: PINK,
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 20,
            }}
          >
            <Ionicons name="construct" size={24} color="#fff" />
          </View>
          <Text style={{ fontSize: 20, fontWeight: '700', color: INK, marginBottom: 8, textAlign: 'center' }}>
            {roleDescriptions.technician.title}
          </Text>
          <Text style={{ fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 20 }}>
            {roleDescriptions.technician.description}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Help */}
      <TouchableOpacity
        onPress={() =>
          Alert.alert(
            roleDescriptions.helpTitle,
            roleDescriptions.helpMessage
          )
        }
        style={{ marginTop: 32, flexDirection: 'row', alignItems: 'center', gap: 6 }}
      >
        <Ionicons name="help-circle" size={14} color={PINK} />
        <Text style={{ fontSize: 12, fontWeight: '600', color: PINK }}>{roleDescriptions.helpLinkText}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
