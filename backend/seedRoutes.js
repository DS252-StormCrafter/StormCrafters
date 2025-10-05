// backend/seedRoutes.js
import admin from "firebase-admin";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Resolve backend directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Load env vars (so GOOGLE_APPLICATION_CREDENTIALS & FIREBASE_PROJECT_ID work)
dotenv.config({ path: path.resolve(__dirname, "./.env") });

// ✅ Initialize Firebase Admin
if (!admin.apps.length) {
  const servicePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!servicePath) throw new Error("GOOGLE_APPLICATION_CREDENTIALS not set in .env");

  const fullPath = path.isAbsolute(servicePath)
    ? servicePath
    : path.resolve(process.cwd(), servicePath);

  const serviceAccount = JSON.parse(fs.readFileSync(fullPath, "utf8"));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId:
      process.env.FIREBASE_PROJECT_ID ||
      serviceAccount.project_id ||
      serviceAccount.projectId,
  });
  console.log("☁️ Firebase initialized using:", fullPath);
}

const db = admin.firestore();

async function seed() {
  const routes = [
    {
      id: "red_line",
      line: "Red Line",
      start: { name: "Main Gate" },
      end: { name: "D Gate" },
      schedule: [
        { trip: 1, startTime: "08:00 AM", endTime: "08:15 AM" },
        { trip: 2, startTime: "08:20 AM", endTime: "08:35 AM" },
        { trip: 3, startTime: "08:40 AM", endTime: "08:55 AM" },
      ],
      breaks: [
        { from: "09:55 AM", to: "10:10 AM", reason: "Tea Break" },
        { from: "12:25 PM", to: "12:55 PM", reason: "Lunch Break" },
        { from: "04:10 PM", to: "04:25 PM", reason: "Tea Break" },
      ],
    },
    {
      id: "green_line",
      line: "Green Line",
      start: { name: "Main Gate" },
      end: { name: "Ramaiah Gate" },
      schedule: [
        { trip: 1, startTime: "08:05 AM", endTime: "08:20 AM" },
        { trip: 2, startTime: "08:25 AM", endTime: "08:40 AM" },
      ],
      breaks: [
        { from: "10:00 AM", to: "10:15 AM", reason: "Tea Break" },
        { from: "12:30 PM", to: "01:00 PM", reason: "Lunch Break" },
        { from: "04:15 PM", to: "04:30 PM", reason: "Tea Break" },
      ],
    },
  ];

  const vehicles = [
    {
      id: "vehicle_001",
      driverName: "Ramesh",
      vehicleNumber: "KA01AB1234",
      line: "Red Line",
      capacity: 4,
      occupancy: 0,
      currentRoute: "red_line",
      status: "inactive",
      location: { lat: 12.9716, lng: 77.5946, timestamp: Date.now() },
    },
    {
      id: "vehicle_002",
      driverName: "Suresh",
      vehicleNumber: "KA01AB5678",
      line: "Green Line",
      capacity: 4,
      occupancy: 0,
      currentRoute: "green_line",
      status: "inactive",
      location: { lat: 12.9766, lng: 77.592, timestamp: Date.now() },
    },
  ];

  for (const route of routes) {
    await db.collection("routes").doc(route.id).set(route);
    console.log(`✅ Seeded route: ${route.id}`);
  }

  for (const vehicle of vehicles) {
    await db.collection("vehicles").doc(vehicle.id).set(vehicle);
    console.log(`✅ Seeded vehicle: ${vehicle.id}`);
  }

  console.log("🎉 Seeding complete");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Error seeding:", err);
  process.exit(1);
});
