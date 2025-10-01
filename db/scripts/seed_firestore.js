import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

initializeApp();
const db = getFirestore();

// ---- Seed Routes + Scheduled Trips ----
async function seedRoutes() {
  const routes = JSON.parse(fs.readFileSync("./db/seed/routes.json"));
  for (const route of routes) {
    const ref = db.collection("routes").doc(route.routeCode);
    await ref.set({
      routeCode: route.routeCode,
      routeName: route.routeName,
      color: route.color,
      active: route.active,
      stops: route.stops || [],
      breaks: route.breaks || []
    });

    for (const trip of route.scheduledTrips || []) {
      await ref.collection("scheduledTrips").add(trip);
    }
    console.log(`Seeded route ${route.routeCode}`);
  }
}

// ---- Seed Users ----
async function seedUsers() {
  const users = JSON.parse(fs.readFileSync("./db/seed/users.json"));
  for (const user of users) {
    await db.collection("users").doc(user.userId).set(user);
    console.log(`Seeded user ${user.userId}`);
  }
}

// ---- Seed Vehicles ----
async function seedVehicles() {
  const vehicles = JSON.parse(fs.readFileSync("./db/seed/vehicles.json"));
  for (const vehicle of vehicles) {
    await db.collection("vehicles").doc(vehicle.vehicleId).set(vehicle);
    console.log(`Seeded vehicle ${vehicle.vehicleId}`);
  }
}

// ---- Seed Drivers ----
async function seedDrivers() {
  const drivers = JSON.parse(fs.readFileSync("./db/seed/drivers.json"));
  for (const driver of drivers) {
    await db.collection("drivers").doc(driver.driverId).set(driver);
    console.log(`Seeded driver ${driver.driverId}`);
  }
}

// ---- Seed Trips ----
async function seedTrips() {
  const trips = JSON.parse(fs.readFileSync("./db/seed/trips.json"));
  for (const trip of trips) {
    await db.collection("trips").doc(trip.tripId).set(trip);
    console.log(`Seeded trip ${trip.tripId}`);
  }
}

// ---- Main ----
async function main() {
  await seedRoutes();
  await seedUsers();
  await seedVehicles();
  await seedDrivers();
  await seedTrips();
  console.log("✅ Firestore seeding complete!");
  process.exit(0);
}

main();
