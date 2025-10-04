// backend/src/routes/driver.js
import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

export default function driverRoutes(db) {
  const router = Router();

  // driver login (admin-created drivers stored in `drivers` collection)
  router.post("/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const snap = await db.collection("drivers").where("email", "==", email).limit(1).get();
      if (snap.empty) return res.status(401).json({ error: "Driver not found" });

      const d = snap.docs[0];
      const driver = d.data();
      const match = await bcrypt.compare(password, driver.password);
      if (!match) return res.status(401).json({ error: "Invalid credentials" });

      const token = jwt.sign({ id: d.id, email: driver.email, role: "driver" }, process.env.JWT_SECRET || "secret", { expiresIn: "7d" });

      await d.ref.update({ lastLoginAt: new Date().toISOString() });

      res.json({ token, driver: { id: d.id, name: driver.name, email: driver.email } });
    } catch (err) {
      console.error("Driver login error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // driver posts GPS / telemetry
  router.post("/telemetry", async (req, res) => {
    // expected: { vehicleId, lat, lng, occupancy, status, route_id }
    try {
      const { vehicleId, lat, lng, occupancy, status, route_id } = req.body;
      if (!vehicleId) return res.status(400).json({ error: "vehicleId required" });

      const vRef = db.collection("vehicles").doc(vehicleId);
      await vRef.set({
        location: { lat, lng, timestamp: Date.now() },
        occupancy: typeof occupancy === "number" ? occupancy : undefined,
        status: status || "active",
        currentRoute: route_id || null,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      // keep a light activity log for analytics
      await db.collection("driver_activity").add({
        vehicleId,
        lat,
        lng,
        occupancy,
        status,
        route_id,
        createdAt: new Date().toISOString(),
      });

      res.json({ ok: true });
    } catch (err) {
      console.error("Telemetry error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // driver updates seat (increment / decrement)
  router.post("/occupancy", async (req, res) => {
    try {
      const { vehicleId, delta } = req.body; // delta = +1 or -1
      if (!vehicleId || typeof delta !== "number") return res.status(400).json({ error: "vehicleId & delta required" });

      const vRef = db.collection("vehicles").doc(vehicleId);
      await db.runTransaction(async (tx) => {
        const doc = await tx.get(vRef);
        const current = doc.exists ? (doc.data().occupancy || 0) : 0;
        const cap = doc.exists ? (doc.data().capacity || 4) : 4;
        let next = current + delta;
        if (next < 0) next = 0;
        if (next > cap) next = cap;
        tx.set(vRef, { occupancy: next, updatedAt: new Date().toISOString() }, { merge: true });
      });

      // activity log
      await db.collection("driver_activity").add({
        vehicleId, delta, createdAt: new Date().toISOString(), type: "occupancy_change"
      });

      res.json({ ok: true });
    } catch (err) {
      console.error("Occupancy error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // route selection & trip controls (start/stop)
  router.post("/trip", async (req, res) => {
    try {
      const { vehicleId, action, route_id } = req.body; // action: 'start'|'stop'
      if (!vehicleId || !action) return res.status(400).json({ error: "vehicleId & action required" });

      if (action === "start") {
        await db.collection("vehicles").doc(vehicleId).set({ currentRoute: route_id || null, status: "running", tripStartedAt: new Date().toISOString() }, { merge: true });
      } else {
        await db.collection("vehicles").doc(vehicleId).set({ status: "idle", currentRoute: null, tripEndedAt: new Date().toISOString() }, { merge: true });
      }

      await db.collection("driver_activity").add({ vehicleId, action, route_id, createdAt: new Date().toISOString() });

      res.json({ ok: true });
    } catch (err) {
      console.error("Trip control error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
