// src/screens/LoginScreen.tsx
import React, { useState } from "react";
import { View, Text, TextInput, Pressable, Alert } from "react-native";
import axios from "axios";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import { useAuth } from "../auth/authContext";
import { setToken as setApiToken } from "../api/client";

const API = Constants.expoConfig?.extra?.API_BASE_URL || "http://10.81.30.77:5000";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // 🔐 Hash password before sending to backend
  const hashPassword = async (plain: string) =>
    await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, plain);

  const onLogin = async () => {
    try {
      if (!email || !password) {
        Alert.alert("⚠️ Missing Fields", "Please enter both email and password.");
        return;
      }

      setLoading(true);
      const passwordHash = await hashPassword(password);
      console.log("➡️ Logging in to:", `${API}/auth/login`);

      const { data } = await axios.post(`${API}/auth/login`, {
        email,
        passwordHash,
      });

      console.log("✅ Login success:", data);

      // ✅ Ensure API token is set globally (for /routes, /vehicles, etc.)
      setApiToken(data.token);
      console.log("🔑 Token applied globally:", data.token?.slice(0, 25) + "...");

      // ✅ Update global auth context
      await signIn(data.token, data.user, false);

      Alert.alert("✅ Logged in", `Welcome back, ${data.user.name}`);
    } catch (e: any) {
      console.log("❌ Login error:", e?.response?.data || e.message);
      const msg =
        e?.response?.data?.error ??
        (e.message?.includes("Network") ? "Network error" : "Login failed");
      Alert.alert("Login failed", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 28, fontWeight: "800", marginBottom: 12 }}>Login</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        style={{
          borderWidth: 1,
          borderColor: "#e5e7eb",
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
          borderColor: "#e5e7eb",
          padding: 12,
          borderRadius: 10,
        }}
      />
      <Pressable
        onPress={onLogin}
        disabled={loading}
        style={{
          backgroundColor: "#111827",
          padding: 14,
          borderRadius: 12,
          alignItems: "center",
          marginTop: 12,
        }}
      >
        <Text style={{ color: "white", fontWeight: "700" }}>
          {loading ? "Signing in…" : "Sign In"}
        </Text>
      </Pressable>
    </View>
  );
}
