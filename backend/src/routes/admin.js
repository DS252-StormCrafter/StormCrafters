// backend/src/routes/admin.js
import express from "express";
import bcrypt from "bcrypt";

export default function adminRoutes(db) {
  const router = express.Router();

  // create driver
  router.post("/drivers", async (req, res) => {
    try {
      const { name, email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: "email & password required" });
      const hashed = await bcrypt.hash(password, 10);
      const snap = await db.collection("drivers").where("email", "==", email).limit(1).get();
      if (!snap.empty) return res.status(400).json({ error: "Driver exists" });
      const doc = await db.collection("drivers").add({ name, email, password: hashed, createdAt: new Date().toISOString() });
      res.json({ id: doc.id, message: "Driver created" });
    } catch (err) {
      console.error("Create driver error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // list drivers
  router.get("/drivers", async (req, res) => {
    const snap = await db.collection("drivers").get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });

  // delete driver
  router.delete("/drivers/:id", async (req, res) => {
    await db.collection("drivers").doc(req.params.id).delete();
    res.json({ message: "Driver removed" });
  });

  // analytics (usage/peak times & vehicle activity)
  router.get("/analytics", async (req, res) => {
    try {
      // rough analytics example: count entries in driver_activity by type/time
      const since = new Date();
      since.setDate(since.getDate() - 7); // last 7 days
      const snap = await db.collection("driver_activity").where("createdAt", ">=", since.toISOString()).get();
      const activities = snap.docs.map(d => d.data());
      const total = activities.length;
      res.json({ peakUsage: "8-10AM", activeDrivers: 5, totalActivities: total });
    } catch (err) {
      console.error("Analytics error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // manage users (list)
  router.get("/users", async (req, res) => {
    const snap = await db.collection("users").get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });

  // create route
  router.post("/routes", async (req, res) => {
    const { name, stops = [], schedule = {} } = req.body;
    const doc = await db.collection("routes").add({ name, stops, schedule, createdAt: new Date().toISOString() });
    res.json({ id: doc.id });
  });

  return router;
}
