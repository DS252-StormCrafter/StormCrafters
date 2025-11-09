// backend/src/routes/driver.js
import { Router } from "express";
import admin from "firebase-admin";
import { authenticate } from "../middleware/auth.js";

const BOARDING_RADIUS_METERS = 10;          // ✅ 10m radius
const DEMAND_TTL_MS = 8 * 60 * 1000;

export default function driverRoutes(db, wss) {
  const router = Router();

  // ---------------- helpers ----------------

  const getWss = () => wss || globalThis.__transvahan_wss__ || null;

  const haversine = (lat1, lon1, lat2, lon2) => {
    const toRad = (d) => (d * Math.PI) / 180;
    const R = 6371000;
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const dφ = toRad(lat2 - lat1);
    const dλ = toRad(lon2 - lon1);
    const a =
      Math.sin(dφ / 2) ** 2 +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const broadcastWS = (type, data, audience = "all") => {
    const server = getWss();
    if (!server?.clients) return;
    const payload = JSON.stringify({ type, data, audience });
    server.clients.forEach((c) => {
      if (c.readyState === c.OPEN) c.send(payload);
    });
  };

  const shapeVehicle = (id, v) => {
    const now = Date.now();
    const active =
      !!v.demand_high &&
      v.demand_ts &&
      now - Number(v.demand_ts) < DEMAND_TTL_MS;
    return {
      id,
      vehicle_id: v.plateNo ?? v.vehicle_id ?? id,
      route_id: v.currentRoute ?? v.route_id ?? "unknown",
      direction: v.direction ?? "to",
      lat: v.location?.lat ?? v.location?.latitude ?? 0,
      lng: v.location?.lng ?? v.location?.longitude ?? 0,
      occupancy: v.occupancy ?? 0,
      capacity: v.capacity ?? 4,
      vacant: (v.capacity ?? 4) - (v.occupancy ?? 0),
      status: v.status ?? "idle",
      updated_at: new Date().toISOString(),
      demand_high: active,
    };
  };

  // ---------------- reservation summary + reconciliation ----------------

  async function computeSummary(routeId, direction) {
    const snap = await db
      .collection("reservations")
      .where("route_id", "==", routeId)
      .where("direction", "==", direction)
      .where("status", "==", "waiting")
      .get();
    const bySeq = {};
    snap.forEach((d) => {
      const r = d.data();
      const seq = Number(r.source_sequence ?? r.source_seq);
      if (Number.isFinite(seq)) bySeq[seq] = (bySeq[seq] || 0) + 1;
    });
    return Object.entries(bySeq).map(([s, c]) => ({
      sequence: Number(s),
      waiting_count: Number(c),
    }));
  }

  async function reconcileReservations(vehicleId, delta) {
    // we only reconcile when driver explicitly increases occupancy
    if (delta <= 0) return;

    const vSnap = await db.collection("vehicles").doc(vehicleId).get();
    if (!vSnap.exists) return;
    const v = vSnap.data();

    const routeId = v.currentRoute || v.route_id;
    const direction = (v.direction || "to").toLowerCase();
    if (!routeId || !["to", "fro"].includes(direction)) return;

    const curLat = v.location?.lat ?? v.location?.latitude;
    const curLon = v.location?.lng ?? v.location?.longitude;
    if (typeof curLat !== "number" || typeof curLon !== "number") return;

    const routeDoc = await db.collection("routes").doc(routeId).get();
    if (!routeDoc.exists) return;
    const dirStops = routeDoc.data()?.directions?.[direction] || [];
    const stops = dirStops
      .map((s, i) => ({
        sequence: Number(s.sequence ?? i),
        stop_id: s.stop_id ?? s.id ?? `${routeId}_${i}`,
        stop_name: s.stop_name ?? s.name ?? `Stop ${i + 1}`,
        lat: s.location?.latitude ?? s.lat,
        lon: s.location?.longitude ?? s.lon,
      }))
      .filter(
        (s) =>
          typeof s.lat === "number" &&
          typeof s.lon === "number" &&
          !isNaN(s.lat) &&
          !isNaN(s.lon)
      );

    if (!stops.length) return;

    // find nearest stop
    let nearest = stops[0],
      minD = Infinity;
    for (const s of stops) {
      const d = haversine(curLat, curLon, s.lat, s.lon);
      if (d < minD) {
        minD = d;
        nearest = s;
      }
    }
    if (minD > BOARDING_RADIUS_METERS) return; // not close enough to board

    // mark "waiting" → "boarded" for that stop, up to `delta`
    const now = new Date().toISOString();
    let consumed = 0;
    for (let i = 0; i < delta; i++) {
      const rSnap = await db
        .collection("reservations")
        .where("route_id", "==", routeId)
        .where("direction", "==", direction)
        .where("status", "==", "waiting")
        .where("source_sequence", "==", nearest.sequence)
        .orderBy("created_at")
        .limit(1)
        .get();
      if (rSnap.empty) break;
      await rSnap.docs[0].ref.set(
        {
          status: "boarded",
          boarded_at: now,
          boarded_vehicle_id: vehicleId,
          updated_at: now,
        },
        { merge: true }
      );
      consumed++;
    }

    if (!consumed) return;

    // recompute stop summary and broadcast
    const stopsSummary = await computeSummary(routeId, direction);
    broadcastWS("reservation_update", {
      route_id: routeId,
      direction,
      stops: stopsSummary,
    });

    // heat signal: onboard + waiting at that stop >= 4
    const onboard = Number(v.occupancy ?? 0);
    const waitingAtStop =
      stopsSummary.find((s) => s.sequence === nearest.sequence)
        ?.waiting_count ?? 0;

    if (onboard + waitingAtStop >= 4) {
      broadcastWS(
        "heat_update",
        {
          route_id: routeId,
          direction,
          stop_sequence: nearest.sequence,
          stop_id: nearest.stop_id,
          stop_name: nearest.stop_name,
          lat: nearest.lat,
          lon: nearest.lon,
          onboard,
          waiting: waitingAtStop,
          total: onboard + waitingAtStop,
          ts: now,
        },
        "admins"
      );
    }
  }

  // ---------------- telemetry (FAST, location-only) ----------------
  router.post("/telemetry", authenticate, async (req, res) => {
    try {
      const { vehicleId, lat, lng, status, route_id, direction } = req.body;
      if (!vehicleId) return res.status(400).json({ error: "vehicleId required" });

      const doc = db.collection("vehicles").doc(String(vehicleId));

      const payload = {
        location: {
          lat,
          lng,
          timestamp: Date.now(),
        },
        updatedAt: new Date().toISOString(),
      };

      // 🚫 DO NOT TOUCH occupancy HERE – only /driver/occupancy can change it
      if (status) payload.status = status; // "active" / "idle"
      if (route_id) payload.currentRoute = route_id;
      if (direction) payload.direction = direction.toLowerCase();

      await doc.set(payload, { merge: true });

      const snap = await doc.get();
      const shaped = shapeVehicle(snap.id, snap.data());

      // 🔴 Broadcast immediately over WS (Uber-style)
      broadcastWS("vehicle", shaped);

      res.json({ ok: true });
    } catch (e) {
      console.error("telemetry err", e);
      res.status(500).json({ error: "telemetry failed" });
    }
  });

  // ---------------- occupancy (+1 / -1) ----------------
  router.post("/occupancy", authenticate, async (req, res) => {
    try {
      const { vehicleId, delta } = req.body;
      const d = Number(delta);
      if (!vehicleId || !d)
        return res.status(400).json({ error: "vehicleId and delta required" });

      const doc = db.collection("vehicles").doc(String(vehicleId));
      const snap = await doc.get();
      if (!snap.exists) return res.status(404).json({ error: "Vehicle not found" });
      const v = snap.data();

      const cap = Number(v.capacity ?? 4);
      const occ = Number(v.occupancy ?? 0);
      const next = Math.max(0, Math.min(cap, occ + d));

      await doc.set(
        {
          occupancy: next,
          status: next > 0 ? "active" : "idle",
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // 🔁 Now reconcile reservations ONLY when driver explicitly adds a passenger
      if (d > 0) await reconcileReservations(vehicleId, d);

      const updated = (await doc.get()).data();
      broadcastWS("vehicle", shapeVehicle(vehicleId, updated));
      res.json({ ok: true, occupancy: next });
    } catch (e) {
      console.error("occupancy err", e);
      res.status(500).json({ error: "occupancy failed" });
    }
  });

  // ---------------- trip start / stop ----------------
  router.post("/trip", authenticate, async (req, res) => {
    try {
      const { vehicleId, action, route_id } = req.body;
      if (!vehicleId)
        return res.status(400).json({ error: "vehicleId required" });
      const act = (action || "").toLowerCase();
      if (!["start", "stop"].includes(act))
        return res.status(400).json({ error: "invalid action" });

      const doc = db.collection("vehicles").doc(String(vehicleId));
      const payload = {
        status: act === "start" ? "active" : "idle",
        updatedAt: new Date().toISOString(),
      };
      if (act === "start" && route_id) payload.currentRoute = route_id;

      await doc.set(payload, { merge: true });
      const shaped = shapeVehicle(vehicleId, (await doc.get()).data());
      broadcastWS("vehicle", shaped);
      res.json({ ok: true });
    } catch (e) {
      console.error("trip err", e);
      res.status(500).json({ error: "trip failed" });
    }
  });

  // ---------------- demand (heat button) ----------------
  router.post("/demand", authenticate, async (req, res) => {
    try {
      const { vehicle_id, route_id, direction = "to", lat, lon, high = true } =
        req.body;
      if (!vehicle_id || !route_id)
        return res.status(400).json({ error: "vehicle_id & route_id required" });
      if (typeof lat !== "number" || typeof lon !== "number")
        return res.status(400).json({ error: "lat/lon required" });

      const ts = Date.now();
      const vRef = db.collection("vehicles").doc(String(vehicle_id));
      await vRef.set(
        {
          currentRoute: route_id,
          direction,
          demand_high: !!high,
          demand_ts: ts,
          location: { lat, lng: lon, timestamp: ts },
          updatedAt: new Date(ts).toISOString(),
        },
        { merge: true }
      );

      await db.collection("demand_signals").add({
        route_id,
        vehicle_id,
        direction,
        lat,
        lon,
        high,
        ts,
        expires_at: ts + 10 * 60 * 1000,
      });

      const v = (await vRef.get()).data();
      broadcastWS("demand_update", { route_id, vehicle_id, lat, lon, high });
      broadcastWS("vehicle", shapeVehicle(vehicle_id, v));
      res.json({ ok: true });
    } catch (e) {
      console.error("demand err", e);
      res.status(500).json({ error: "demand failed" });
    }
  });

  // ---------------- driver assignment ----------------
  router.get("/assignment", authenticate, async (req, res) => {
    try {
      const email =
        req.user?.email ||
        req.user?.uid ||
        req.user?.id ||
        req.user?.user_id;
      if (!email) return res.status(400).json({ error: "no identity" });

      const snap = await db
        .collection("assignments")
        .where("driver_email", "==", email)
        .where("active", "==", true)
        .limit(1)
        .get();
      if (snap.empty) return res.status(404).json({ error: "no active assignment" });
      const doc = snap.docs[0];
      res.json({ assignment: { id: doc.id, ...doc.data() } });
    } catch (e) {
      console.error("assign err", e);
      res.status(500).json({ error: "assignment failed" });
    }
  });

  return router;
}
