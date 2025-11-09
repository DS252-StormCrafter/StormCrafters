import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../auth/authContext";
import { apiClient } from "../api/client";

export default function DriverLogin() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    try {
      if (!email || !password) {
        Alert.alert("⚠️ Missing Fields", "Please enter both email and password.");
        return;
      }

      setLoading(true);

      // Perform driver login
      const data = await apiClient.loginDriver!({ email, password });

      // ✅ persist driver identity in AsyncStorage for ws.ts
      await AsyncStorage.setItem(
        "auth_user",
        JSON.stringify({
          ...data.user,
          token: data.token,
          role: "driver",
        })
      );
      await AsyncStorage.setItem("last_login_endpoint", "/auth/driver/login");

      // ✅ also update the in-memory context for this session
      await signIn(data.token, { ...data.user, role: "driver" }, true);

      Alert.alert("✅ Success", "Driver logged in successfully!");
    } catch (err: any) {
      console.error("Driver login error:", err);
      Alert.alert(
        "Login Failed",
        err.response?.data?.error || "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Driver Login</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        secureTextEntry
        onChangeText={setPassword}
      />
      <TouchableOpacity
        style={styles.btn}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={{ color: "white", fontWeight: "700" }}>
          {loading ? "Signing in..." : "Login"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 20 },
  header: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  btn: {
    backgroundColor: "#2563eb",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
});
