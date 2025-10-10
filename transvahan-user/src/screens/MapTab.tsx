// src/screens/MapTab.tsx
import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Dimensions, ActivityIndicator, Alert } from "react-native";
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import type { LocationObject } from "expo-location";
import { wsConnect } from "../api/ws";
import MapShuttleMarker from "../components/MapShuttleMarker";

const ASPECT_RATIO = Dimensions.get("window").width / Dimensions.get("window").height;

export default function MapTab() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [location, setLocation] = useState<LocationObject | null>(null);
  const [loading, setLoading] = useState(true);
  const cleanupRef = useRef<(() => void) | null>(null);

  const defaultRegion = {
    latitude: 13.0213,
    longitude: 77.567,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01 * ASPECT_RATIO,
  };

  // 🧭 Request user location
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Location access is needed to view nearby shuttles.");
        setLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocation(loc);
      setLoading(false);
    })();
  }, []);

  // 🚐 WebSocket for live shuttle updates (USER ROLE)
  useEffect(() => {
    const cleanup = wsConnect((msg) => {
      // Handle live vehicle updates
      if (msg.type === "vehicle") {
        setVehicles((prev) => {
          const idx = prev.findIndex((v) => v.id === msg.id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = msg;
            return updated;
          }
          return [...prev, msg];
        });
      }

      // Handle broadcast alerts for users
      if (msg.type === "alert") {
        console.log("📢 User received alert:", msg.message);
        Alert.alert("⚠️ System Alert", msg.message);
      }
    }, "user");

    // 🧩 Defensive assignment (cleanup might not be a function)
    if (typeof cleanup === "function") {
      cleanupRef.current = cleanup;
    } else if (cleanup && typeof cleanup.close === "function") {
      cleanupRef.current = cleanup.close.bind(cleanup);
    } else {
      cleanupRef.current = null;
    }

    // 🧹 Proper cleanup on unmount
    return () => {
      try {
        if (cleanupRef.current && typeof cleanupRef.current === "function") {
          cleanupRef.current();
          console.log("🧹 Cleaned up MapTab WS");
        } else if (
          cleanupRef.current &&
          typeof (cleanupRef.current as any).close === "function"
        ) {
          (cleanupRef.current as any).close();
          console.log("🧹 Closed WS object safely");
        }
      } catch (err) {
        console.warn("⚠️ Cleanup error:", err);
      }
    };
  }, []);

  // 🧭 Show loader while fetching location
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ marginTop: 10 }}>Fetching location...</Text>
      </View>
    );
  }

  const currentRegion = location
    ? {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01 * ASPECT_RATIO,
      }
    : defaultRegion;

  // 🎨 Helper to color markers by vehicle status
  const getStatusColor = (status?: string) => {
    if (!status) return "#f59e0b"; // 🟠 unknown
    const s = status.toLowerCase();
    if (s.includes("run") || s.includes("active")) return "#16a34a"; // 🟢 active
    if (s.includes("idle") || s.includes("stop")) return "#dc2626"; // 🔴 inactive
    return "#f59e0b";
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        showsUserLocation={true}
        followsUserLocation={true}
        initialRegion={currentRegion}
      >
        {vehicles.map((v, idx) => {
          const key = v.id || v.vehicle_id || `marker-${idx}`;
          const lat = v.lat ?? v.location?.lat;
          const lng = v.lng ?? v.location?.lng;

          if (!lat || !lng) {
            console.warn("⚠️ Skipping vehicle with invalid coords:", v);
            return null;
          }

          const color = getStatusColor(v.status);

          return (
            <Marker
              key={key}
              coordinate={{ latitude: lat, longitude: lng }}
              title={v.vehicle_id || `Vehicle ${idx + 1}`}
              description={`Vacant: ${
                v.vacant ?? v.capacity - v.occupancy ?? "?"
              }/${v.capacity ?? "?"}`}
              pinColor={color}
            >
              <MapShuttleMarker vehicle={v} color={color} />
              <Callout tooltip>
                <View
                  style={[
                    styles.callout,
                    { borderColor: color, backgroundColor: "#fff" },
                  ]}
                >
                  <Text style={[styles.title, { color }]}>
                    {v.vehicle_id || key}
                  </Text>
                  <Text>Route: {v.route_id ?? "N/A"}</Text>
                  <Text>
                    Vacant:{" "}
                    {v.vacant ?? v.capacity - v.occupancy ?? "?"}/{v.capacity ?? "?"}
                  </Text>
                  <Text>Status: {v.status ?? "Unknown"}</Text>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      {vehicles.length === 0 && (
        <View style={styles.empty}>
          <Text>No shuttles available nearby.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  callout: {
    width: 190,
    padding: 10,
    borderRadius: 10,
    borderWidth: 2,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  title: { fontWeight: "700", fontSize: 15, marginBottom: 3 },
  empty: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "#fff",
    padding: 8,
    borderRadius: 8,
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
