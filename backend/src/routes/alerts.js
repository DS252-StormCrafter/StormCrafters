// backend/src/routes/alerts.js
import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/auth.js";

/**
 * Alerts Routes (Role-hardened, ready-to-paste)
 * - GET /alerts
 * - POST /alerts
 * - PATCH /alerts/:id/resolve
 * - DELETE /alerts/:id
 *
 * Preserves all features, but makes WS broadcast role filtering robust.
 */
export default function alertsRoutes(db, wss) {
  const router = Router();

  // Normalize incoming "target" field to canonical values used in alert docs
  const normalizeTarget = (t) => {
    if (!t) return "all";
    const s = String(t).toLowerCase().trim();
    if (["user", "users"].includes(s)) return "users";
    if (["driver", "drivers"].includes(s)) return "drivers";
    if (["admin", "admins"].includes(s)) return "admins";
    return "all";
  };

  // Normalize client's role from WebSocket client object
  const normalizeRole = (r) => {
    if (!r) return "unknown";
    const s = String(r).toLowerCase().trim();
    if (["user", "users"].includes(s)) return "user";
    if (["driver", "drivers"].includes(s)) return "driver";
    if (["admin", "admins"].includes(s)) return "admin";
    return "unknown";
  };

  // Try multiple possible places where a role might be stored on the WS client object
  const detectClientRole = (client) => {
    // common placement used by our server code: client.userRole
    if (client && client.userRole) return normalizeRole(client.userRole);

    // some clients attach user object: client.user.role
    if (client && client.user && client.user.role) return normalizeRole(client.user.role);

    // backward / alternative properties
    if (client && client.role) return normalizeRole(client.role);
    if (client && client._roleHint) return normalizeRole(client._roleHint);

    // lastly check nested raw user object
    if (client && client.user && (client.user.type || client.user.typeName))
      return normalizeRole(client.user.type || client.user.typeName);

    return "unknown";
  };

  // ------------------------------------------------------------
  // Create Alert (Authenticated - Admin or Driver)
  // ------------------------------------------------------------
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
        target: normalizedTarget, // users | drivers | admins | all
        createdAt: new Date().toISOString(),
        resolved: false,
        createdBy: req.user
          ? { email: req.user.email, id: req.user.id, role: req.user.role }
          : null,
      };

      const docRef = db.collection("alerts").doc();
      await docRef.set(alert);

      // ------------------------------------------------------------
      // WebSocket Broadcast (role-filtered)
      // ------------------------------------------------------------
      if (wss) {
        const payloadObj = { type: "alert", data: { id: docRef.id, ...alert } };
        const payload = JSON.stringify(payloadObj);

        let counts = { users: 0, drivers: 0, admins: 0, unknown: 0, total: 0 };

        // For each connected client, determine if alert should be sent
        wss.clients.forEach((client) => {
          try {
            // Only send to open clients
            if (!client || client.readyState !== 1) return;

            counts.total++;

            const clientRole = detectClientRole(client); // user | driver | admin | unknown

            // If client role is unknown, we will NOT send role-specific alerts to them.
            if (clientRole === "unknown") {
              counts.unknown++;
              // Only send if the alert target is "all" and you explicitly want unknown sockets included.
              // Here we DO NOT send to unknown for safety (prevents leaking user-only alerts to unknown).
              return;
            }

            // Decide whether to send based on alert.target
            const shouldSend =
              alert.target === "all" ||
              (alert.target === "users" && clientRole === "user") ||
              (alert.target === "drivers" && clientRole === "driver") ||
              (alert.target === "admins" && clientRole === "admin");

            if (shouldSend) {
              client.send(payload);
              if (clientRole === "user") counts.users++;
              else if (clientRole === "driver") counts.drivers++;
              else if (clientRole === "admin") counts.admins++;
            }
          } catch (err) {
            // per-client send failed — log but continue
            console.warn("⚠️ WS per-client send error:", err);
          }
        });

        console.log(
          `📢 Alert broadcasted [target=${alert.target}] → users=${counts.users}, drivers=${counts.drivers}, admins=${counts.admins}, unknown_skipped=${counts.unknown}, total_clients_scanned=${counts.total}`
        );
      }

      res.json({ ok: true, message: "Alert created successfully", id: docRef.id });
    } catch (err) {
      console.error("❌ Alert creation error:", err);
      res.status(500).json({ error: "Failed to create alert" });
    }
  });

  // ------------------------------------------------------------
  // Get Alerts (Public)
  // ------------------------------------------------------------
  router.get("/", async (req, res) => {
    try {
      const snap = await db.collection("alerts").orderBy("createdAt", "desc").limit(50).get();
      const alerts = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      res.json(alerts);
    } catch (err) {
      console.error("❌ Alerts fetch error:", err);
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });

  // ------------------------------------------------------------
  // Delete Alert (Admin only)
  // ------------------------------------------------------------
  router.delete("/:id", authenticate, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await db.collection("alerts").doc(id).delete();

      if (wss) {
        const payload = JSON.stringify({ type: "alert_deleted", data: { id } });
        wss.clients.forEach((client) => {
          try {
            if (client && client.readyState === 1) client.send(payload);
          } catch (err) {
            console.warn("⚠️ WS send failed for alert_deleted:", err);
          }
        });
      }

      res.json({ ok: true, message: "Alert deleted successfully" });
    } catch (err) {
      console.error("❌ Alert delete error:", err);
      res.status(500).json({ error: "Failed to delete alert" });
    }
  });

  // ------------------------------------------------------------
  // Mark Alert as Resolved
  // ------------------------------------------------------------
  router.patch("/:id/resolve", authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      await db.collection("alerts").doc(id).set({ resolved: true }, { merge: true });

      if (wss) {
        const payload = JSON.stringify({ type: "alert_resolved", data: { id } });
        wss.clients.forEach((client) => {
          try {
            if (client && client.readyState === 1) client.send(payload);
          } catch (err) {
            console.warn("⚠️ WS send failed for alert_resolved:", err);
          }
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
