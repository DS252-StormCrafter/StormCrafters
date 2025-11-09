// src/screens/UserAlertsTab.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import axios from "axios";

const API_BASE_URL = "https://pg23gzqgsa.ap-south-1.awsapprunner.com";
const WS_URL = API_BASE_URL.replace(/^http/, "ws") + "/ws";

export default function UserAlertsTab() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch latest alerts
  const fetchAlerts = useCallback(async () => {
    try {
      setRefreshing(true);
      const { data } = await axios.get(`${API_BASE_URL}/alerts`);
      const filtered = Array.isArray(data)
        ? data.filter(
            (a) =>
              !["drivers", "driver", "admins", "admin"].includes(
                String(a.target).toLowerCase()
              )
          )
        : [];
      setAlerts(filtered);
    } catch (err) {
      console.warn("⚠️ Alerts fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Realtime WebSocket connection
  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    ws.onopen = () => console.log("🔔 WebSocket connected for user alerts");

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const type = msg.type?.toLowerCase();
        const target = String(msg.audience || msg.data?.target || "").toLowerCase();

        if (type === "alert" || type === "alert_created") {
          if (["drivers", "driver", "admins", "admin"].includes(target)) return;
          console.log("🚨 New alert received:", msg.data);
          setAlerts((prev) => [
            { ...msg.data, id: msg.data?.id || Date.now().toString() },
            ...prev,
          ]);
        } else if (type === "alert_resolved") {
          setAlerts((prev) =>
            prev.map((a) =>
              a.id === msg.data.id ? { ...a, resolved: true } : a
            )
          );
        } else if (type === "alert_deleted") {
          setAlerts((prev) => prev.filter((a) => a.id !== msg.data.id));
        }
      } catch (err) {
        console.warn("⚠️ WebSocket parse error:", err);
      }
    };

    ws.onerror = (err) => console.warn("❌ WS error:", err);
    ws.onclose = () => console.log("🔕 WebSocket disconnected (user alerts)");

    fetchAlerts(); // initial fetch
    return () => ws.close();
  }, [fetchAlerts]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ marginTop: 8 }}>Loading alerts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Service Alerts</Text>
      <FlatList
        data={alerts}
        keyExtractor={(item, index) => item.id || index.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchAlerts} />
        }
        renderItem={({ item }) => (
          <View style={[styles.card, item.resolved && styles.resolvedCard]}>
            <Text style={styles.title}>{item.title || "Alert"}</Text>
            <Text style={styles.body}>{item.message}</Text>
            <Text style={styles.time}>
              {new Date(item.createdAt || Date.now()).toLocaleString()}
              {item.resolved ? " ✅ Resolved" : ""}
            </Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No active alerts</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f9fafb" },
  header: { fontSize: 22, fontWeight: "700", marginBottom: 12, color: "#1e3a8a" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: "#2563eb",
  },
  resolvedCard: {
    opacity: 0.6,
    borderLeftColor: "#22c55e",
  },
  title: { fontWeight: "700", fontSize: 16, marginBottom: 4 },
  body: { color: "#333", marginBottom: 6 },
  time: { fontSize: 12, color: "#666" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  empty: { textAlign: "center", marginTop: 20 },
});
