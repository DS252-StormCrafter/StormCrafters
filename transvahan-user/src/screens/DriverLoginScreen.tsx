// src/screens/DriverLoginScreen.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import axios from 'axios';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { useAuth } from '../auth/authContext';

const API = Constants.expoConfig?.extra?.API_BASE_URL;

export default function DriverLoginScreen({ navigation }: any) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const login = async () => {
    try {
      const passwordHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        password
      );

      const { data } = await axios.post(`${API}/auth/login`, {
        email, passwordHash
      });

      if (data.user.role !== "driver") {
        Alert.alert("Access denied", "This login is only for drivers.");
        return;
      }

      await signIn(data.token, data.user);
    } catch (err: any) {
      Alert.alert("Login failed", err.response?.data?.error || "Check credentials");
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 28, fontWeight: '800' }}>Driver Login</Text>
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={{ borderWidth: 1, padding: 12, borderRadius: 10 }}
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{ borderWidth: 1, padding: 12, borderRadius: 10 }}
      />
      <Pressable
        onPress={login}
        style={{
          backgroundColor: '#111827',
          padding: 14,
          borderRadius: 12,
          alignItems: 'center'
        }}
      >
        <Text style={{ color: 'white', fontWeight: '700' }}>Log In</Text>
      </Pressable>
    </View>
  );
}
