// backend/src/routes/route.js
import { Router } from "express";

export default function routeRoutes(db) {
  const router = Router();

  // ✅ Get all routes (supports both "schedule" and "scheduledTrips")
  router.get("/", async (req, res) => {
    try {
      const snapshot = await db.collection("routes").get();
      const routes = snapshot.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          name: d.line || d.routeName || doc.id,
          start: d.start?.name || "Unknown",
          end: d.end?.name || "Unknown",
          stops: d.stops ?? [],
          schedule:
            d.scheduledTrips ??
            d.schedule ??
            [],
          breaks: d.breaks ?? [],
        };
      });
      res.json(routes);
    } catch (err) {
      console.error("Routes fetch error:", err);
      res.status(500).json({ error: "Failed to fetch routes" });
    }
  });

  // ✅ Get single route
  router.get("/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const routeDoc = await db.collection("routes").doc(id).get();
      if (!routeDoc.exists) return res.status(404).json({ error: "Route not found" });

      const d = routeDoc.data();
      res.json({
        id: routeDoc.id,
        name: d.line || d.routeName || routeDoc.id,
        start: d.start?.name || "Unknown",
        end: d.end?.name || "Unknown",
        stops: d.stops ?? [],
        schedule:
          d.scheduledTrips ??
          d.schedule ??
          [],
        breaks: d.breaks ?? [],
      });
    } catch (err) {
      console.error("Route detail fetch error:", err);
      res.status(500).json({ error: "Failed to fetch route detail" });
    }
  });

  return router;
}
