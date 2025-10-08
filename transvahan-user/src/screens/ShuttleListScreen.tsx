import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity } from "react-native";
import Constants from "expo-constants";
import { useNavigation } from "@react-navigation/native";
import { useAlerts } from "../hooks/useAlerts";

// Fallback to explicit IP if not provided in app config
const API =
  Constants.expoConfig?.extra?.API_BASE_URL || "http://192.168.0.156:5001"; // 👈 replace with your machine IP

export default function ShuttleListScreen() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const navigation = useNavigation<any>();

  // listen for backend alerts
  useAlerts();

  useEffect(() => {
    if (!API) return;

    // IMPORTANT: convert http → ws and connect to /ws
    const wsUrl = API.replace(/^http/, "ws") + "/ws";
    console.log("🔌 Connecting to WebSocket:", wsUrl);

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => console.log("✅ WebSocket connected");
    ws.onclose = () => console.log("❌ WebSocket closed");

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);

        const vacant = data.capacity - (data.occupancy || 0);
        const shaped = { ...data, vacant };

        setVehicles((prev) => {
          const idx = prev.findIndex((v) => v.id === shaped.id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = shaped;
            return updated;
          }
          return [...prev, shaped];
        });
      } catch (err) {
        console.warn("⚠️ WS parse error", err);
      }
    };

    return () => ws.close();
  }, []);

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 12 }}>
        Available Shuttles
      </Text>
      <FlatList
        data={vehicles}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text>No shuttles available</Text>}
        renderItem={({ item }) => (
          <View
            style={{
              padding: 16,
              borderWidth: 1,
              borderColor: "#ccc",
              borderRadius: 10,
              marginBottom: 10,
              backgroundColor: "#fff",
            }}
          >
            <Text style={{ fontWeight: "600", fontSize: 16 }}>
              {item.vehicle_id}
            </Text>
            <Text>Route: {item.route_id}</Text>
            <Text>Status: {item.status}</Text>
            <Text>
              Vacant Seats: {item.vacant}/{item.capacity}
            </Text>

            <View style={{ flexDirection: "row", marginTop: 10 }}>
              <TouchableOpacity
                style={{
                  padding: 8,
                  backgroundColor: "#2563eb",
                  borderRadius: 6,
                  marginRight: 10,
                }}
                onPress={() =>
                  navigation.navigate("RouteMap", { vehicle: item })
                }
              >
                <Text style={{ color: "white" }}>View Map</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  padding: 8,
                  backgroundColor: "#111827",
                  borderRadius: 6,
                }}
                onPress={() =>
                  navigation.navigate("Feedback", { vehicle_id: item.vehicle_id })
                }
              >
                <Text style={{ color: "white" }}>Give Feedback</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}
