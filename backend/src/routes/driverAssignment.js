import { Router } from "express";
import { authenticate } from "../middleware/auth.js";

export default function driverAssignmentRoutes(db) {
  const router = Router();

  // GET /driver/assignment
  router.get("/assignment", authenticate, async (req, res) => {
    try {
      const driverId = req.user.id;
      if (!driverId) {
        return res.status(400).json({ error: "Invalid driver token" });
      }

      const snap = await db
        .collection("assignments")
        .where("driver_id", "==", driverId)
        .where("active", "==", true)
        .limit(1)
        .get();

      if (snap.empty) {
        return res.json({ assignment: null });
      }

      const doc = snap.docs[0];
      const data = doc.data();

      return res.json({
        assignment: {
          id: doc.id,
          route_id: data.route_id,
          route_name: data.route_name,
          vehicle_id: data.vehicle_id,
          vehicle_plate: data.vehicle_plate,
          direction: data.direction,
        },
      });
    } catch (err) {
      console.error("GET /driver/assignment error:", err);
      res.status(500).json({ error: "Failed to fetch assignment" });
    }
  });

  return router;
}