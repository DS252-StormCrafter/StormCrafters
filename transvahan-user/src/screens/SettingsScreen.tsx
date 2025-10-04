import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useAuth } from '../auth/authContext';

export default function SettingsScreen() {
  const { signOut } = useAuth();

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: '800', marginBottom: 20 }}>Settings</Text>
      <Pressable
        onPress={signOut}
        style={{
          backgroundColor: '#ef4444',
          padding: 14,
          borderRadius: 12,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: 'white', fontWeight: '700' }}>Logout</Text>
      </Pressable>
    </View>
  );
}
