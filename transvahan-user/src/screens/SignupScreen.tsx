import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import axios from 'axios';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';  // for hashing

const API = Constants.expoConfig?.extra?.API_BASE_URL;

export default function SignupScreen({ navigation }: any) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Hash password client-side before sending
  const hashPassword = async (plain: string) => {
    return await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      plain
    );
  };

  const onSignup = async () => {
    try {
      if (!name || !email || !password) {
        Alert.alert("⚠️ Missing Fields", "Please enter all fields.");
        return;
      }

      setLoading(true);
      const passwordHash = await hashPassword(password);

      console.log("➡️ Signup request to:", `${API}/auth/signup`);
      console.log("➡️ Body:", { name, email, passwordHash });

      const res = await axios.post(`${API}/auth/signup`, {
        name,
        email,
        passwordHash,
      });

      console.log("✅ Signup success:", res.data);
      Alert.alert("📩 OTP Sent", "Please verify the OTP sent to your email.");

      // Redirect to OTP verification screen
      navigation.replace("VerifyOtp", { email });
    } catch (e: any) {
      console.log("❌ Signup error full:", e?.response?.data ?? e);
      Alert.alert("Signup failed", e?.response?.data?.error ?? "Try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 28, fontWeight: '800', marginBottom: 12 }}>
        Create Account
      </Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Full Name"
        style={{
          borderWidth: 1,
          borderColor: '#e5e7eb',
          padding: 12,
          borderRadius: 10,
        }}
      />
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        style={{
          borderWidth: 1,
          borderColor: '#e5e7eb',
          padding: 12,
          borderRadius: 10,
        }}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        style={{
          borderWidth: 1,
          borderColor: '#e5e7eb',
          padding: 12,
          borderRadius: 10,
        }}
      />
      <Pressable
        onPress={onSignup}
        disabled={loading}
        style={{
          backgroundColor: '#111827',
          padding: 14,
          borderRadius: 12,
          alignItems: 'center',
          marginTop: 12,
        }}
      >
        <Text style={{ color: 'white', fontWeight: '700' }}>
          {loading ? 'Signing up…' : 'Sign Up'}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => navigation.replace("Login")}
        style={{ marginTop: 12 }}
      >
        <Text style={{ textAlign: 'center', color: '#2563eb' }}>
          Already have an account? Login
        </Text>
      </Pressable>
    </View>
  );
}
