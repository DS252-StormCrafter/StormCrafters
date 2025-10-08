// src/screens/DriverMapTab.tsx
import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Dimensions, ActivityIndicator, Alert, TouchableOpacity } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { useAuth } from "../auth/authContext";
import { apiClient } from "../api/client";
import { wsConnect } from "../api/ws"; // ✅ include ws for driver alerts

const ASPECT_RATIO = Dimensions.get("window").width / Dimensions.get("window").height;

export default function DriverMapTab() {
  const { token, user } = useAuth();
  const [location, setLocation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tripActive, setTripActive] = useState(false);
  const [occupancy, setOccupancy] = useState(0);
  const [capacity] = useState(4);
  const cleanupRef = useRef<(() => void) | null>(null);

  const [vehicleId] = useState<string>("BUS-101");

  // 📍 LOCATION + TELEMETRY LOOP
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Location access required for live updates.");
        setLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(loc);
      setLoading(false);

      const locationSub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000,
          distanceInterval: 10,
        },
        async (pos) => {
          setLocation(pos);
          if (!tripActive) return;

          try {
            await apiClient.sendTelemetry({
              vehicleId,
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              occupancy,
              status: "active",
            });
            console.log("✅ Telemetry sent for", vehicleId);
          } catch (err) {
            console.warn("❌ Telemetry failed:", (err as any).message);
          }
        }
      );

      cleanupRef.current = () => locationSub.remove();

      return () => {
        if (cleanupRef.current) cleanupRef.current();
      };
    })();
  }, [token, tripActive, occupancy]);

  // 🛰️ DRIVER ALERTS VIA WEBSOCKET
  useEffect(() => {
    const cleanup = wsConnect((msg) => {
      if (msg.type === "alert") {
        console.log("📢 Driver received alert:", msg.message);
        Alert.alert("⚠️ Admin Alert", msg.message);
      }
    }, "driver");

    return cleanup;
  }, []);

  // 🧭 Trip controls
  const startTrip = async () => {
    try {
      await apiClient.controlTrip({ vehicleId, action: "start" });
      setTripActive(true);
      Alert.alert("Trip Started", "You are now live!");
    } catch (err) {
      Alert.alert("Failed to start trip");
      console.error(err);
    }
  };

  const stopTrip = async () => {
    try {
      await apiClient.controlTrip({ vehicleId, action: "stop" });
      setTripActive(false);
      Alert.alert("Trip Stopped", "Trip has been ended.");
    } catch (err) {
      Alert.alert("Failed to stop trip");
      console.error(err);
    }
  };

  const changeOccupancy = async (delta: number) => {
    try {
      const next = Math.max(0, Math.min(capacity, occupancy + delta));
      setOccupancy(next);
      await apiClient.updateOccupancy({ vehicleId, delta });
    } catch (err) {
      console.error("Occupancy update failed:", err);
      Alert.alert("Error", "Failed to update occupancy");
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text>Fetching GPS location...</Text>
      </View>
    );
  }

  const region = location
    ? {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01 * ASPECT_RATIO,
      }
    : {
        latitude: 13.0213,
        longitude: 77.5670,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01 * ASPECT_RATIO,
      };

  return (
    <View style={{ flex: 1 }}>
      <MapView provider={PROVIDER_GOOGLE} style={{ flex: 1 }} initialRegion={region} showsUserLocation>
        {location && (
          <Marker
            coordinate={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }}
            title={user?.name || "Driver"}
            description={tripActive ? "Trip active" : "Idle"}
          />
        )}
      </MapView>

      {/* Control Panel */}
      <View style={styles.panel}>
        <Text style={styles.title}>Vehicle: {vehicleId}</Text>
        <Text style={styles.status}>Status: {tripActive ? "🟢 Running" : "⚫ Idle"}</Text>
        <Text style={styles.occ}>Occupancy: {occupancy}/{capacity}</Text>

        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: "#16a34a" }]}
            onPress={() => changeOccupancy(+1)}
          >
            <Text style={styles.btnText}>+1</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: "#dc2626" }]}
            onPress={() => changeOccupancy(-1)}
          >
            <Text style={styles.btnText}>−1</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          {!tripActive ? (
            <TouchableOpacity
              style={[styles.btnWide, { backgroundColor: "#2563eb" }]}
              onPress={startTrip}
            >
              <Text style={styles.btnText}>Start Trip</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.btnWide, { backgroundColor: "#f59e0b" }]}
              onPress={stopTrip}
            >
              <Text style={styles.btnText}>Stop Trip</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  panel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(255,255,255,0.9)",
    padding: 15,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    alignItems: "center",
  },
  title: { fontSize: 18, fontWeight: "700" },
  status: { marginTop: 4, fontSize: 16 },
  occ: { marginTop: 8, fontSize: 20, fontWeight: "800" },
  row: { flexDirection: "row", justifyContent: "center", marginTop: 10 },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginHorizontal: 10,
  },
  btnWide: {
    paddingVertical: 12,
    paddingHorizontal: 50,
    borderRadius: 10,
    marginTop: 10,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
