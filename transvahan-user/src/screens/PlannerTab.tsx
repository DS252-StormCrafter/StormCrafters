// src/screens/PlannerTab.tsx
import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet } from "react-native";
import { apiClient as client } from "../api/client";

import haversine from "../utils/haversine";

export default function PlannerTab() {
  const [routes, setRoutes] = useState<any[]>([]);
  const [origin, setOrigin] = useState<string>("13.0213,77.5670"); // CSV lat,lng
  const [dest, setDest] = useState<string>("13.0200,77.5700");
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const routesData = await client.getRoutes();
        setRoutes(routesData || []);

      } catch (err) {
        console.warn(err);
      }
    })();
  }, []);

  function parseCoord(s: string) {
    const [lat, lng] = s.split(",").map((x) => Number(x.trim()));
    return { lat, lng };
  }

  const findMatches = () => {
    const o = parseCoord(origin);
    const d = parseCoord(dest);
    const matches: any[] = [];

    // threshold meters to consider near a stop
    const threshold = 500; // 500m

    for (const route of routes) {
      const stops = route.stops || [];
      // find nearest stop to origin and dest
      let originNear = null;
      let destNear = null;
      for (const s of stops) {
        const od = haversine(o.lat, o.lng, s.lat, s.lng);
        if (!originNear || od < originNear.dist) originNear = { stop: s, dist: od };
        const dd = haversine(d.lat, d.lng, s.lat, s.lng);
        if (!destNear || dd < destNear.dist) destNear = { stop: s, dist: dd };
      }

      if (originNear && destNear && originNear.dist <= threshold && destNear.dist <= threshold) {
        // estimate ETA: distance from origin to origin-near + route distance between stops + from dest-near to dest
        // approximate by straight-line distance / avg speed (25 km/h = 6.94 m/s)
        const avgSpeedKmph = 25;
        const originToStop = originNear.dist;
        const destToStop = destNear.dist;
        const straightDist = haversine(o.lat, o.lng, d.lat, d.lng);
        const etaMins = (straightDist / 1000) / avgSpeedKmph * 60;
        matches.push({
          routeId: route.id,
          routeName: route.name,
          originStop: originNear.stop,
          destStop: destNear.stop,
          originDist: Math.round(originToStop),
          destDist: Math.round(destToStop),
          etaMinutes: Math.round(etaMins),
        });
      }
    }
    setResults(matches);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Trip Planner</Text>

      <TextInput style={styles.input} value={origin} onChangeText={setOrigin} placeholder="Origin lat,lng" />
      <TextInput style={styles.input} value={dest} onChangeText={setDest} placeholder="Destination lat,lng" />

      <TouchableOpacity style={styles.btn} onPress={findMatches}>
        <Text style={{ color: "#fff" }}>Find Transvahans</Text>
      </TouchableOpacity>

      <FlatList
        data={results}
        keyExtractor={(it) => it.routeId}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={{ fontWeight: "700" }}>{item.routeName}</Text>
            <Text>ETA ~ {item.etaMinutes} mins</Text>
            <Text>Origin stop near: {item.originStop.name ?? "unknown"} ({item.originDist} m)</Text>
            <Text>Dest stop near: {item.destStop.name ?? "unknown"} ({item.destDist} m)</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={{ marginTop: 12 }}>No matching transvahans nearby</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  header: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
  input: { borderWidth: 1, borderColor: "#ddd", padding: 8, borderRadius: 8, marginBottom: 8 },
  btn: { backgroundColor: "#2563eb", padding: 10, borderRadius: 8, alignItems: "center", marginBottom: 12 },
  card: { padding: 12, borderRadius: 8, backgroundColor: "#fff", marginBottom: 12 },
});
