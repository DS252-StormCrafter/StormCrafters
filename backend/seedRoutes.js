import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

admin.initializeApp({
  projectId: process.env.FIREBASE_PROJECT_ID || "demo-transvahan",
});

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
        // ... fill from PDF
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
        // ... fill from PDF
      ],
      breaks: [
        { from: "10:00 AM", to: "10:15 AM", reason: "Tea Break" },
        { from: "12:30 PM", to: "01:00 PM", reason: "Lunch Break" },
        { from: "04:15 PM", to: "04:30 PM", reason: "Tea Break" },
      ],
    },
    // Add Blue, Orange, Purple, Yellow similarly
  ];

  for (const route of routes) {
    await db.collection("routes").doc(route.id).set(route);
    console.log(`✅ Seeded route: ${route.id}`);
  }

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
      location: { lat: 12.9766, lng: 77.5920, timestamp: Date.now() },
    },
  ];

  for (const vehicle of vehicles) {
    await db.collection("vehicles").doc(vehicle.id).set(vehicle);
    console.log(`✅ Seeded vehicle: ${vehicle.id}`);
  }

  console.log("🎉 Seeding complete");
}

seed().then(() => process.exit(0));
