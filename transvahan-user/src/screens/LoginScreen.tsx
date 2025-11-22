import React, { useState } from "react";
import { View, Text, TextInput, Pressable, Alert } from "react-native";
import axios from "axios";
import { useAuth } from "../auth/authContext";
import { setToken as setApiToken } from "../api/client";

const API = "<APP_RUNNER_BACKEND_URL>";

export default function LoginScreen({ navigation }: any) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    try {
      if (!email || !password) {
        Alert.alert("⚠️ Missing Fields", "Please enter both email and password.");
        return;
      }

      setLoading(true);

      const { data } = await axios.post(`${API}/auth/login`, {
        email: email.trim().toLowerCase(),
        password, // plaintext
      });

      setApiToken(data.token);
      await signIn(data.token, data.user, false);
      Alert.alert("✅ Logged in", `Welcome back, ${data.user.name}`);
    } catch (e: any) {
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
      <Text style={{ fontSize: 28, fontWeight: "800", marginBottom: 12 }}>
        Login
      </Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        style={{ borderWidth: 1, borderColor: "#e5e7eb", padding: 12, borderRadius: 10 }}
      />

      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry={!showPassword}
        style={{ borderWidth: 1, borderColor: "#e5e7eb", padding: 12, borderRadius: 10 }}
      />

      <Pressable onPress={() => setShowPassword((v) => !v)}>
        <Text style={{ color: "#2563eb", fontWeight: "600" }}>
          {showPassword ? "Hide Password" : "Show Password"}
        </Text>
      </Pressable>

      {/* ✅ Forgot Password (users only) */}
      <Pressable onPress={() => navigation.navigate("ForgotPassword")}>
        <Text style={{ color: "#ef4444", fontWeight: "600" }}>
          Forgot Password?
        </Text>
      </Pressable>

      <Pressable
        onPress={onLogin}
        disabled={loading}
        style={{
          backgroundColor: "#111827",
          padding: 14,
          borderRadius: 12,
          alignItems: "center",
          marginTop: 12,
          opacity: loading ? 0.6 : 1,
        }}
      >
        <Text style={{ color: "white", fontWeight: "700" }}>
          {loading ? "Signing in…" : "Sign In"}
        </Text>
      </Pressable>
    </View>
  );
}