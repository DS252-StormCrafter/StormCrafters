// src/components/MapShuttleMarker.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function MapShuttleMarker({ vehicle }: { vehicle: any }) {
  const vacant = vehicle.vacant ?? (vehicle.capacity - (vehicle.occupancy || 0));
  const color = vacant > 0 ? "#16a34a" : "#ef4444"; // green or red

  return (
    <View style={[styles.container]}>
      <View style={[styles.badge, { backgroundColor: color }]}>
        <Text style={styles.badgeText}>{vacant}</Text>
      </View>
      <View style={styles.label}>
        <Text style={styles.labelText}>{vehicle.vehicle_id}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center" },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    elevation: 2,
  },
  badgeText: { color: "white", fontWeight: "700" },
  label: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 6,
  },
  labelText: { fontSize: 12, fontWeight: "600" },
});
