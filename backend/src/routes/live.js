// backend/src/routes/live.js
import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/auth.js";

export default function liveRoutes(db, wss) {
  const router = Router();

  router.get("/:routeId", async (req, res) => {
    try {
      const { routeId } = req.params;
      const snap = await db.collection("vehicles").where("currentRoute", "==", routeId).get();
      const now = Date.now();
      const TTL = 8 * 60 * 1000;

      const vehicles = snap.docs.map(doc => {
        const v = doc.data();
        const demandActive = !!v.demand_high && v.demand_ts && (now - Number(v.demand_ts)) < TTL;
        return {
          id: doc.id,
          route_id: routeId,
          plateNo: v.plateNo || doc.id,
          status: v.status || "idle",
          direction: v.direction || "to",
          location: v.location || { lat: 0, lng: 0 },
          occupancy: v.occupancy ?? 0,
          capacity: v.capacity ?? 12,
          updated_at: v.location?.timestamp || null,
          driver: v.driver_name || v.driver_id || "Unassigned",
          demand_high: demandActive, // ✅
        };
      });
      res.json(vehicles);
    } catch (err) {
      console.error("❌ Live route fetch error:", err);
      res.status(500).json({ error: "Failed to fetch live vehicles" });
    }
  });

  router.put("/:vehicleId/capacity", authenticate, requireAdmin, async (req, res) => {
    try {
      const { vehicleId } = req.params;
      const { capacity } = req.body;
      if (!Number.isFinite(capacity) || capacity <= 0)
        return res.status(400).json({ error: "capacity must be a positive number" });

      await db.collection("vehicles").doc(vehicleId).set({ capacity }, { merge: true });

      const payload = JSON.stringify({ type: "vehicle_update", data: { vehicle_id: vehicleId, capacity } });
      wss.clients.forEach(ws => { if (ws.readyState === ws.OPEN) ws.send(payload); });

      res.json({ ok: true });
    } catch (err) {
      console.error("❌ Capacity update error:", err);
      res.status(500).json({ error: "Failed to update capacity" });
    }
  });

  return router;
}
