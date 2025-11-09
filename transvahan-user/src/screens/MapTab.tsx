// transvahan-user/src/screens/MapTab.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Keyboard,
} from "react-native";
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
} from "react-native-maps";
import * as Location from "expo-location";
import type { LocationObject } from "expo-location";
import { http } from "../api/client";
import { wsConnect } from "../api/ws";
import BusMarker from "../components/BusMarker";

const { height, width } = Dimensions.get("window");
const ASPECT_RATIO = width / height;

type LatLng = { latitude: number; longitude: number };

type Stop = {
  stop_id?: string;
  id?: string;
  stop_name: string;
  route_id?: string | number;
  route_name?: string;
  lat: number;
  lon: number;
  direction?: string;
  distance?: number;
};

type Vehicle = {
  id: string;
  vehicle_id: string;
  lat: number;
  lon: number;
  status?: string;
  capacity?: number;
  occupancy?: number;
  route_id?: string;
  direction?: string;
};

function computeBearing(a: LatLng, b: LatLng): number {
  if (!a || !b) return 0;
  if (a.latitude === b.latitude && a.longitude === b.longitude) return 0;

  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;

  const φ1 = toRad(a.latitude);
  const φ2 = toRad(b.latitude);
  const Δλ = toRad(b.longitude - a.longitude);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

const normalizeVehicle = (raw: any): Vehicle | null => {
  if (!raw) return null;

  const id =
    raw.vehicle_id || raw.id || raw.plateNo || String(Date.now());

  const lat =
    raw.lat ??
    raw.latitude ??
    raw.location?.lat ??
    raw.location?.latitude;
  const lon =
    raw.lon ??
    raw.lng ??
    raw.longitude ??
    raw.location?.lng ??
    raw.location?.longitude;

  if (typeof lat !== "number" || typeof lon !== "number") return null;

  return {
    id,
    vehicle_id: id,
    lat,
    lon,
    status: raw.status ?? "idle",
    capacity: typeof raw.capacity === "number" ? raw.capacity : 4,
    occupancy: typeof raw.occupancy === "number" ? raw.occupancy : 0,
    route_id: raw.route_id ?? raw.currentRoute ?? undefined,
    direction: raw.direction ?? raw.dir ?? undefined,
  };
};

export default function MapTab() {
  // 🔹 Location / map
  const [userLoc, setUserLoc] = useState<LocationObject | null>(null);
  const [locLoading, setLocLoading] = useState(true);
  const [region, setRegion] = useState({
    latitude: 13.0205,
    longitude: 77.5655,
    latitudeDelta: 0.012,
    longitudeDelta: 0.012,
  });

  // 🔹 Stops (for search)
  const [allStops, setAllStops] = useState<Stop[]>([]);
  const [stopsLoading, setStopsLoading] = useState(false);
  const [stopsError, setStopsError] = useState<string | null>(null);

  const [nearby, setNearby] = useState<Stop[]>([]);

  // 🔹 Search state (Google Maps-like)
  const [fromQuery, setFromQuery] = useState("");
  const [toQuery, setToQuery] = useState("");
  const [fromStop, setFromStop] = useState<Stop | null>(null);
  const [toStop, setToStop] = useState<Stop | null>(null);

  const [planResult, setPlanResult] = useState<any | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  // 🔹 Live vehicles
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const prevPosRef = useRef<Record<string, LatLng>>({});

  // Colors per line (reuse from planner)
  const routeColors: Record<string, string> = {
    Red: "#ef4444",
    Green: "#22c55e",
    Blue: "#3b82f6",
    Orange: "#f97316",
    Purple: "#a855f7",
  };

  const validLatLon = (s: any) =>
    s &&
    typeof s.lat === "number" &&
    typeof s.lon === "number" &&
    !isNaN(s.lat) &&
    !isNaN(s.lon);

  // 🧭 Get user location once
  useEffect(() => {
    (async () => {
      try {
        const { status } =
          await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          alert(
            "Location permission is required to show nearby shuttles"
          );
          setLocLoading(false);
          return;
        }

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
        });
        setUserLoc(loc);
        setRegion((prev) => ({
          ...prev,
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015 * ASPECT_RATIO,
        }));
      } catch (err) {
        console.warn("Location error in MapTab:", err);
      } finally {
        setLocLoading(false);
      }
    })();
  }, []);

  // 📍 Load all stops for name search
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setStopsLoading(true);
        const { data } = await http.get("/routes/stops/all");

        if (cancelled) return;

        if (Array.isArray(data)) {
          const filtered = data.filter((s: any) => validLatLon(s));
          setAllStops(filtered);
          setStopsError(null);
        } else {
          setAllStops([]);
          setStopsError("Unexpected stops response");
        }
      } catch (err) {
        console.warn("Stops load error:", err);
        if (!cancelled) {
          setStopsError("Failed to load stops");
        }
      } finally {
        if (!cancelled) setStopsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // 🧭 Nearby stops based on user location
  useEffect(() => {
    if (!userLoc) return;

    (async () => {
      try {
        const { latitude, longitude } = userLoc.coords;
        const { data } = await http.get(
          `/stops/nearby?lat=${latitude}&lon=${longitude}&radius=250`
        );
        if (Array.isArray(data?.stops)) {
          setNearby(
            data.stops.filter((s: any) => validLatLon(s)) as Stop[]
          );
        }
      } catch (err) {
        console.warn("Nearby stops error:", err);
      }
    })();
  }, [userLoc]);

  // 🚐 Subscribe to live vehicles
  useEffect(() => {
    const disconnect = wsConnect((msg) => {
      if (msg.type !== "vehicle" || !msg.data) return;
      const normalized = normalizeVehicle(msg.data);
      if (!normalized) return;

      setVehicles((prev) => {
        const idx = prev.findIndex(
          (v) => v.id === normalized.id
        );
        if (idx === -1) {
          return [...prev, normalized];
        }
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...normalized };
        return copy;
      });
    });

    return () => {
      if (typeof disconnect === "function") disconnect();
    };
  }, []);

  const filterStops = (query: string): Stop[] => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return allStops
      .filter((s) => {
        const name = (s.stop_name || "").toLowerCase();
        const route = (s.route_name || "").toLowerCase();
        return name.includes(q) || route.includes(q);
      })
      .slice(0, 8);
  };

  const fromSuggestions = filterStops(fromQuery);
  const toSuggestions = filterStops(toQuery);

  const selectFromStop = (stop: Stop) => {
    setFromStop(stop);
    setFromQuery(
      stop.route_name
        ? `${stop.stop_name} (${stop.route_name})`
        : stop.stop_name
    );
    setPlanResult(null);
    setPlanError(null);
    Keyboard.dismiss();
  };

  const selectToStop = (stop: Stop) => {
    setToStop(stop);
    setToQuery(
      stop.route_name
        ? `${stop.stop_name} (${stop.route_name})`
        : stop.stop_name
    );
    setPlanResult(null);
    setPlanError(null);
    Keyboard.dismiss();
  };

  const handleNearbyTap = (stop: Stop) => {
    // If "From" is empty, fill that first; otherwise set "To"
    if (!fromStop) {
      selectFromStop(stop);
    } else {
      selectToStop(stop);
    }
  };

  const planRoute = async () => {
    if (!fromStop || !toStop) {
      setPlanError("Please select both origin and destination stops.");
      return;
    }

    if (!validLatLon(fromStop) || !validLatLon(toStop)) {
      setPlanError("Selected stops are missing coordinates.");
      return;
    }

    try {
      setPlanLoading(true);
      setPlanError(null);

      const fromLat = fromStop.lat;
      const fromLon = fromStop.lon;
      const toLat = toStop.lat;
      const toLon = toStop.lon;

      const { data } = await http.get(
        `/planner/plan?fromLat=${fromLat}&fromLon=${fromLon}&toLat=${toLat}&toLon=${toLon}`
      );

      setPlanResult(data);

      setRegion({
        latitude: (fromLat + toLat) / 2,
        longitude: (fromLon + toLon) / 2,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01 * ASPECT_RATIO,
      });
    } catch (err) {
      console.warn("Planner error:", err);
      setPlanError("Unable to find route between these stops.");
    } finally {
      setPlanLoading(false);
    }
  };

  // Build sequential coordinates for map
  const buildLines = () => {
    if (!planResult?.steps) return [];
    const lines: any[] = [];

    planResult.steps.forEach((step: any) => {
      if (
        step.type === "ride" &&
        validLatLon(step.from) &&
        validLatLon(step.to)
      ) {
        lines.push({
          type: "ride",
          color: routeColors[step.route_name] || "#6b7280",
          coords: [
            {
              latitude: step.from.lat,
              longitude: step.from.lon,
            },
            { latitude: step.to.lat, longitude: step.to.lon },
          ],
        });
      } else if (step.type === "walk" && validLatLon(step.to)) {
        lines.push({
          type: "walk",
          color: "#000",
          coords: [
            { latitude: step.to.lat, longitude: step.to.lon },
          ],
        });
      }
    });
    return lines;
  };

  const lines = buildLines();
  const vehiclesArr = vehicles;

  if (locLoading)
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2563eb" size="large" />
        <Text>Fetching location…</Text>
      </View>
    );

  return (
    <View style={styles.container}>
      {/* 🔍 Google-maps style search panel */}
      <View style={styles.searchPanel}>
        <Text style={styles.title}>
          🧭 Plan your trip across campus
        </Text>

        <View style={styles.inputWrapper}>
          <Text style={styles.label}>From</Text>
          <TextInput
            style={styles.input}
            value={fromQuery}
            onChangeText={(t) => {
              setFromQuery(t);
              setFromStop(null);
              setPlanResult(null);
              setPlanError(null);
            }}
            placeholder="Search for a stop or building name"
          />
          {fromSuggestions.length > 0 && (
            <View style={styles.suggestionsBox}>
              {fromSuggestions.map((s) => (
                <TouchableOpacity
                  key={`${s.stop_name}_${s.route_id}_${s.lat}_${s.lon}`}
                  style={styles.suggestionItem}
                  onPress={() => selectFromStop(s)}
                >
                  <Text style={styles.suggestionTitle}>
                    {s.stop_name}
                  </Text>
                  <Text style={styles.suggestionMeta}>
                    {s.route_name || s.route_id || "Route"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.inputWrapper}>
          <Text style={styles.label}>To</Text>
          <TextInput
            style={styles.input}
            value={toQuery}
            onChangeText={(t) => {
              setToQuery(t);
              setToStop(null);
              setPlanResult(null);
              setPlanError(null);
            }}
            placeholder="Search for a stop or building name"
          />
          {toSuggestions.length > 0 && (
            <View style={styles.suggestionsBox}>
              {toSuggestions.map((s) => (
                <TouchableOpacity
                  key={`${s.stop_name}_${s.route_id}_${s.lat}_${s.lon}_to`}
                  style={styles.suggestionItem}
                  onPress={() => selectToStop(s)}
                >
                  <Text style={styles.suggestionTitle}>
                    {s.stop_name}
                  </Text>
                  <Text style={styles.suggestionMeta}>
                    {s.route_name || s.route_id || "Route"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Nearby stops chips (kept from old PlannerTab, but smarter) */}
        {nearby.length > 0 && (
          <View style={styles.nearbyContainer}>
            <Text style={styles.nearbyLabel}>Nearby stops</Text>
            <FlatList
              data={nearby}
              horizontal
              keyExtractor={(item, idx) =>
                `${item.stop_name}_${item.route_id}_${idx}`
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.nearChip}
                  onPress={() => handleNearbyTap(item)}
                >
                  <Text style={{ fontSize: 12 }}>
                    {item.stop_name} ({item.route_name}) •{" "}
                    {item.distance != null
                      ? `${Math.round(item.distance)} m`
                      : ""}
                  </Text>
                </TouchableOpacity>
              )}
              showsHorizontalScrollIndicator={false}
            />
          </View>
        )}

        <TouchableOpacity
          style={styles.planButton}
          onPress={planRoute}
        >
          <Text style={styles.planButtonText}>
            {planLoading ? "Planning…" : "Plan trip"}
          </Text>
        </TouchableOpacity>

        {stopsLoading && (
          <Text style={styles.muted}>
            Loading stops for search…
          </Text>
        )}
        {stopsError && (
          <Text style={styles.errorText}>{stopsError}</Text>
        )}
        {planError && (
          <Text style={styles.errorText}>{planError}</Text>
        )}
      </View>

      {/* 🗺 Map: live shuttles + planned route */}
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation
        followsUserLocation
      >
        {/* origin / dest markers */}
        {fromStop && validLatLon(fromStop) && (
          <Marker
            coordinate={{
              latitude: fromStop.lat,
              longitude: fromStop.lon,
            }}
            title={`From: ${fromStop.stop_name}`}
            pinColor="#000"
          />
        )}
        {toStop && validLatLon(toStop) && (
          <Marker
            coordinate={{
              latitude: toStop.lat,
              longitude: toStop.lon,
            }}
            title={`To: ${toStop.stop_name}`}
            pinColor="#000"
          />
        )}

        {/* Draw walking (dotted) and Transvahan (solid) paths */}
        {lines.map((line: any, i: number) => (
          <Polyline
            key={`poly_${i}`}
            coordinates={line.coords}
            strokeWidth={line.type === "walk" ? 3 : 5}
            lineDashPattern={
              line.type === "walk" ? [6, 4] : undefined
            }
            strokeColor={line.color}
          />
        ))}

        {/* Stop markers for ride segments */}
        {planResult?.steps
          ?.filter(
            (s: any) =>
              s.type === "ride" &&
              validLatLon(s.from)
          )
          .map((s: any, i: number) => (
            <Marker
              key={`stop_${i}_${s.from.stop_name}_${s.route_id || i}`}
              coordinate={{
                latitude: s.from.lat,
                longitude: s.from.lon,
              }}
              pinColor={routeColors[s.route_name] || "#6b7280"}
              title={`${s.from.stop_name} (${s.route_name})`}
            />
          ))}

        {/* 🚐 Live shuttle markers using shared BusMarker */}
        {vehiclesArr.map((v, idx) => {
          const label = v.vehicle_id || v.id || `bus_${idx}`;
          const current: LatLng = {
            latitude: v.lat,
            longitude: v.lon,
          };
          const prev = prevPosRef.current[label];
          const heading = prev
            ? computeBearing(prev, current)
            : 0;
          prevPosRef.current[label] = current;

          return (
            <BusMarker
              key={`veh_${label}_${idx}`}
              coordinate={current}
              heading={heading}
            />
          );
        })}
      </MapView>

      {/* Live info + “no shuttles” overlay */}
      {vehiclesArr.length === 0 ? (
        <View style={styles.overlay}>
          <Text style={styles.muted}>No active shuttles yet.</Text>
        </View>
      ) : (
        <View style={styles.overlay}>
          <Text style={styles.muted}>
            {vehiclesArr.length} active shuttle
            {vehiclesArr.length === 1 ? "" : "s"} live on map
          </Text>
        </View>
      )}

      {/* Itinerary card (same info as old PlannerTab, just below map) */}
      {planResult && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Itinerary</Text>
          {planResult.steps.map((s: any, idx: number) => {
            if (s.type === "walk")
              return (
                <Text key={idx} style={styles.cardLine}>
                  🚶 Walk {Math.round(s.distance)} m →{" "}
                  {s.to.stop_name || "destination"}
                </Text>
              );
            if (s.type === "ride")
              return (
                <Text key={idx} style={styles.cardLine}>
                  🚌 Take {s.route_name} Line from{" "}
                  {s.from.stop_name} → {s.to.stop_name}
                </Text>
              );
            if (s.type === "transfer")
              return (
                <Text key={idx} style={styles.cardLine}>
                  🔁 Transfer between{" "}
                  {s.between[0].stop_name} ↔{" "}
                  {s.between[1].stop_name}
                </Text>
              );
            return null;
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  searchPanel: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: "#f9fafb",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  inputWrapper: {
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    marginBottom: 2,
    color: "#4b5563",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#fff",
    fontSize: 14,
  },
  suggestionsBox: {
    marginTop: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    maxHeight: 150,
  },
  suggestionItem: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  suggestionMeta: {
    fontSize: 11,
    color: "#6b7280",
  },
  nearbyContainer: {
    marginTop: 4,
    marginBottom: 4,
  },
  nearbyLabel: {
    fontSize: 12,
    color: "#4b5563",
    marginBottom: 2,
  },
  nearChip: {
    backgroundColor: "#e0e7ff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
  },
  planButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 4,
  },
  planButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  muted: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
    textAlign: "center",
  },
  errorText: {
    color: "#b91c1c",
    textAlign: "center",
    marginTop: 4,
    fontSize: 12,
  },

  map: {
    width: "100%",
    height: height * 0.45,
    marginTop: 4,
    marginBottom: 8,
  },
  overlay: {
    position: "absolute",
    bottom: height * 0.45 + 4,
    left: 0,
    right: 0,
    alignItems: "center",
  },

  card: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 10,
    marginHorizontal: 12,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  cardTitle: {
    fontWeight: "700",
    marginBottom: 4,
    fontSize: 14,
  },
  cardLine: {
    fontSize: 13,
    marginBottom: 2,
  },
});