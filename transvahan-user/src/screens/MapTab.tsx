// src/screens/MapTab.tsx
import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Dimensions, ActivityIndicator, Alert } from "react-native";
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import type { LocationObject } from "expo-location"; // ✅ Add this import
import { wsConnect } from "../api/ws";
import MapShuttleMarker from "../components/MapShuttleMarker";

const ASPECT_RATIO = Dimensions.get("window").width / Dimensions.get("window").height;

export default function MapTab() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [location, setLocation] = useState<LocationObject | null>(null);
  const [loading, setLoading] = useState(true);

  // ✅ FIXED: Initialize with null
  const cleanupRef = useRef<(() => void) | null>(null);

  const defaultRegion = {
    latitude: 13.0213,
    longitude: 77.5670,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01 * ASPECT_RATIO,
  };

  // --- Request user location ---
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Location access is needed to view nearby shuttles.");
        setLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(loc);
      setLoading(false);
    })();
  }, []);

  // --- Connect WebSocket for shuttle updates ---
  useEffect(() => {
    const cleanup = wsConnect((msg) => {
      setVehicles((prev) => {
        const idx = prev.findIndex((v) => v.id === msg.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = msg;
          return updated;
        }
        return [...prev, msg];
      });
    });

    cleanupRef.current = cleanup;

    // ✅ Safely clean up connection
    return () => {
      if (cleanupRef.current) cleanupRef.current();
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ marginTop: 10 }}>Fetching location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        showsUserLocation={true}
        followsUserLocation={true}
        initialRegion={
          location
            ? {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01 * ASPECT_RATIO,
              }
            : defaultRegion
        }
      >
        {vehicles.map((v) => (
          <Marker
            key={v.id}
            coordinate={{ latitude: v.lat, longitude: v.lng }}
            title={v.vehicle_id}
            description={`Vacant: ${v.vacant}/${v.capacity}`}
          >
            <MapShuttleMarker vehicle={v} />
            <Callout>
              <View style={{ width: 180 }}>
                <Text style={{ fontWeight: "700" }}>{v.vehicle_id}</Text>
                <Text>Route: {v.route_id}</Text>
                <Text>Vacant: {v.vacant}/{v.capacity}</Text>
                <Text>Status: {v.status}</Text>
              </View>
            </Callout>
          </Marker>
        ))}
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
  empty: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "#fff",
    padding: 8,
    borderRadius: 8,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
