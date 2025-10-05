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

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
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
        setRoutes(routesData || []);
      } catch (err) {
        console.warn("Schedules fetch error:", err);
      }

      try {
        const vehiclesData = await client.getVehicles();
        setVehicles(vehiclesData || []);
      } catch (err) {
        console.warn("Vehicles fetch error:", err);
      }
    })();
  }, []);

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(expanded === id ? null : id);
  };

  const renderRouteCard = ({ item }: any) => {
    const isOpen = expanded === item.id;
    const assignedVehicles = vehicles.filter(
      (v) => v.currentRoute === item.id || v.line === item.line
    );

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
            {item.schedule?.length ? (
              item.schedule.map((trip: any, idx: number) => (
                <Text key={idx} style={styles.tripText}>
                  {trip.startTime
                    ? `${trip.startTime} → ${trip.endTime}`
                    : typeof trip === "string"
                    ? trip
                    : "—"}
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
