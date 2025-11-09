//transvahan-user/src/screens/DriverMapTab.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from "react-native";
import MapView, { Marker, UrlTile } from "react-native-maps";
import * as Location from "expo-location";
import { useAuth } from "../auth/authContext";
import { apiClient } from "../api/client";
import { wsConnect } from "../api/ws";
import DemandIndicator from "../components/DemandIndicator";

const ASPECT_RATIO = Dimensions.get("window").width / Dimensions.get("window").height;

/**
 * Same mapping as DashboardTab.
 */
const VEHICLE_ID = "BUS-101";
const ROUTE_ID_FOR_THIS_VEHICLE = "001";
const ROUTE_DIRECTION_FOR_THIS_VEHICLE: "to" | "fro" = "to";

export default function DriverMapTab() {
  const { token, user } = useAuth();
  const [location, setLocation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tripActive, setTripActive] = useState(false);
  const [occupancy, setOccupancy] = useState(0);
  const [capacity] = useState(4);
  const cleanupRef = useRef<(() => void) | null>(null);

  const [demandHigh, setDemandHigh] = useState<boolean>(false);

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
        { accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 10 },
        async (pos) => {
          setLocation(pos);
          if (!tripActive) return;
          try {
            await apiClient.sendTelemetry!({
              vehicleId: VEHICLE_ID,
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              occupancy,
              status: "active",
              route_id: ROUTE_ID_FOR_THIS_VEHICLE,
              direction: ROUTE_DIRECTION_FOR_THIS_VEHICLE,
            });
          } catch (err) {
            console.warn("❌ Telemetry failed:", (err as any).message);
          }
        }
      );

      cleanupRef.current = () => locationSub.remove();
    })();

    return () => {
      if (cleanupRef.current) cleanupRef.current();
    };
  }, [token, tripActive, occupancy]);

  // 🛰️ DRIVER ALERTS + DEMAND VIA WEBSOCKET
  useEffect(() => {
    const cleanup = wsConnect((msg) => {
      if (msg.type === "alert") {
        Alert.alert("⚠️ Admin Alert", msg.message);
      }
      if (msg.type === "vehicle" && msg?.data?.id) {
        const v = msg.data;
        if (v.id === VEHICLE_ID || v.vehicle_id === VEHICLE_ID) {
          if (typeof v.occupancy === "number") setOccupancy(v.occupancy);
          setDemandHigh(!!v.demand_high);
        }
      }
      if (msg.type === "demand_update") {
        const d = msg.data;
        if (d?.vehicle_id === VEHICLE_ID) setDemandHigh(!!d.demand_high);
      }
    });
    return cleanup;
  }, []);

  // 🧭 Trip controls
  const startTrip = async () => {
    try {
      await apiClient.controlTrip!({
        vehicleId: VEHICLE_ID,
        action: "start",
        route_id: ROUTE_ID_FOR_THIS_VEHICLE,
      });
      setTripActive(true);
      Alert.alert("Trip Started", "You are now live!");
    } catch (err) {
      Alert.alert("Failed to start trip");
    }
  };
  const stopTrip = async () => {
    try {
      await apiClient.controlTrip!({
        vehicleId: VEHICLE_ID,
        action: "stop",
        route_id: ROUTE_ID_FOR_THIS_VEHICLE,
      });
      setTripActive(false);
      Alert.alert("Trip Stopped", "Trip has been ended.");
    } catch (err) {
      Alert.alert("Failed to stop trip");
    }
  };

  const changeOccupancy = async (delta: number) => {
    try {
      const next = Math.max(0, Math.min(capacity, occupancy + delta));
      setOccupancy(next);
      await apiClient.updateOccupancy!({ vehicleId: VEHICLE_ID, delta });
    } catch {
      Alert.alert("Error", "Failed to update occupancy");
    }
  };

  // ✅ Demand button
  const sendDemand = async () => {
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const body = {
        vehicle_id: VEHICLE_ID,
        route_id: ROUTE_ID_FOR_THIS_VEHICLE,
        direction: ROUTE_DIRECTION_FOR_THIS_VEHICLE,
        stop_id: null,
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        high: true,
        occupancy,
      };
      setDemandHigh(true); // optimistic
      await apiClient.sendDemand!(body);
    } catch {
      setDemandHigh(false);
      Alert.alert("Failed", "Could not send demand signal.");
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
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
    : { latitude: 13.0213, longitude: 77.567, latitudeDelta: 0.01, longitudeDelta: 0.01 * ASPECT_RATIO };

  return (
    <View style={{ flex: 1 }}>
      <MapView style={{ flex: 1 }} mapType="none" initialRegion={region} showsUserLocation>
        <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} flipY={false} zIndex={0} />
        {location && (
          <Marker
            coordinate={{ latitude: location.coords.latitude, longitude: location.coords.longitude }}
            title={user?.name || "Driver"}
            description={tripActive ? "Trip active" : "Idle"}
          />
        )}
      </MapView>

      <View style={styles.attribution}>
        <Text style={styles.attrText}>© OpenStreetMap contributors</Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.title}>Vehicle: {VEHICLE_ID}</Text>
        <Text style={styles.status}>Status: {tripActive ? "🟢 Running" : "⚫ Idle"}</Text>
        <Text style={styles.status}>
          Route: {ROUTE_ID_FOR_THIS_VEHICLE} ({ROUTE_DIRECTION_FOR_THIS_VEHICLE.toUpperCase()})
        </Text>
        <View style={{ marginTop: 8, marginBottom: 12 }}>
          <DemandIndicator high={demandHigh} />
        </View>

        <Text style={styles.occ}>Occupancy: {occupancy}/{capacity}</Text>

        <View style={styles.row}>
          <TouchableOpacity style={[styles.btn, { backgroundColor: "#16a34a" }]} onPress={() => changeOccupancy(+1)}>
            <Text style={styles.btnText}>+1</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { backgroundColor: "#dc2626" }]} onPress={() => changeOccupancy(-1)}>
            <Text style={styles.btnText}>−1</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.btnWide, { backgroundColor: "#2563eb" }]} onPress={sendDemand}>
          <Text style={styles.btnText}>High demand here</Text>
        </TouchableOpacity>

        <View style={styles.row}>
          {!tripActive ? (
            <TouchableOpacity style={[styles.btnWide, { backgroundColor: "#2563eb" }]} onPress={startTrip}>
              <Text style={styles.btnText}>Start Trip</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.btnWide, { backgroundColor: "#f59e0b" }]} onPress={stopTrip}>
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
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(255,255,255,0.95)",
    padding: 15, borderTopLeftRadius: 16, borderTopRightRadius: 16, alignItems: "center",
  },
  title: { fontSize: 18, fontWeight: "700" },
  status: { marginTop: 4, fontSize: 16 },
  occ: { marginTop: 8, fontSize: 20, fontWeight: "800" },
  row: { flexDirection: "row", justifyContent: "center", marginTop: 10, gap: 12 },
  btn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  btnWide: { paddingVertical: 12, paddingHorizontal: 50, borderRadius: 10, marginTop: 10 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  attribution: {
    position: "absolute", right: 8, bottom: 8,
    backgroundColor: "rgba(255,255,255,0.9)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  attrText: { fontSize: 10, color: "#111" },
});
