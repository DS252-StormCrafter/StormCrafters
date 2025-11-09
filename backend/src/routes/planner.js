// backend/src/routes/planner.js
import { Router } from "express";
import { planCampusRoute } from "../utils/geo.js";

export default function plannerRoutes() {
  const router = Router();

  router.get("/plan", async (req, res) => {
    const { fromLat, fromLon, toLat, toLon } = req.query;
    const lat1 = parseFloat(fromLat);
    const lon1 = parseFloat(fromLon);
    const lat2 = parseFloat(toLat);
    const lon2 = parseFloat(toLon);

    if ([lat1, lon1, lat2, lon2].some((x) => isNaN(x))) {
      return res.status(400).json({ error: "Invalid coordinates" });
    }

    const plan = planCampusRoute(lat1, lon1, lat2, lon2);
    if (!plan) return res.status(404).json({ error: "No viable route found" });
    res.json(plan);
  });

  return router;
}
