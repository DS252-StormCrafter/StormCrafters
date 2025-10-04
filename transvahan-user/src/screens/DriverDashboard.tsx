import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import Constants from 'expo-constants';
import { useAuth } from '../auth/authContext';

const API_BASE = Constants.expoConfig?.extra?.API_BASE_URL;

export default function DriverDashboard() {
  const { user, token } = useAuth();
  const VEHICLE_ID = user?.email.replace(/@.*/, ""); // Example: email→vehicle ID

  const [tripActive, setTripActive] = useState(false);
  const [occupancy, setOccupancy] = useState(0);
  const [status, setStatus] = useState("inactive");

  // --- Trip ---
  async function startTrip() {
    setTripActive(true);
    await send(`/vehicle/${VEHICLE_ID}/trip`, { action: "start", timestamp: new Date().toISOString() });
  }
  async function stopTrip() {
    setTripActive(false);
    await send(`/vehicle/${VEHICLE_ID}/trip`, { action: "stop", timestamp: new Date().toISOString() });
  }

  // --- Occupancy ---
  async function updateOccupancy(delta: number) {
    const newOcc = Math.min(4, Math.max(0, occupancy + delta));
    setOccupancy(newOcc);
    await send(`/vehicle/${VEHICLE_ID}/occupancy`, { occupancy: newOcc });
  }

  // --- Status ---
  async function updateStatus(newStatus: string) {
    setStatus(newStatus);
    await send(`/vehicle/${VEHICLE_ID}/status`, { status: newStatus });
  }

  // --- Alerts ---
  async function sendAlert(type: string) {
    await send(`/vehicle/${VEHICLE_ID}/alert`, {
      message: type === "maintenance" ? "Vehicle needs maintenance" : "Driver alert",
      type,
      timestamp: new Date().toISOString()
    });
    Alert.alert("Alert sent", `Admin notified: ${type}`);
  }

  // --- Helper: API call ---
  async function send(path: string, body: any) {
    try {
      await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      console.error("DriverDashboard send error:", err);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Driver Dashboard — {VEHICLE_ID}</Text>

      {/* Trip */}
      <View style={styles.section}>
        <Text>Trip: {tripActive ? "ACTIVE" : "INACTIVE"}</Text>
        <TouchableOpacity
          style={[styles.button, tripActive ? styles.stopButton : styles.startButton]}
          onPress={() => (tripActive ? stopTrip() : startTrip())}
        >
          <Text style={styles.buttonText}>{tripActive ? "Stop Trip" : "Start Trip"}</Text>
        </TouchableOpacity>
      </View>

      {/* Occupancy */}
      <View style={styles.section}>
        <Text>Occupancy: {occupancy} / 4</Text>
        <View style={styles.row}>
          <TouchableOpacity style={styles.occButton} onPress={() => updateOccupancy(-1)}>
            <Text style={styles.buttonText}>-</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.occButton} onPress={() => updateOccupancy(1)}>
            <Text style={styles.buttonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Status */}
      <View style={styles.section}>
        <Text>Status: {status}</Text>
        <View style={styles.row}>
          {["active", "inactive", "maintenance"].map((s) => (
            <TouchableOpacity key={s} style={styles.button} onPress={() => updateStatus(s)}>
              <Text style={styles.buttonText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Alerts */}
      <View style={styles.section}>
        <Text>Send Alerts:</Text>
        <View style={styles.row}>
          <TouchableOpacity style={styles.button} onPress={() => sendAlert("maintenance")}>
            <Text style={styles.buttonText}>Maintenance</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => sendAlert("other")}>
            <Text style={styles.buttonText}>Other Alert</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18, paddingTop: 48, backgroundColor: "#fff" },
  title: { fontSize: 20, fontWeight: "600", marginBottom: 12 },
  section: { marginVertical: 10, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "#eee" },
  row: { flexDirection: "row", marginTop: 8 },
  button: { padding: 12, borderRadius: 8, backgroundColor: "#1976d2", marginRight: 8 },
  startButton: { backgroundColor: "#2e7d32" },
  stopButton: { backgroundColor: "#c62828" },
  buttonText: { color: "#fff", fontWeight: "600" },
  occButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#424242",
    marginRight: 8,
    minWidth: 64,
    alignItems: "center",
  },
});
