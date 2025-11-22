/**
 * backend/seedRoutes.js
 * One-time seeder to upload routes + stops to Firestore
 */

import fs from "fs";
import path from "path";
import admin from "firebase-admin";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

// -----------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "./.env") });

// -----------------------------
const serviceAccountPath = path.resolve(
  process.cwd(),
  process.env.GOOGLE_APPLICATION_CREDENTIALS || "./<GOOGLE_SERVICE_ACCOUNT>.json"
);

if (!fs.existsSync(serviceAccountPath)) {
  console.error("❌ Missing service account:", serviceAccountPath);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// -----------------------------
// Load JSON data
const jsonPath = path.resolve(__dirname, "./updated_routes2.json");
const jsonData = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const routes = jsonData.routes || [];

async function seedRoutes() {
  console.log(`🚀 Uploading ${routes.length} routes to Firestore...`);
  for (const route of routes) {
    const { route_id, route_name, directions } = route;

    // Push route info
    const routeRef = db.collection("routes").doc(route_id);
    await routeRef.set({
      route_name,
      directions,
      createdAt: new Date(),
    });

    // Push individual stops (flattened for easy query)
    const allStops = [
      ...(directions.to || []).map((s) => ({ ...s, direction: "to" })),
      ...(directions.fro || []).map((s) => ({ ...s, direction: "fro" })),
    ];

    for (const stop of allStops) {
      await db
        .collection("stops")
        .add({
          route_id,
          route_name,
          stop_name: stop.stop_name,
          lat: stop.location.latitude,
          lon: stop.location.longitude,
          direction: stop.direction,
          sequence: stop.sequence ?? 0,
          createdAt: new Date(),
        });
    }

    console.log(`✅ ${route_name} (${route_id}) uploaded`);
  }

  console.log("🎉 All routes + stops uploaded successfully!");
  process.exit(0);
}

seedRoutes().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
