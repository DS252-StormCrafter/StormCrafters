import React, { useState } from "react";
import { View, Text, TextInput, Pressable, Alert } from "react-native";
import axios from "axios";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";

const API = Constants.expoConfig?.extra?.API_BASE_URL;

export default function SignupScreen({ navigation }: any) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const hashPassword = async (plain: string) =>
    await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, plain);

  const validateEmail = (val: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());

  const onSignup = async () => {
    if (!name || !email || !password) {
      Alert.alert("⚠️ Missing Fields", "Please fill all fields.");
      return;
    }
    if (!validateEmail(email)) {
      Alert.alert("⚠️ Invalid Email", "Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("⚠️ Weak Password", "Password must be at least 6 characters long.");
      return;
    }

    try {
      setLoading(true);
      const passwordHash = await hashPassword(password);
      console.log("➡️ Signup Request:", `${API}/auth/signup`);

      const res = await axios.post(`${API}/auth/signup`, {
        name,
        email,
        passwordHash,
      });

      console.log("✅ Signup Success:", res.data);
      Alert.alert("📩 OTP Sent", "Please verify the OTP sent to your email.");
      navigation.replace("VerifyOtp", { email });
    } catch (err: any) {
      console.log("❌ Signup Error:", err?.response?.data ?? err);
      Alert.alert("Signup failed", err?.response?.data?.error ?? "Try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 28, fontWeight: "800", marginBottom: 12 }}>Create Account</Text>

      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Full Name"
        style={styles.input}
      />

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email Address"
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />

      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        style={styles.input}
      />

      <Pressable
        onPress={onSignup}
        disabled={loading}
        style={[styles.btn, { opacity: loading ? 0.6 : 1 }]}
      >
        <Text style={styles.btnText}>{loading ? "Signing Up…" : "Sign Up"}</Text>
      </Pressable>

      <Pressable onPress={() => navigation.replace("Login")} style={{ marginTop: 12 }}>
        <Text style={{ textAlign: "center", color: "#2563eb" }}>
          Already have an account? Log In
        </Text>
      </Pressable>
    </View>
  );
}

const styles = {
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    borderRadius: 10,
  },
  btn: {
    backgroundColor: "#111827",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
  },
  btnText: {
    color: "white",
    fontWeight: "700",
  },
};
