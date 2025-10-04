// backend/src/routes/vehicle.js
import { Router } from "express";

export default function vehicleRoutes(db) {
  const router = Router();

  // list all vehicles (admin protected)
  router.get("/", async (req, res) => {
    try {
      const snap = await db.collection("vehicles").get();
      const vehicles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      res.json(vehicles);
    } catch (err) {
      console.error("Vehicle list error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // get vehicle by id
  router.get("/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const doc = await db.collection("vehicles").doc(id).get();
      if (!doc.exists) return res.status(404).json({ error: "Vehicle not found" });
      res.json({ id: doc.id, ...doc.data() });
    } catch (err) {
      console.error("Vehicle get error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // register a new vehicle (admin only)
  router.post("/", async (req, res) => {
    try {
      const { vehicle_id, capacity = 4, plateNo } = req.body;
      const newDoc = await db.collection("vehicles").add({
        vehicle_id,
        plateNo: plateNo || vehicle_id,
        capacity,
        occupancy: 0,
        status: "idle",
        createdAt: new Date().toISOString(),
      });
      res.json({ id: newDoc.id });
    } catch (err) {
      console.error("Vehicle create error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // update vehicle
  router.put("/:id", async (req, res) => {
    try {
      const id = req.params.id;
      await db.collection("vehicles").doc(id).set(req.body, { merge: true });
      res.json({ ok: true });
    } catch (err) {
      console.error("Vehicle update error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // delete vehicle
  router.delete("/:id", async (req, res) => {
    try {
      await db.collection("vehicles").doc(req.params.id).delete();
      res.json({ ok: true });
    } catch (err) {
      console.error("Vehicle delete error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
