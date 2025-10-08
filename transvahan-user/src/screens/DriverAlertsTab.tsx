// src/screens/DriverAlertsTab.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { apiClient } from "../api/client";

export default function DriverAlertsTab() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAlerts = async () => {
    try {
      setRefreshing(true);
      const data = await apiClient.getAlerts?.();
      setAlerts(data || []);
    } catch (err) {
      console.warn("Error fetching alerts:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    // ✅ subscribe to live alerts
    const unsubscribe = apiClient.subscribeAlerts?.((alert) => {
      setAlerts((prev) => [alert, ...prev]);
      Alert.alert("🔔 New Alert", alert.message || "Admin sent a notification");
    });
    return () => unsubscribe && unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text>Loading alerts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Admin Alerts</Text>
      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchAlerts} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.title || "Alert"}</Text>
            <Text style={styles.body}>{item.message}</Text>
            <Text style={styles.time}>
              {item.timestamp ? new Date(item.timestamp).toLocaleString() : "No timestamp"}
            </Text>
          </View>
        )}
        ListEmptyComponent={<Text style={{ textAlign: "center", marginTop: 20 }}>No alerts yet</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f9fafb" },
  header: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  title: { fontWeight: "700", fontSize: 16, marginBottom: 4 },
  body: { color: "#333", marginBottom: 6 },
  time: { fontSize: 12, color: "#666" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
