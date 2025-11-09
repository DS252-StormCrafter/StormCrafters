// transvahan-user/src/screens/DriverDashboardTab.tsx
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
import { useAuth } from "../auth/authContext";
import DemandIndicator from "../components/DemandIndicator";
import { apiClient, http } from "../api/client";

const ASPECT_RATIO =
  Dimensions.get("window").width / Dimensions.get("window").height;

export default function DriverDashboardTab() {
  const { token, user } = useAuth();

  const [location, setLocation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [routeId, setRouteId] = useState<string | null>(null);
  const [direction, setDirection] = useState<"to" | "fro">("to");

  const [occupancy, setOccupancy] = useState<number>(0);
  const [capacity, setCapacity] = useState<number>(4);
  const [tripActive, setTripActive] = useState<boolean>(false);
  const [demandHigh, setDemandHigh] = useState<boolean>(false);

  // Upcoming reservations data for this route+direction
  const [routeStops, setRouteStops] = useState<any[]>([]);
  const [reservationSummary, setReservationSummary] = useState<any[]>([]);
  const [loadingReservations, setLoadingReservations] = useState(false);

  const gpsWatchRef = useRef<null | Location.LocationSubscription>(null);
  const wsCleanupRef = useRef<null | (() => void)>(null);

  // ------------------------ 1) Load driver assignment + vehicle ------------------------
  useEffect(() => {
    (async () => {
      try {
        const data = await apiClient.getDriverAssignment?.();
        const a = data?.assignment || data;
        if (a) {
          setVehicleId(a.vehicle_id);
          setRouteId(String(a.route_id));
          setDirection(
            a.direction === "fro" || a.direction === "FRO" ? "fro" : "to"
          );
        }
      } catch (err: any) {
        console.warn(
          "⚠️ Could not load driver assignment:",
          err?.message || err
        );
      }
    })();
  }, []);

  useEffect(() => {
    if (!vehicleId) return;
    (async () => {
      try {
        const res = await apiClient.getVehicles();
        const found = (res as any[])?.find(
          (v) => v.id === vehicleId || v.vehicle_id === vehicleId
        );
        if (found) {
          setOccupancy(found.occupancy ?? 0);
          setCapacity(found.capacity ?? 4);
          setDemandHigh(!!found.demand_high);
        }
      } catch (err) {
        console.warn(
          "⚠️ Could not load vehicle:",
          (err as any)?.message || err
        );
      }
    })();
  }, [vehicleId]);

  // ------------------------ 1b) Load stops + reservation summary for this route+direction ------------------------
  useEffect(() => {
    if (!routeId) {
      setRouteStops([]);
      setReservationSummary([]);
      return;
    }

    (async () => {
      try {
        setLoadingReservations(true);

        const [routeRes, summaryRes] = await Promise.all([
          http.get(`/routes/${routeId}`),
          http.get(`/routes/${routeId}/reservations/summary`, {
            params: { direction },
          }),
        ]);

        const routeData = routeRes.data;
        const dirStops = routeData?.directions?.[direction] || [];
        setRouteStops(dirStops);
        setReservationSummary(summaryRes.data?.stops || []);
      } catch (err: any) {
        console.warn(
          "⚠️ Could not load route/reservations:",
          err?.message || err
        );
        setRouteStops([]);
        setReservationSummary([]);
      } finally {
        setLoadingReservations(false);
      }
    })();
  }, [routeId, direction]);

  // ------------------------ 1c) WS: live reservation updates for this route+direction ------------------------
  useEffect(() => {
    if (!routeId) return;

    let cleanup: any;

    (async () => {
      if (!apiClient.subscribeReservations) return;
      cleanup = await apiClient.subscribeReservations((msg: any) => {
        if (msg.type !== "reservation_update" || !msg.data) return;
        const d = msg.data;
        const sameRoute =
          String(d.route_id).trim().toLowerCase() ===
          String(routeId).trim().toLowerCase();
        const sameDir =
          (d.direction || "to").toString().toLowerCase() ===
          direction.toLowerCase();
        if (!sameRoute || !sameDir) return;

        setReservationSummary(d.stops || []);
      });
    })();

    return () => {
      if (cleanup) cleanup();
    };
  }, [routeId, direction]);

  // ------------------------ 2) WS: live vehicle updates (occupancy, demand_high, etc.) ------------------------
  useEffect(() => {
    if (!vehicleId) return;

    (async () => {
      wsCleanupRef.current = await apiClient.subscribeVehicles(
        async (msg: any) => {
          if (msg.type === "vehicle" && msg.data) {
            const v = msg.data;
            const id = v.id || v.vehicle_id;
            if (String(id) === String(vehicleId)) {
              if (typeof v.occupancy === "number") setOccupancy(v.occupancy);
              if (typeof v.capacity === "number") setCapacity(v.capacity);
              setDemandHigh(!!v.demand_high);
            }
          }
          if (msg.type === "demand_update") {
            const d = msg.data;
            if (d?.vehicle_id && String(d.vehicle_id) === String(vehicleId)) {
              setDemandHigh(!!d.demand_high);
            }
          }
        }
      );
    })();

    return () => {
      if (wsCleanupRef.current) wsCleanupRef.current();
    };
  }, [vehicleId]);

  // ------------------------ 3) High-frequency telemetry loop ------------------------
  useEffect(() => {
    (async () => {
      if (!vehicleId) {
        setLoading(false);
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission denied",
          "Location access is required to update shuttle position."
        );
        setLoading(false);
        return;
      }

      const first = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });
      setLocation(first);
      setLoading(false);

      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Highest,
          timeInterval: 800,
          distanceInterval: 2,
        },
        async (pos) => {
          setLocation(pos);
          try {
            await apiClient.sendTelemetry?.({
              vehicleId,
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              status: tripActive ? "active" : "idle",
              route_id: routeId || undefined,
              direction,
            });
          } catch (err: any) {
            console.warn("❌ Telemetry failed:", err?.message || err);
          }
        }
      );

      gpsWatchRef.current = sub;
    })();

    return () => {
      if (gpsWatchRef.current) {
        gpsWatchRef.current.remove();
        gpsWatchRef.current = null;
      }
    };
  }, [vehicleId, routeId, direction, tripActive]);

  // ------------------------ 4) Occupancy control (+1 / -1) ------------------------
  const updateOccupancy = async (delta: number) => {
    if (!vehicleId) return;
    try {
      const next = Math.max(0, Math.min(capacity, occupancy + delta));
      setOccupancy(next); // optimistic UI
      await apiClient.updateOccupancy?.({ vehicleId, delta });
    } catch (err) {
      Alert.alert("Update Failed", "Could not update occupancy.");
      console.error("❌ occupancy update:", err);
    }
  };

  // ------------------------ 5) Trip control ------------------------
  const toggleTrip = async () => {
    if (!vehicleId) return;
    try {
      const action = tripActive ? "stop" : "start";
      await apiClient.controlTrip?.({
        vehicleId,
        action,
        route_id: routeId || undefined,
      });
      setTripActive(!tripActive);
    } catch (err) {
      Alert.alert("Trip Control Failed", "Could not update trip status.");
      console.error(err);
    }
  };

  // ------------------------ 6) Demand (heat) signal button ------------------------
  const sendDemand = async () => {
    try {
      if (!vehicleId) {
        Alert.alert("Missing vehicle", "No vehicle assigned to this driver.");
        return;
      }
      if (!routeId) {
        Alert.alert("Missing route", "No route assigned. Contact admin.");
        return;
      }
      if (!location?.coords) {
        Alert.alert("Location missing", "Current GPS fix not available.");
        return;
      }

      const body = {
        vehicle_id: vehicleId,
        route_id: routeId,
        direction,
        stop_id: null,
        lat: location.coords.latitude,
        lon: location.coords.longitude,
        high: true,
      };

      setDemandHigh(true); // optimistic
      await apiClient.sendDemand?.(body);
    } catch (err) {
      setDemandHigh(false);
      Alert.alert("Failed", "Could not send demand signal.");
    }
  };

  // ------------------------ Derived: stops with active reservations ------------------------
  const stopsWithWaiting = (() => {
    if (!routeStops.length || !reservationSummary.length) return [];

    const bySeq: Record<number, number> = {};
    reservationSummary.forEach((s: any) => {
      const seq = Number(s.sequence);
      if (!Number.isFinite(seq)) return;
      bySeq[seq] = Number(s.waiting_count ?? 0);
    });

    return routeStops
      .map((s: any, idx: number) => {
        const seq = Number(
          Number.isFinite(s.sequence) ? s.sequence : idx
        );
        return {
          ...s,
          sequence: seq,
          waiting_count: bySeq[seq] || 0,
        };
      })
      .filter((s: any) => s.waiting_count > 0);
  })();

  // ------------------------ UI ------------------------
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text>Fetching GPS location…</Text>
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
            description={
              vehicleId
                ? `Vehicle ${vehicleId}${
                    routeId ? ` • Route ${routeId}` : ""
                  }`
                : "No vehicle assigned"
            }
          />
        )}
      </MapView>

      <View style={styles.panel}>
        <Text style={styles.driverName}>{user?.name || "Driver"}</Text>
        <Text style={styles.subText}>{user?.email}</Text>
        <Text style={styles.subText}>
          Vehicle: {vehicleId || "—"}{" "}
          {routeId ? `• Route ${routeId} (${direction.toUpperCase()})` : ""}
        </Text>

        <View style={{ marginTop: 8, marginBottom: 12 }}>
          <DemandIndicator high={demandHigh} />
        </View>

        <View style={styles.occRow}>
          <TouchableOpacity
            style={styles.occBtn}
            onPress={() => updateOccupancy(-1)}
          >
            <Text style={styles.occBtnText}>−</Text>
          </TouchableOpacity>

          <Text style={styles.occValue}>
            {occupancy} / {capacity}
          </Text>

          <TouchableOpacity
            style={styles.occBtn}
            onPress={() => updateOccupancy(+1)}
          >
            <Text style={styles.occBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        <View
          style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}
        >
          <TouchableOpacity
            style={[styles.tripBtn, { backgroundColor: "#16a34a", flex: 1 }]}
            onPress={toggleTrip}
            disabled={!vehicleId}
          >
            <Text style={styles.tripBtnText}>
              {tripActive ? "Stop Trip" : "Start Trip"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tripBtn, { backgroundColor: "#2563eb", flex: 1 }]}
            onPress={sendDemand}
            disabled={!vehicleId || !routeId}
          >
            <Text style={styles.tripBtnText}>High demand here</Text>
          </TouchableOpacity>
        </View>

        {/* Upcoming reservations list */}
        <View style={{ marginTop: 16 }}>
          <Text style={styles.sectionTitle}>Upcoming reservations</Text>
          {loadingReservations ? (
            <Text style={styles.subText}>Loading reservations…</Text>
          ) : stopsWithWaiting.length === 0 ? (
            <Text style={styles.subText}>
              No active reservations on this route.
            </Text>
          ) : (
            stopsWithWaiting.map((s: any) => (
              <Text
                key={s.stop_id || s.sequence}
                style={styles.subText}
              >
                • {s.stop_name || `Stop ${s.sequence}`} —{" "}
                {s.waiting_count} waiting
              </Text>
            ))
          )}
        </View>
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
  tripBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
});
