// src/screens/ScheduleTab.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  LayoutAnimation,
  UIManager,
  Platform,
} from "react-native";
import { apiClient as client } from "../api/client";
import ShuttleCard from "../components/ShuttleCard";
import { ScheduleEntry } from "../types";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function normalizeTime(raw: any): string {
  if (raw === null || raw === undefined) return "";
  const m = String(raw).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return "";
  const h = Math.min(Math.max(parseInt(m[1], 10), 0), 23);
  const min = Math.min(Math.max(parseInt(m[2], 10), 0), 59);
  return `${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
}

function normalizeSchedule(raw: any): ScheduleEntry[] {
  const rows = Array.isArray(raw) ? raw : [];
  return rows
    .map((r: any, idx: number) => {
      const startTime =
        normalizeTime(
          r.startTime ||
            r.start_time ||
            r.departTime ||
            r.depart_time ||
            r.time
        ) || "";
      if (!startTime) return null;
      const endTime =
        normalizeTime(
          r.endTime || r.end_time || r.arrivalTime || r.arrival_time
        ) || "";
      const direction =
        (r.direction || r.dir || "to").toString().toLowerCase() === "fro"
          ? "fro"
          : "to";
      return {
        id:
          r.id ||
          r.schedule_id ||
          r.trip_id ||
          `sch-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        startTime,
        endTime: endTime || undefined,
        direction,
        note: r.note || r.label || r.remark || "",
      };
    })
    .filter(Boolean) as ScheduleEntry[];
}

export default function ScheduleTab() {
  const [routes, setRoutes] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        console.log("📡 Fetching routes...");
        const routesData = await client.getRoutes();
        const shaped =
          (routesData || []).map((r: any) => ({
            ...r,
            schedule: normalizeSchedule(r.schedule || []),
          })) || [];
        setRoutes(shaped);
      } catch (err) {
        console.warn("Schedules fetch error:", err);
      }

      try {
        const vehiclesData = await client.getVehicles();
        const norm = (vehiclesData || []).map((v: any) => ({
          ...v,
          route_id: v.route_id || v.currentRoute || null,
          occupancy:
            typeof v.occupancy === "number" && Number.isFinite(v.occupancy)
              ? v.occupancy
              : 0,
          capacity:
            typeof v.capacity === "number" && Number.isFinite(v.capacity)
              ? v.capacity
              : 4,
        }));
        setVehicles(norm);
      } catch (err) {
        console.warn("Vehicles fetch error:", err);
      }
    })();
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    (async () => {
      if (!client.subscribeSchedules) return;
      try {
        cleanup = await client.subscribeSchedules((msg: any) => {
          const routeId = msg?.route_id || msg?.id;
          if (!routeId) return;
          const nextSchedule = normalizeSchedule(msg?.schedule || []);
          setRoutes((prev) =>
            (prev || []).map((r) =>
              r.id === routeId || r.route_id === routeId
                ? { ...r, schedule: nextSchedule }
                : r
            )
          );
        });
      } catch (err) {
        console.warn("Schedule WS subscription failed", err);
      }
    })();

    return () => {
      if (typeof cleanup === "function") cleanup();
    };
  }, []);

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(expanded === id ? null : id);
  };

  const formatTripLabel = (trip: any) => {
    if (!trip) return "—";
    if (typeof trip === "string") return trip;
    const direction =
      (trip.direction || trip.dir) === "fro" ? "FRO" : "TO";
    const start = trip.startTime || trip.start_time || trip.time || "";
    const end = trip.endTime || trip.end_time || "";
    const window = start ? `${start}${end ? ` → ${end}` : ""}` : "—";
    const note = trip.note ? ` · ${trip.note}` : "";
    return `${direction} ${window}${note}`;
  };

  const renderRouteCard = ({ item }: any) => {
    const isOpen = expanded === item.id;
    const routeKey = item.id || item.route_id;
    const assignedVehicles = vehicles.filter((v) => {
      const vr = v.route_id || v.currentRoute;
      return routeKey && vr && String(vr) === String(routeKey);
    });
    const scheduleRows = (item.schedule || []).slice().sort((a: any, b: any) => {
      const dirA = (a.direction || "to") === "fro" ? 1 : 0;
      const dirB = (b.direction || "to") === "fro" ? 1 : 0;
      if (dirA !== dirB) return dirA - dirB;
      return (a.startTime || "").localeCompare(b.startTime || "");
    });

    return (
      <View style={styles.card}>
        <TouchableOpacity onPress={() => toggleExpand(item.id)}>
          <Text style={styles.routeName}>{item.name}</Text>
          <Text style={styles.routeSub}>
            {item.start} → {item.end}
          </Text>
          <Text style={styles.routeSub}>
            Stops: {item.stops?.length ?? 0} | Trips: {item.schedule?.length ?? 0}
          </Text>
        </TouchableOpacity>

        {isOpen && (
          <View style={styles.details}>
            <Text style={styles.sectionTitle}>🕓 Schedule</Text>
            {scheduleRows.length ? (
              scheduleRows.map((trip: any, idx: number) => (
                <Text key={trip.id || idx} style={styles.tripText}>
                  {formatTripLabel(trip)}
                </Text>
              ))
            ) : (
              <Text style={styles.muted}>No trips defined</Text>
            )}

            <Text style={[styles.sectionTitle, { marginTop: 10 }]}>🧍 Assigned Vehicles</Text>
            {assignedVehicles.length ? (
              assignedVehicles.map((v) => <ShuttleCard key={v.id} vehicle={v} />)
            ) : (
              <Text style={styles.muted}>No vehicles assigned</Text>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>📅 Shuttle Schedules</Text>
      <FlatList
        data={routes}
        keyExtractor={(item) => item.id}
        renderItem={renderRouteCard}
        ListEmptyComponent={
          <Text style={styles.muted}>No routes available yet.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f9fafb" },
  header: { fontSize: 22, fontWeight: "700", marginBottom: 10 },
  card: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  routeName: { fontSize: 18, fontWeight: "700", color: "#111" },
  routeSub: { fontSize: 14, color: "#555" },
  details: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: "#e5e7eb" },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 6 },
  tripText: { color: "#111", marginBottom: 4 },
  muted: { color: "#777", fontStyle: "italic", marginTop: 4 },
});
