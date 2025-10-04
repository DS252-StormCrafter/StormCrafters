import { Router } from "express";

export default function alertsRoutes(db) {
  const router = Router();

  // Create alert (driver/admin can call this)
  router.post("/", async (req, res) => {
    try {
      const { message, route_id, vehicle_id, type } = req.body;
      if (!message) return res.status(400).json({ error: "Message required" });

      const docRef = db.collection("alerts").doc();
      await docRef.set({
        message,
        route_id: route_id || null,
        vehicle_id: vehicle_id || null,
        type: type || "general",
        createdAt: new Date().toISOString(),
      });

      res.json({ message: "Alert sent" });
    } catch (err) {
      console.error("❌ Alert error:", err);
      res.status(500).json({ error: "Failed to send alert" });
    }
  });

  // Get latest alerts
  router.get("/", async (req, res) => {
    try {
      const snap = await db
        .collection("alerts")
        .orderBy("createdAt", "desc")
        .limit(10)
        .get();

      const alerts = snap.docs.map((doc) => doc.data());
      res.json(alerts);
    } catch (err) {
      console.error("❌ Alerts fetch error:", err);
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });

  return router;
}
