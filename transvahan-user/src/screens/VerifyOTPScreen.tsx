import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import axios from 'axios';
import Constants from 'expo-constants';

const API = Constants.expoConfig?.extra?.API_BASE_URL;

export default function VerifyOtpScreen({ route, navigation }: any) {
  const { email } = route.params;
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const onVerify = async () => {
    try {
      setLoading(true);
      const { data } = await axios.post(`${API}/auth/verify-otp`, { email, otp });
      console.log("✅ OTP Verified:", data);
      Alert.alert('✅ Success', 'Email verified. Please login.');
      navigation.replace('Login');
    } catch (e: any) {
      console.log("❌ OTP verify error:", e?.response?.data ?? e);
      Alert.alert('❌ Failed', e?.response?.data?.error ?? 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    try {
      await axios.post(`${API}/auth/resend-otp`, { email });
      Alert.alert('📩 OTP Sent', 'A new OTP was sent to your email.');
    } catch (e: any) {
      console.log("❌ Resend error:", e?.response?.data ?? e);
      Alert.alert('❌ Failed', e?.response?.data?.error ?? 'Could not resend OTP');
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
      <Text style={{ fontSize: 22, fontWeight: '800', marginBottom: 12 }}>
        Verify OTP
      </Text>
      <Text>Enter the OTP sent to {email}</Text>
      <TextInput
        value={otp}
        onChangeText={setOtp}
        placeholder="Enter OTP"
        keyboardType="numeric"
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          padding: 12,
          borderRadius: 8,
          marginTop: 12,
        }}
      />
      <Pressable
        onPress={onVerify}
        disabled={loading}
        style={{
          backgroundColor: '#111827',
          padding: 14,
          borderRadius: 12,
          marginTop: 12,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: 'white', fontWeight: '700' }}>
          {loading ? 'Verifying…' : 'Verify'}
        </Text>
      </Pressable>
      <Pressable onPress={onResend} style={{ marginTop: 16, alignItems: 'center' }}>
        <Text style={{ color: '#2563eb' }}>Resend OTP</Text>
      </Pressable>
    </View>
  );
}
