// backend/src/routes/alerts.js
import { Router } from "express";

export default function alertsRoutes(db, wss) {
  const router = Router();

  // ======================================================
  // 📨 Create Alert (Admin or Driver)
  // ======================================================
  router.post("/", async (req, res) => {
    try {
      const { message, route_id, vehicle_id, type, target } = req.body;

      if (!message) return res.status(400).json({ error: "Message is required" });

      const alert = {
        message,
        route_id: route_id || null,
        vehicle_id: vehicle_id || null,
        type: type || "general",
        target: target || "all", // "users" | "drivers" | "all"
        createdAt: new Date().toISOString(),
        resolved: false,
      };

      const docRef = db.collection("alerts").doc();
      await docRef.set(alert);

      // ✅ Broadcast to all WebSocket clients (User + Driver)
      if (wss) {
        const payload = JSON.stringify({ type: "alert", data: { id: docRef.id, ...alert } });
        wss.clients.forEach((client) => {
          if (client.readyState === 1) {
            client.send(payload);
          }
        });
      }

      res.json({ ok: true, message: "Alert created successfully", id: docRef.id });
    } catch (err) {
      console.error("❌ Alert creation error:", err);
      res.status(500).json({ error: "Failed to create alert" });
    }
  });

  // ======================================================
  // 📋 Get Alerts (Public to all logged-in users)
  // ======================================================
  router.get("/", async (req, res) => {
    try {
      const snap = await db
        .collection("alerts")
        .orderBy("createdAt", "desc")
        .limit(20)
        .get();

      const alerts = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      res.json(alerts);
    } catch (err) {
      console.error("❌ Alerts fetch error:", err);
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });

  // ======================================================
  // 🗑️ Delete Alert (Admin Only)
  // ======================================================
  router.delete("/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await db.collection("alerts").doc(id).delete();

      // Broadcast removal
      if (wss) {
        const payload = JSON.stringify({ type: "alert_deleted", data: { id } });
        wss.clients.forEach((client) => {
          if (client.readyState === 1) {
            client.send(payload);
          }
        });
      }

      res.json({ ok: true, message: "Alert deleted successfully" });
    } catch (err) {
      console.error("❌ Alert delete error:", err);
      res.status(500).json({ error: "Failed to delete alert" });
    }
  });

  // ======================================================
  // ✅ Mark as Resolved (Optional endpoint for Drivers/Admin)
  // ======================================================
  router.patch("/:id/resolve", async (req, res) => {
    try {
      const { id } = req.params;
      await db.collection("alerts").doc(id).set({ resolved: true }, { merge: true });
      res.json({ ok: true, message: "Alert marked as resolved" });
    } catch (err) {
      console.error("❌ Alert resolve error:", err);
      res.status(500).json({ error: "Failed to mark alert resolved" });
    }
  });

  return router;
}
