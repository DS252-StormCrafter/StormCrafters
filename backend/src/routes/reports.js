// backend/src/routes/reports.js
import { Router } from "express";

export default function reportsRoutes(db) {
  const router = Router();

  // usage per route aggregated (sample)
  router.get("/usage", async (req, res) => {
    try {
      // naive aggregation over driver_activity
      const snap = await db.collection("driver_activity").get();
      const map = {};
      snap.docs.forEach(d => {
        const data = d.data();
        const rid = data.route_id || "unknown";
        map[rid] = (map[rid] || 0) + 1;
      });
      res.json({ usageByRoute: map });
    } catch (err) {
      console.error("Reports usage error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
