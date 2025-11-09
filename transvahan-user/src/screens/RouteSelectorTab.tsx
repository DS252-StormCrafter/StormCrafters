// transvahan-user/src/screens/RouteSelectorTab.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { apiClient as client, http } from "../api/client";

type RouteItem = {
  id: string;
  route_id?: string;
  route_name: string;
  start?: string;
  end?: string;
  to_count?: number;
  fro_count?: number;
};

type RawStop = {
  stop_name: string;
  route_id?: string | number;
  route_name?: string;
  lat: number;
  lon: number;
};

type UniqueStop = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  routes: string[];
};

type PlannerStep = {
  type: "walk" | "ride" | "transfer";
  distance?: number;
  route_name?: string;
  from?: { stop_name: string };
  to?: { stop_name: string };
  between?: { stop_name: string }[];
};

type PlannerResult = {
  steps: PlannerStep[];
};

const ROUTE_COLORS: Record<string, string> = {
  Red: "#ef4444",
  Blue: "#3b82f6",
  Green: "#22c55e",
  Orange: "#f97316",
  Purple: "#a855f7",
};

function normalizeRoutes(list: any[]): RouteItem[] {
  return (list || []).map((r: any) => ({
    id: String(r.id || r.route_id),
    route_id: r.route_id || r.id,
    route_name: r.route_name || r.line || r.name || "Route",
    start: r.start || r.from || r.origin,
    end: r.end || r.to || r.destination,
    to_count: r.to_count ?? r.toTrips,
    fro_count: r.fro_count ?? r.froTrips,
  }));
}

function buildUniqueStops(raw: any[]): UniqueStop[] {
  const map = new Map<
    string,
    { name: string; lat: number; lon: number; routes: Set<string> }
  >();

  raw.forEach((s: any) => {
    const stopName = (s.stop_name || "").trim();
    if (!stopName) return;

    const lat = s.lat;
    const lon = s.lon;
    if (
      typeof lat !== "number" ||
      typeof lon !== "number" ||
      isNaN(lat) ||
      isNaN(lon)
    )
      return;

    const key = stopName.toLowerCase();
    const routeLabel = s.route_name || s.route_id || "Route";

    if (!map.has(key)) {
      map.set(key, {
        name: stopName,
        lat,
        lon,
        routes: new Set([String(routeLabel)]),
      });
    } else {
      const entry = map.get(key)!;
      entry.routes.add(String(routeLabel));
      // we keep the first lat/lon as canonical
    }
  });

  return Array.from(map.values()).map((v, idx) => ({
    id: `${v.name}_${idx}`,
    name: v.name,
    lat: v.lat,
    lon: v.lon,
    routes: Array.from(v.routes),
  }));
}

