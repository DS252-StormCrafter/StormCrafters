import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

const app = initializeApp();
const db = getFirestore();

async function seedRoutes() {
  const routes = JSON.parse(fs.readFileSync("./db/seed/routes.json"));
  for (const route of routes) {
    const ref = db.collection("routes").doc(route.routeCode);
    await ref.set({
      routeCode: route.routeCode,
      routeName: route.routeName,
      color: route.color,
      active: route.active,
      stops: route.stops,
      breaks: route.breaks
    });
    for (const trip of route.scheduledTrips) {
      await ref.collection("scheduledTrips").add(trip);
    }
  }
}

seedRoutes().then(() => console.log("Seeded routes!"));
