// backend/src/routes/driver.js
import { Router } from "express";
import { authenticate } from "../middleware/auth.js";

// ------------------------- small geo helper -------------------------
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // meters
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ------------------------- WS broadcast helper -------------------------
function broadcastWS(wss, type, data) {
  try {
    if (!wss || !wss.clients) return;
    const payload = JSON.stringify({ type, data });
    wss.clients.forEach((ws) => {
      try {
        if (ws.readyState === ws.OPEN) ws.send(payload);
      } catch {
        /* ignore */
      }
    });
  } catch {
    /* ignore */
  }
}

// ------------------------- direction inference -------------------------
async function inferDirectionFromStart(db, routeId, lat, lng, radiusMeters = 100) {
  try {
    if (!routeId || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const routeDoc = await db.collection("routes").doc(String(routeId)).get();
    if (!routeDoc.exists) return null;

    const d = routeDoc.data() || {};
    const toStops = Array.isArray(d.directions?.to) ? d.directions.to.slice() : [];
    const froStops = Array.isArray(d.directions?.fro) ? d.directions.fro.slice() : [];

    const sortBySeq = (arr) =>
      arr
        .map((s, i) => ({
          ...s,
          sequence: Number.isFinite(s.sequence) ? Number(s.sequence) : i,
        }))
        .sort((a, b) => a.sequence - b.sequence);

    const toSorted = sortBySeq(toStops);
    const froSorted = sortBySeq(froStops);

    const toFirst = toSorted[0];
    const froFirst = froSorted[0];

    const toLat = Number(toFirst?.location?.latitude);
    const toLng = Number(toFirst?.location?.longitude);
    const froLat = Number(froFirst?.location?.latitude);
    const froLng = Number(froFirst?.location?.longitude);

    if (!Number.isFinite(toLat) || !Number.isFinite(toLng) ||
        !Number.isFinite(froLat) || !Number.isFinite(froLng)) {
      return null;
    }

    const dTo = haversineMeters(lat, lng, toLat, toLng);
    const dFro = haversineMeters(lat, lng, froLat, froLng);

    const nearTo = dTo <= radiusMeters;
    const nearFro = dFro <= radiusMeters;

    if (nearTo && nearFro) {
      return dTo <= dFro ? "to" : "fro"; // choose nearer if both near
    }
    if (nearTo) return "to";
    if (nearFro) return "fro";

    return null; // not near either terminus
  } catch (err) {
    console.error("inferDirectionFromStart error:", err?.message || err);
    return null;
  }
}

// ------------------------- routes -------------------------
export default function driverRoutes(db, wss) {
  const router = Router();

  /**
   * POST /driver/telemetry
   * body: { vehicleId, lat, lng, occupancy?, status?, route_id?, direction? }
   */
  router.post("/telemetry", authenticate, async (req, res) => {
    try {
      const {
        vehicleId,
        lat,
        lng,
        occupancy,
        status,
        route_id,
        direction,
      } = req.body || {};

      if (!vehicleId || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
        return res.status(400).json({ error: "vehicleId, lat, lng required" });
      }

      const vRef = db.collection("vehicles").doc(String(vehicleId));
      const vSnap = await vRef.get();
      const vPrev = vSnap.exists ? (vSnap.data() || {}) : {};

      const payload = {
        location: {
          lat: Number(lat),
          lng: Number(lng),
          timestamp: Date.now(),
        },
        updatedAt: new Date().toISOString(),
      };

      if (typeof occupancy === "number") payload.occupancy = occupancy;
      if (status) payload.status = String(status);
      if (route_id) payload.currentRoute = String(route_id);
      if (direction === "to" || direction === "fro") payload.direction = direction;

      await vRef.set(payload, { merge: true });

      const merged = { id: vehicleId, ...vPrev, ...payload };

      // Push immediate update; periodic "vehicle" broadcast still runs too
      broadcastWS(wss, "vehicle_update", merged);
      broadcastWS(wss, "vehicle", merged);

      res.json({ ok: true });
    } catch (err) {
      console.error("❌ /driver/telemetry error:", err);
      res.status(500).json({ error: "Failed to store telemetry" });
    }
  });

  /**
   * POST /driver/occupancy
   * body: { vehicleId, delta }
   */
  router.post("/occupancy", authenticate, async (req, res) => {
    try {
      const { vehicleId, delta } = req.body || {};
      if (!vehicleId || !Number.isFinite(Number(delta))) {
        return res.status(400).json({ error: "vehicleId, delta required" });
      }

      const vRef = db.collection("vehicles").doc(String(vehicleId));
      const vSnap = await vRef.get();
      if (!vSnap.exists) {
        return res.status(404).json({ error: "Vehicle not found" });
      }

      const v = vSnap.data() || {};
      const capacity = Number(v.capacity ?? 4);
      const occ0 = Number(v.occupancy ?? 0);
      const occ1 = Math.max(0, Math.min(capacity, occ0 + Number(delta)));

      await vRef.set(
        { occupancy: occ1, updatedAt: new Date().toISOString() },
        { merge: true }
      );

      const merged = { id: vehicleId, ...v, occupancy: occ1 };

      broadcastWS(wss, "vehicle_update", merged);
      broadcastWS(wss, "vehicle", merged);

      res.json({ ok: true, occupancy: occ1, capacity });
    } catch (err) {
      console.error("❌ /driver/occupancy error:", err);
      res.status(500).json({ error: "Failed to update occupancy" });
    }
  });

  /**
   * POST /driver/trip
   * body: { vehicleId, action:"start"|"stop", route_id?, lat?, lng?, direction? }
   *
   * ✅ NEW behavior:
   *   - on start: infer direction from GPS vs first stop of to/fro within 100m
   *   - if not near either, fallback to provided direction or existing vehicle.direction
   *   - updates vehicle.direction + status + currentRoute and broadcasts
   */
  router.post("/trip", authenticate, async (req, res) => {
    try {
      const {
        vehicleId,
        action,
        route_id,
        lat,
        lng,
        direction: dirProvided,
      } = req.body || {};

      if (!vehicleId || !action) {
        return res.status(400).json({ error: "vehicleId and action required" });
      }

      const vRef = db.collection("vehicles").doc(String(vehicleId));
      const vSnap = await vRef.get();
      const vPrev = vSnap.exists ? (vSnap.data() || {}) : {};

      if (String(action).toLowerCase() === "start") {
        const latNum = Number(lat);
        const lngNum = Number(lng);
        const routeId = route_id || vPrev.currentRoute;

        let inferred = null;
        if (Number.isFinite(latNum) && Number.isFinite(lngNum) && routeId) {
          inferred = await inferDirectionFromStart(db, routeId, latNum, lngNum, 100);
        }

        const dirFinal =
          (dirProvided === "to" || dirProvided === "fro")
            ? dirProvided
            : inferred
              ? inferred
              : (vPrev.direction === "fro" ? "fro" : "to");

        const payload = {
          status: "active",
          currentRoute: routeId ? String(routeId) : (vPrev.currentRoute || null),
          direction: dirFinal,
          updatedAt: new Date().toISOString(),
        };

        if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
          payload.location = {
            lat: latNum,
            lng: lngNum,
            timestamp: Date.now(),
          };
        }

        await vRef.set(payload, { merge: true });

        const merged = { id: vehicleId, ...vPrev, ...payload };

        broadcastWS(wss, "vehicle_update", merged);
        broadcastWS(wss, "vehicle", merged);

        return res.json({ ok: true, action: "start", direction: dirFinal });
      }

      if (String(action).toLowerCase() === "stop") {
        const payload = {
          status: "idle",
          updatedAt: new Date().toISOString(),
        };
        await vRef.set(payload, { merge: true });

        const merged = { id: vehicleId, ...vPrev, ...payload };

        broadcastWS(wss, "vehicle_update", merged);
        broadcastWS(wss, "vehicle", merged);

        return res.json({ ok: true, action: "stop" });
      }

      return res.status(400).json({ error: "action must be start or stop" });
    } catch (err) {
      console.error("❌ /driver/trip error:", err);
      res.status(500).json({ error: "Failed to control trip" });
    }
  });

  /**
   * POST /driver/demand
   * body: { vehicle_id, route_id, direction, lat, lon, high }
   * (kept as alias so existing apiClient.sendDemand keeps working)
   */
  router.post("/demand", authenticate, async (req, res) => {
    try {
      const {
        vehicle_id,
        route_id,
        direction = "to",
        lat,
        lon,
        high = true,
      } = req.body || {};

      if (!vehicle_id || !route_id || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
        return res.status(400).json({ error: "vehicle_id, route_id, lat, lon required" });
      }

      const ts = Date.now();
      const expiresAt = ts + 10 * 60 * 1000;

      await db.collection("demand_signals").add({
        vehicle_id: String(vehicle_id),
        route_id: String(route_id),
        direction: direction === "fro" ? "fro" : "to",
        lat: Number(lat),
        lon: Number(lon),
        high: !!high,
        ts,
        expires_at: expiresAt,
      });

      await db.collection("vehicles").doc(String(vehicle_id)).set(
        { demand_high: !!high, demand_ts: ts },
        { merge: true }
      );

      broadcastWS(wss, "demand_update", {
        vehicle_id: String(vehicle_id),
        route_id: String(route_id),
        direction,
        demand_high: !!high,
        ts,
      });

      res.json({ ok: true });
    } catch (err) {
      console.error("❌ /driver/demand error:", err);
      res.status(500).json({ error: "Failed to create demand signal" });
    }
  });

  return router;
}