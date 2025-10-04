import { Router } from "express";

export default function routeRoutes(db) {
  const router = Router();

  // Get all routes (shaped for frontend)
  router.get("/", async (req, res) => {
    const snapshot = await db.collection("routes").get();
    const routes = snapshot.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,                  // routeCode
        name: d.routeName ?? doc.id, // routeName or fallback
        stops: d.stops ?? [],
        schedule: (d.scheduledTrips ?? []).map(t => `${t.departTime} - ${t.arrivalTime}`)
      };
    });
    res.json(routes);
  });

  // Get single route by ID
  router.get("/:id", async (req, res) => {
    const { id } = req.params;
    const routeDoc = await db.collection("routes").doc(id).get();

    if (!routeDoc.exists) return res.status(404).send("Route not found");

    const d = routeDoc.data();
    res.json({
      id: routeDoc.id,
      name: d.routeName ?? routeDoc.id,
      stops: d.stops ?? [],
      schedule: (d.scheduledTrips ?? []).map(t => `${t.departTime} - ${t.arrivalTime}`)
    });
  });

  return router;
}
