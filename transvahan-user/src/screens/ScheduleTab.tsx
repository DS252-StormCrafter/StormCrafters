// src/screens/ScheduleTab.tsx
import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from "react-native";
import { apiClient as client } from "../api/client";
import ShuttleCard from "../components/ShuttleCard";

export default function ScheduleTab() {
  const [routes, setRoutes] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const routesData = await client.getRoutes();
                setRoutes(routesData || []);
      } catch (err) {
        console.warn("Routes fetch error", err);
      }

      try {
        const vehiclesData = await client.getVehicles();
                setRoutes(vehiclesData || []);
      } catch (err) {
        console.warn("Vehicles fetch error", err);
      }
    })();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Routes</Text>
      <FlatList
        data={routes}
        keyExtractor={(it) => it.id}
        renderItem={({ item }) => (
          <View style={styles.routeCard}>
            <Text style={{ fontWeight: "700" }}>{item.name}</Text>
            <Text>Stops: {item.stops?.length ?? 0}</Text>
            <Text>Schedule: {item.schedule ? "Defined" : "Not set"}</Text>
            <TouchableOpacity style={styles.btn}>
              <Text style={{ color: "#fff" }}>View Vehicles</Text>
            </TouchableOpacity>

            {/* show vehicles on this route */}
            <FlatList
              data={vehicles.filter((v) => v.currentRoute === item.id)}
              keyExtractor={(v) => v.id}
              renderItem={({ item: v }) => <ShuttleCard vehicle={v} />}
            />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  header: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
  routeCard: { padding: 12, borderRadius: 10, backgroundColor: "#fff", marginBottom: 12 },
  btn: { marginTop: 8, backgroundColor: "#2563eb", padding: 8, borderRadius: 6, alignItems: "center" },
});