export default function RouteSelectorTab() {
  const navigation = useNavigation<any>();

  // All lines
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [routesLoading, setRoutesLoading] = useState(true);
  const [routesError, setRoutesError] = useState<string | null>(null);

  // Stops for search
  const [stops, setStops] = useState<UniqueStop[]>([]);
  const [stopsLoading, setStopsLoading] = useState(false);
  const [stopsError, setStopsError] = useState<string | null>(null);

  // Planner search UX
  const [fromQuery, setFromQuery] = useState("");
  const [toQuery, setToQuery] = useState("");
  const [fromStop, setFromStop] = useState<UniqueStop | null>(null);
  const [toStop, setToStop] = useState<UniqueStop | null>(null);

  const [planResult, setPlanResult] = useState<PlannerResult | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  // Load routes
  useEffect(() => {
    (async () => {
      try {
        setRoutesLoading(true);
        setRoutesError(null);
        const list = await client.getRoutes();
        console.log("📡 Routes fetched:", JSON.stringify(list));
        setRoutes(normalizeRoutes(Array.isArray(list) ? list : []));
      } catch (err: any) {
        console.warn("Routes load error:", err);
        setRoutesError(
          err?.response?.data?.error || "Failed to load routes."
        );
      } finally {
        setRoutesLoading(false);
      }
    })();
  }, []);

  // Load stops for search
  useEffect(() => {
    (async () => {
      try {
        setStopsLoading(true);
        setStopsError(null);
        const { data } = await http.get("/routes/stops/all");
        if (Array.isArray(data)) {
          const uniq = buildUniqueStops(data as RawStop[]);
          setStops(uniq);
        } else {
          setStops([]);
          setStopsError("Unexpected stops response from server.");
        }
      } catch (err: any) {
        console.warn("Stops load error:", err);
        setStopsError(
          err?.response?.data?.error || "Failed to load stops."
        );
      } finally {
        setStopsLoading(false);
      }
    })();
  }, []);

  const filterStops = (query: string): UniqueStop[] => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return stops
      .filter((s) => {
        const name = s.name.toLowerCase();
        const routesLabel = s.routes.join(" ").toLowerCase();
        return name.includes(q) || routesLabel.includes(q);
      })
      .slice(0, 8);
  };

  const fromSuggestions = filterStops(fromQuery);
  const toSuggestions = filterStops(toQuery);

  const selectFromStop = (stop: UniqueStop) => {
    setFromStop(stop);
    setFromQuery(
      stop.routes.length
        ? `${stop.name} (${stop.routes.join(", ")})`
        : stop.name
    );
    setPlanResult(null);
    setPlanError(null);
  };

  const selectToStop = (stop: UniqueStop) => {
    setToStop(stop);
    setToQuery(
      stop.routes.length
        ? `${stop.name} (${stop.routes.join(", ")})`
        : stop.name
    );
    setPlanResult(null);
    setPlanError(null);
  };

  const planRoute = async () => {
    if (!fromStop || !toStop) {
      setPlanError("Please select both origin and destination.");
      return;
    }

    try {
      setPlanLoading(true);
      setPlanError(null);

      const { lat: fromLat, lon: fromLon } = fromStop;
      const { lat: toLat, lon: toLon } = toStop;

      const { data } = await http.get(
        `/planner/plan?fromLat=${fromLat}&fromLon=${fromLon}&toLat=${toLat}&toLon=${toLon}`
      );

      setPlanResult(data || null);
    } catch (err: any) {
      console.warn("Planner error:", err);
      setPlanError(
        err?.response?.data?.error ||
          "Unable to find a trip for these locations."
      );
      setPlanResult(null);
    } finally {
      setPlanLoading(false);
    }
  };

  // Extract recommended lines from itinerary
  const recommendedLineNames = useMemo(() => {
    const set = new Set<string>();
    if (planResult?.steps) {
      planResult.steps.forEach((s) => {
        if (s.type === "ride" && s.route_name) {
          set.add(String(s.route_name));
        }
      });
    }
    return set;
  }, [planResult]);

  const handleRoutePress = (r: RouteItem) => {
    const color =
      ROUTE_COLORS[r.route_name] || "#2563eb";

    navigation.navigate("RouteDetail", {
      routeData: {
        id: r.id,
        route_id: r.route_id,
        name: r.route_name,
        start: r.start,
        end: r.end,
      },
      color,
    });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 24 }}
    >
      {/* Planner search area */}
      <View style={styles.searchCard}>
        <Text style={styles.searchTitle}>
          🧭 Plan your campus trip
        </Text>
        <Text style={styles.searchSubtitle}>
          Search using stop or landmark names. We’ll show an itinerary and
          highlight the lines that work best.
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
            placeholder="e.g. Main Gate, New Hostel Complex…"
          />
          {fromSuggestions.length > 0 && (
            <View style={styles.suggestionsBox}>
              {fromSuggestions.map((s, idx) => (
                <TouchableOpacity
                  key={`${s.id}_from_${idx}`}
                  style={styles.suggestionItem}
                  onPress={() => selectFromStop(s)}
                >
                  <Text style={styles.suggestionTitle}>
                    {s.name}
                  </Text>
                  {!!s.routes.length && (
                    <Text style={styles.suggestionMeta}>
                      Lines: {s.routes.join(", ")}
                    </Text>
                  )}
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
            placeholder="e.g. Biological Sciences Building…"
          />
          {toSuggestions.length > 0 && (
            <View style={styles.suggestionsBox}>
              {toSuggestions.map((s, idx) => (
                <TouchableOpacity
                  key={`${s.id}_to_${idx}`}
                  style={styles.suggestionItem}
                  onPress={() => selectToStop(s)}
                >
                  <Text style={styles.suggestionTitle}>
                    {s.name}
                  </Text>
                  {!!s.routes.length && (
                    <Text style={styles.suggestionMeta}>
                      Lines: {s.routes.join(", ")}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.planButton}
          onPress={planRoute}
          disabled={planLoading}
        >
          <Text style={styles.planButtonText}>
            {planLoading ? "Planning…" : "Show itinerary"}
          </Text>
        </TouchableOpacity>

        {stopsLoading && (
          <Text style={styles.mutedText}>
            Loading stops for search…
          </Text>
        )}
        {stopsError && (
          <Text style={styles.errorText}>{stopsError}</Text>
        )}
        {planError && (
          <Text style={styles.errorText}>{planError}</Text>
        )}

        {/* Itinerary summary */}
        {planResult && (
          <View style={styles.itineraryCard}>
            <Text style={styles.itineraryTitle}>Itinerary</Text>
            {planResult.steps.map((s, idx) => {
              if (s.type === "walk")
                return (
                  <Text key={idx} style={styles.itineraryLine}>
                    🚶 Walk {Math.round(s.distance || 0)} m →{" "}
                    {s.to?.stop_name || "destination"}
                  </Text>
                );
              if (s.type === "ride")
                return (
                  <Text key={idx} style={styles.itineraryLine}>
                    🚌 Take {s.route_name} Line from{" "}
                    {s.from?.stop_name} → {s.to?.stop_name}
                  </Text>
                );
              if (s.type === "transfer")
                return (
                  <Text key={idx} style={styles.itineraryLine}>
                    🔁 Transfer between{" "}
                    {s.between?.[0]?.stop_name} ↔{" "}
                    {s.between?.[1]?.stop_name}
                  </Text>
                );
              return null;
            })}

            {recommendedLineNames.size > 0 && (
              <Text style={styles.itineraryHint}>
                Suggested lines for this trip:{" "}
                {Array.from(recommendedLineNames).join(", ")}.
                Tap one of these lines below to view live buses and
                reserve your seat.
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Route list area */}
      <View style={styles.routesHeaderRow}>
        <Text style={styles.routesTitle}>All Lines</Text>
        {routesLoading && (
          <ActivityIndicator color="#2563eb" size="small" />
        )}
      </View>
      {routesError && (
        <Text style={[styles.errorText, { marginHorizontal: 12 }]}>
          {routesError}
        </Text>
      )}

      {!routesLoading && !routes.length && !routesError && (
        <Text style={[styles.mutedText, { marginHorizontal: 12 }]}>
          No routes configured yet.
        </Text>
      )}

      <FlatList
        data={routes}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 4 }}
        renderItem={({ item }) => {
          const isRecommended = recommendedLineNames.has(
            item.route_name
          );
          const color =
            ROUTE_COLORS[item.route_name] || "#2563eb";

          return (
            <TouchableOpacity
              style={[
                styles.routeCard,
                { borderLeftColor: color },
              ]}
              onPress={() => handleRoutePress(item)}
            >
              <View style={styles.routeCardMainRow}>
                <Text style={[styles.routeName, { color }]}>
                  {item.route_name} Line
                </Text>
                {isRecommended && (
                  <View style={styles.routeChip}>
                    <Text style={styles.routeChipText}>
                      Recommended
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.routeMeta}>
                {item.start || "Start"} → {item.end || "End"}
              </Text>
              <Text style={styles.routeMeta}>
                To trips: {item.to_count ?? "—"} · Fro trips:{" "}
                {item.fro_count ?? "—"}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },

  searchCard: {
    backgroundColor: "#fff",
    margin: 12,
    marginBottom: 6,
    padding: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  searchTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 2,
  },
  searchSubtitle: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 8,
  },
  inputWrapper: {
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    color: "#4b5563",
    marginBottom: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: "#f9fafb",
  },
  suggestionsBox: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    backgroundColor: "#fff",
    maxHeight: 180,
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
  planButton: {
    marginTop: 2,
    backgroundColor: "#2563eb",
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: "center",
  },
  planButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  mutedText: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
    textAlign: "center",
  },
  errorText: {
    fontSize: 12,
    color: "#b91c1c",
    marginTop: 4,
  },
  itineraryCard: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  itineraryTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  itineraryLine: {
    fontSize: 13,
    marginBottom: 2,
  },
  itineraryHint: {
    fontSize: 12,
    color: "#4b5563",
    marginTop: 6,
  },

  routesHeaderRow: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  routesTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  routeCard: {
    backgroundColor: "#fff",
    marginBottom: 8,
    borderRadius: 12,
    padding: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#2563eb",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
  },
  routeCardMainRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  routeName: {
    fontSize: 16,
    fontWeight: "700",
  },
  routeMeta: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  routeChip: {
    backgroundColor: "#ecfdf3",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  routeChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#15803d",
  },
});