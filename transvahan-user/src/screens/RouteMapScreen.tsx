import React, { useEffect, useState } from "react";
import { View, Text, Alert } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import Constants from "expo-constants";
import axios from "axios";
import { useAuth } from "../auth/authContext";

const API = Constants.expoConfig?.extra?.API_BASE_URL;

export default function RouteMapScreen({ route }: any) {
  const { vehicle } = route.params;
  const { token } = useAuth();

  const [region, setRegion] = useState({
    latitude: vehicle.lat || 12.9716,
    longitude: vehicle.lng || 77.5946,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });
  const [stops, setStops] = useState<any[]>([]);

  useEffect(() => {
    async function fetchRoute() {
      try {
        const { data } = await axios.get(`${API}/routes/${vehicle.route_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setStops(data.stops || []);
      } catch (err: any) {
        Alert.alert("❌ Route fetch failed", err.response?.data?.error || "Error");
      }
    }
    fetchRoute();
  }, [vehicle.route_id]);

  return (
    <View style={{ flex: 1 }}>
      <MapView style={{ flex: 1 }} region={region}>
        <Marker
          coordinate={{ latitude: vehicle.lat, longitude: vehicle.lng }}
          title={`Shuttle ${vehicle.vehicle_id}`}
          description={`Vacant: ${vehicle.vacant}/${vehicle.capacity}`}
        />
        {stops.length > 0 &&
          stops.map((s, idx) => (
            <Marker
              key={idx}
              coordinate={{ latitude: s.lat, longitude: s.lng }}
              title={`Stop: ${s.name}`}
            />
          ))}
        {stops.length > 1 && (
          <Polyline
            coordinates={stops.map((s) => ({ latitude: s.lat, longitude: s.lng }))}
            strokeColor="#2563eb"
            strokeWidth={3}
          />
        )}
      </MapView>
      <View style={{ padding: 12 }}>
        <Text style={{ fontWeight: "700" }}>Route Info</Text>
        <Text>Route ID: {vehicle.route_id}</Text>
        <Text>Status: {vehicle.status}</Text>
      </View>
    </View>
  );
}
