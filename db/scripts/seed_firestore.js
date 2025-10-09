/**
 * Firestore Seeder Script (fixed path from db/scripts to backend)
 */

import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// ✅ Load env from backend/.env (go 2 levels up)
const backendEnvPath = path.resolve("../../backend/.env");
dotenv.config({ path: backendEnvPath });

// ✅ Build absolute path to service account file (also 2 levels up)
const backendDir = path.resolve("../../backend");
const serviceAccountPath = path.resolve(
  backendDir,
  process.env.GOOGLE_APPLICATION_CREDENTIALS || ""
);
const seedFolder = path.resolve("../seed");

// --- Firebase initialization ---
if (process.env.FIRESTORE_EMULATOR_HOST) {
  console.log(`🔥 Using Firestore Emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`);
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || "midterm-transvahan",
  });
} else {
  console.log("☁️ Using Live Firestore Project");

  if (!fs.existsSync(serviceAccountPath)) {
    console.error("❌ Service account JSON missing or invalid path:", serviceAccountPath);
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

const db = admin.firestore();
if (process.env.FIRESTORE_EMULATOR_HOST) {
  db.settings({ host: "127.0.0.1:8080", ssl: false });
}

// --- Helper to load JSON ---
function loadJSON(filename) {
  const filePath = path.join(seedFolder, filename);
  if (!fs.existsSync(filePath)) throw new Error(`❌ Missing seed file: ${filePath}`);
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

// --- Seeder functions ---
async function seedRoutes() {
  const routes = loadJSON("routes.json");
  for (const route of routes) {
    const ref = db.collection("routes").doc(route.routeCode);
    await ref.set({
      routeCode: route.routeCode,
      routeName: route.routeName,
      color: route.color,
      active: route.active,
      stops: route.stops || [],
      breaks: route.breaks || [],
    });
    for (const trip of route.scheduledTrips || []) {
      await ref.collection("scheduledTrips").add(trip);
    }
    console.log(`✅ Seeded route: ${route.routeCode}`);
  }
}

async function seedUsers() {
  const users = loadJSON("users.json");
  for (const user of users) {
    await db.collection("users").doc(user.userId).set(user);
    console.log(`✅ Seeded user: ${user.userId}`);
  }
}

async function seedVehicles() {
  const vehicles = loadJSON("vehicles.json");
  for (const vehicle of vehicles) {
    await db.collection("vehicles").doc(vehicle.vehicleId).set(vehicle);
    console.log(`✅ Seeded vehicle: ${vehicle.vehicleId}`);
  }
}

async function seedDrivers() {
  const drivers = loadJSON("drivers.json");
  for (const driver of drivers) {
    await db.collection("drivers").doc(driver.driverId).set(driver);
    console.log(`✅ Seeded driver: ${driver.driverId}`);
  }
}

// --- Main ---
async function main() {
  try {
    console.log("🚀 Starting Firestore seeding...");
    await seedRoutes();
    await seedUsers();
    await seedVehicles();
    await seedDrivers();
    console.log("🎉 Firestore seeding complete!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding Firestore:", err);
    process.exit(1);
  }
}

main();
