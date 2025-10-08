// src/screens/DriverDashboardTab.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import axios from "axios";
import { useAuth } from "../auth/authContext";

const API_BASE_URL = "http://10.217.26.188:5001";
const ASPECT_RATIO = Dimensions.get("window").width / Dimensions.get("window").height;

export default function DriverDashboardTab() {
  const { token, user } = useAuth();
  const [location, setLocation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [vehicleId] = useState<string>("BUS-101");
  const [occupancy, setOccupancy] = useState<number>(0);
  const [capacity, setCapacity] = useState<number>(4);
  const [tripActive, setTripActive] = useState<boolean>(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  /* ------------------------ Fetch Current Occupancy ------------------------ */
  useEffect(() => {
    const fetchVehicle = async () => {
      try {
        const { data } = await axios.get(`${API_BASE_URL}/vehicle/${vehicleId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setOccupancy(data.occupancy ?? 0);
        setCapacity(data.capacity ?? 4);
      } catch (err) {
        console.warn("⚠️ Could not load vehicle:", err?.message);
      }
    };
    fetchVehicle();
  }, [vehicleId]);

  /* ------------------------ Location + Telemetry Loop ------------------------ */
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Location access required to update shuttle position.");
        setLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(loc);
      setLoading(false);

      const watcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000,
          distanceInterval: 10,
        },
        async (pos) => {
          setLocation(pos);
          if (tripActive) {
            try {
              await axios.post(
                `${API_BASE_URL}/driver/telemetry`,
                {
                  vehicleId,
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                  occupancy,
                  status: "running",
                  route_id: "R1",
                },
                { headers: { Authorization: `Bearer ${token}` } }
              );
              console.log("✅ Telemetry sent", pos.coords);
            } catch (err) {
              console.warn("❌ Telemetry failed:", err?.message);
            }
          }
        }
      );

      cleanupRef.current = () => watcher.remove();
    })();

    return () => {
      if (cleanupRef.current) cleanupRef.current();
    };
  }, [tripActive, occupancy]);

  /* ------------------------ Occupancy Control ------------------------ */
  const updateOccupancy = async (delta: number) => {
    try {
      const newOcc = Math.max(0, Math.min(capacity, occupancy + delta));
      setOccupancy(newOcc);
      await axios.post(
        `${API_BASE_URL}/driver/occupancy`,
        { vehicleId, delta },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      Alert.alert("Update Failed", "Could not update occupancy.");
    }
  };

  /* ------------------------ Trip Control ------------------------ */
  const toggleTrip = async () => {
    try {
      const action = tripActive ? "stop" : "start";
      await axios.post(
        `${API_BASE_URL}/driver/trip`,
        { vehicleId, action, route_id: "R1" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTripActive(!tripActive);
    } catch (err) {
      Alert.alert("Trip Control Failed", "Could not update trip status.");
      console.error(err);
    }
  };

  /* ------------------------ UI ------------------------ */
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
        longitude: 77.567,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01 * ASPECT_RATIO,
      };

  return (
    <View style={{ flex: 1 }}>
      {/* 🗺️ Map */}
      <MapView
        provider={PROVIDER_GOOGLE}
        style={{ flex: 0.6 }}
        region={region}
        showsUserLocation
      >
        {location && (
          <Marker
            coordinate={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }}
            title={user?.name || "Driver"}
            description={`Vehicle ${vehicleId}`}
          />
        )}
      </MapView>

      {/* 🧭 Controls */}
      <View style={styles.panel}>
        <Text style={styles.driverName}>{user?.name || "Driver"}</Text>
        <Text style={styles.subText}>{user?.email}</Text>
        <Text style={styles.subText}>Vehicle: {vehicleId}</Text>

        <View style={styles.occRow}>
          <TouchableOpacity style={styles.occBtn} onPress={() => updateOccupancy(-1)}>
            <Text style={styles.occBtnText}>−</Text>
          </TouchableOpacity>

          <Text style={styles.occValue}>
            {occupancy} / {capacity}
          </Text>

          <TouchableOpacity style={styles.occBtn} onPress={() => updateOccupancy(+1)}>
            <Text style={styles.occBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.tripBtn,
            { backgroundColor: tripActive ? "#dc2626" : "#16a34a" },
          ]}
          onPress={toggleTrip}
        >
          <Text style={styles.tripBtnText}>
            {tripActive ? "Stop Trip" : "Start Trip"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  panel: {
    flex: 0.4,
    backgroundColor: "#fff",
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  driverName: { fontSize: 20, fontWeight: "700", marginBottom: 4 },
  subText: { color: "#555", marginBottom: 4 },
  occRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 16,
  },
  occBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 30,
    width: 50,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  occBtnText: { color: "#fff", fontSize: 28, fontWeight: "700" },
  occValue: { fontSize: 24, fontWeight: "800", marginHorizontal: 16 },
  tripBtn: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  tripBtnText: { color: "#fff", fontSize: 18, fontWeight: "700" },
});
