import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";

export default function RoleSelect() {
  const navigation = useNavigation<any>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Transvahan</Text>
      <Text style={styles.subtitle}>Choose your role to continue</Text>

      {/* ✅ User Signup Flow */}
      <TouchableOpacity
        style={styles.btn}
        onPress={() => navigation.navigate("Signup")}
      >
        <Text style={styles.btnText}>🚍 User</Text>
      </TouchableOpacity>

      {/* ✅ Driver Login Flow (unchanged) */}
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: "#16a34a" }]}
        onPress={() => navigation.navigate("DriverLogin")}
      >
        <Text style={styles.btnText}>🧑‍✈️ Driver</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  title: { fontSize: 26, fontWeight: "700", marginBottom: 10 },
  subtitle: { fontSize: 16, color: "#555", marginBottom: 24, textAlign: "center" },
  btn: {
    backgroundColor: "#2563eb",
    padding: 15,
    borderRadius: 10,
    marginVertical: 8,
    width: "80%",
    alignItems: "center",
  },
  btnText: { color: "white", fontSize: 18, fontWeight: "700" },
});
