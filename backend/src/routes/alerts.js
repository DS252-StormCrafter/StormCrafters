// backend/src/routes/alerts.js
import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/auth.js";

/**
 * Alerts routes factory
 * - GET /        -> public (no auth required)
 * - POST /       -> protected (authenticate)
 * - DELETE /:id  -> protected (requireAdmin)
 * - PATCH /:id/resolve -> protected (authenticate)
 *
 * Accepts db and wss for broadcast.
 */
export default function alertsRoutes(db, wss) {
  const router = Router();

  // ----------------------------------------------------
  // Utility helpers
  // ----------------------------------------------------
  function normalizeTarget(t) {
    if (!t) return "all";
    const s = String(t).toLowerCase().trim();
    if (["user", "users"].includes(s)) return "users";
    if (["driver", "drivers"].includes(s)) return "drivers";
    return "all";
  }

  function normalizeRole(r) {
    if (!r) return "unknown";
    const s = String(r).toLowerCase().trim();
    if (s === "user") return "user";
    if (s === "driver") return "driver";
    return "unknown";
  }

  // ----------------------------------------------------
  // Create Alert (protected) — any authenticated actor can post (admins/drivers)
  // ----------------------------------------------------
  router.post("/", authenticate, async (req, res) => {
    try {
      const { message, route_id, vehicle_id, type, target } = req.body;
      if (!message) return res.status(400).json({ error: "Message is required" });

      const normalizedTarget = normalizeTarget(target);

      const alert = {
        message,
        route_id: route_id || null,
        vehicle_id: vehicle_id || null,
        type: type || "general",
        target: normalizedTarget, // "users" | "drivers" | "all"
        createdAt: new Date().toISOString(),
        resolved: false,
        createdBy: req.user
          ? { email: req.user.email, id: req.user.id, role: req.user.role }
          : null,
      };

      const docRef = db.collection("alerts").doc();
      await docRef.set(alert);

      // ----------------------------------------------------
      // Broadcast alert (role-based filtering)
      // ----------------------------------------------------
      if (wss) {
        const payload = JSON.stringify({
          type: "alert",
          data: { id: docRef.id, ...alert },
        });

        let counts = { users: 0, drivers: 0, unknown: 0 };

        wss.clients.forEach((client) => {
          if (client.readyState !== 1) return;

          const role = normalizeRole(client.userRole);

          // Completely skip unknown sockets
          if (role === "unknown") return;

          // Strict broadcast filtering (no unknown leaks)
          const shouldSend =
            alert.target === "all" ||
            (alert.target === "users" && role === "user") ||
            (alert.target === "drivers" && role === "driver");

          if (shouldSend) {
            try {
              client.send(payload);
              if (role === "user") counts.users++;
              else if (role === "driver") counts.drivers++;
            } catch (e) {
              console.warn(`⚠️ WS send failed for ${role}:`, e);
            }
          }

        });

        console.log(
          `📢 Alert broadcasted [target=${alert.target}] → users=${counts.users}, drivers=${counts.drivers}, unknown=${counts.unknown}`
        );
      }

      res.json({ ok: true, message: "Alert created successfully", id: docRef.id });
    } catch (err) {
      console.error("❌ Alert creation error:", err);
      res.status(500).json({ error: "Failed to create alert" });
    }
  });

  // ----------------------------------------------------
  // Get Alerts (public)
  // ----------------------------------------------------
  router.get("/", async (req, res) => {
    try {
      const snap = await db
        .collection("alerts")
        .orderBy("createdAt", "desc")
        .limit(50)
        .get();

      const alerts = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      res.json(alerts);
    } catch (err) {
      console.error("❌ Alerts fetch error:", err);
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });

  // ----------------------------------------------------
  // Delete Alert (admin only)
  // ----------------------------------------------------
  router.delete("/:id", authenticate, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await db.collection("alerts").doc(id).delete();

      if (wss) {
        const payload = JSON.stringify({ type: "alert_deleted", data: { id } });
        wss.clients.forEach((client) => {
          if (client.readyState === 1) client.send(payload);
        });
      }

      res.json({ ok: true, message: "Alert deleted successfully" });
    } catch (err) {
      console.error("❌ Alert delete error:", err);
      res.status(500).json({ error: "Failed to delete alert" });
    }
  });

  // ----------------------------------------------------
  // Mark as Resolved (authenticated)
  // ----------------------------------------------------
  router.patch("/:id/resolve", authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      await db.collection("alerts").doc(id).set({ resolved: true }, { merge: true });

      if (wss) {
        const payload = JSON.stringify({ type: "alert_resolved", data: { id } });
        wss.clients.forEach((client) => {
          if (client.readyState === 1) client.send(payload);
        });
      }

      res.json({ ok: true, message: "Alert marked as resolved" });
    } catch (err) {
      console.error("❌ Alert resolve error:", err);
      res.status(500).json({ error: "Failed to mark alert resolved" });
    }
  });

  return router;
}
