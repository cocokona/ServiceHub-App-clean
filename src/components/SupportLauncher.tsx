import React from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

/**
 * SupportLauncher — the customer-service button placed in the top-right corner
 * of the profile pages. Tapping it opens the real, admin-connected support
 * chat (SupportChat in "support" mode, which has no job association).
 *
 * Uses the shared brand pink and a soft shadow so it reads as a premium,
 * intentional control rather than a stray icon.
 */
export default function SupportLauncher({ size = 40 }: { size?: number }) {
  const navigation = useNavigation<any>();

  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('SupportChat', { support: true })}
      activeOpacity={0.82}
      accessibilityLabel="Contact customer service"
      accessibilityRole="button"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#FF4F8B',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#FF4F8B',
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 5,
      }}
    >
      <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
    </TouchableOpacity>
  );
}
