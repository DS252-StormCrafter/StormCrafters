import { Router } from "express";

export default function feedbackRoutes(db) {
  const router = Router();

  // Submit feedback
  router.post("/", async (req, res) => {
    try {
      const { vehicle_id, rating, comment } = req.body;
      if (!vehicle_id || !rating) {
        return res.status(400).json({ error: "Missing fields" });
      }

      const feedbackRef = db.collection("feedback").doc();
      await feedbackRef.set({
        vehicle_id,
        rating,
        comment: comment || "",
        user: req.user.uid,
        timestamp: new Date().toISOString(),
      });

      res.json({ message: "Feedback submitted" });
    } catch (err) {
      console.error("❌ Feedback error:", err);
      res.status(500).json({ error: "Failed to submit feedback" });
    }
  });

  // Get feedback for a vehicle
  router.get("/:vehicle_id", async (req, res) => {
    try {
      const { vehicle_id } = req.params;
      const snapshot = await db
        .collection("feedback")
        .where("vehicle_id", "==", vehicle_id)
        .get();

      const feedback = snapshot.docs.map((doc) => doc.data());
      res.json(feedback);
    } catch (err) {
      console.error("❌ Feedback fetch error:", err);
      res.status(500).json({ error: "Failed to fetch feedback" });
    }
  });

  return router;
}
