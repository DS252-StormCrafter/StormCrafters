// backend/src/routes/driver.js
import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { authenticate } from "../middleware/auth.js";

export default function driverRoutes(db) {
  const router = Router();

  // ============================================================
  // ✅ DRIVER LOGIN (Public)
  // ============================================================
  router.post("/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      const snap = await db.collection("drivers").where("email", "==", email).limit(1).get();
      if (snap.empty) return res.status(401).json({ error: "Driver not found" });

      const d = snap.docs[0];
      const driver = d.data();

      const match = await bcrypt.compare(password, driver.password);
      if (!match) return res.status(401).json({ error: "Invalid credentials" });

      // ✅ FIX: Assign proper driver role in JWT
      const token = jwt.sign(
        { id: d.id, email: driver.email, role: "driver" },
        process.env.JWT_SECRET || "secret",
        { expiresIn: "7d" }
      );

      // ✅ Update last login
      await d.ref.update({ lastLoginAt: new Date().toISOString() });

      // ✅ Fetch assigned vehicles
      const vehicleSnap = await db.collection("vehicles").where("assignedTo", "==", driver.email).get();
      const assignedVehicles = vehicleSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      res.json({
        token,
        driver: {
          id: d.id,
          name: driver.name,
          email: driver.email,
          role: "driver", // ✅ ensure returned role matches JWT
        },
        assignedVehicles,
      });
    } catch (err) {
      console.error("Driver login error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ============================================================
  // ✅ TELEMETRY UPDATE (Protected)
  // ============================================================
  router.post("/telemetry", authenticate, async (req, res) => {
    try {
      const { vehicleId, lat, lng, occupancy, status, route_id } = req.body;
      const driverEmail = req.user?.email;

      if (!driverEmail) return res.status(401).json({ error: "Invalid driver token" });
      if (!vehicleId || !lat || !lng)
        return res.status(400).json({ error: "vehicleId, lat, lng required" });

      const vRef = db.collection("vehicles").doc(vehicleId);
      await vRef.set(
        {
          driverEmail,
          location: { lat, lng, timestamp: Date.now() },
          occupancy: typeof occupancy === "number" ? occupancy : undefined,
          status: status || "active",
          currentRoute: route_id || null,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      await db.collection("driver_activity").add({
        driverEmail,
        vehicleId,
        lat,
        lng,
        occupancy,
        status,
        route_id,
        type: "telemetry",
        createdAt: new Date().toISOString(),
      });

      res.json({ ok: true });
    } catch (err) {
      console.error("Telemetry error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ============================================================
  // ✅ OCCUPANCY UPDATE (Protected)
  // ============================================================
  router.post("/occupancy", authenticate, async (req, res) => {
    try {
      const { vehicleId, delta } = req.body;
      const driverEmail = req.user?.email;

      if (!driverEmail) return res.status(401).json({ error: "Invalid driver token" });
      if (!vehicleId || typeof delta !== "number")
        return res.status(400).json({ error: "vehicleId & delta required" });

      const vRef = db.collection("vehicles").doc(vehicleId);
      await db.runTransaction(async (tx) => {
        const doc = await tx.get(vRef);
        const current = doc.exists ? doc.data().occupancy || 0 : 0;
        const cap = doc.exists ? doc.data().capacity || 4 : 4;
        const next = Math.min(Math.max(current + delta, 0), cap);
        tx.set(vRef, { occupancy: next, updatedAt: new Date().toISOString() }, { merge: true });
      });

      await db.collection("driver_activity").add({
        driverEmail,
        vehicleId,
        delta,
        type: "occupancy_change",
        createdAt: new Date().toISOString(),
      });

      res.json({ ok: true });
    } catch (err) {
      console.error("Occupancy error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ============================================================
  // ✅ TRIP START/STOP (Protected)
  // ============================================================
  router.post("/trip", authenticate, async (req, res) => {
    try {
      const { vehicleId, action, route_id } = req.body;
      const driverEmail = req.user?.email;

      if (!driverEmail) return res.status(401).json({ error: "Invalid driver token" });
      if (!vehicleId || !action)
        return res.status(400).json({ error: "vehicleId & action required" });

      if (action === "start") {
        await db.collection("vehicles").doc(vehicleId).set(
          {
            driverEmail,
            currentRoute: route_id || null,
            status: "running",
            tripStartedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } else {
        await db.collection("vehicles").doc(vehicleId).set(
          {
            driverEmail,
            status: "idle",
            currentRoute: null,
            tripEndedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }

      await db.collection("driver_activity").add({
        driverEmail,
        vehicleId,
        action,
        route_id,
        createdAt: new Date().toISOString(),
        type: "trip_control",
      });

      res.json({ ok: true });
    } catch (err) {
      console.error("Trip control error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
