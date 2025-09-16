// db/scripts/seed_rtdb.js
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import fs from "fs";

// Init Firebase Admin
const app = initializeApp({
  credential: applicationDefault(),
  databaseURL: "http://127.0.0.1:9000/?ns=demo-transvahan" // change ns if needed
});
const db = getDatabase(app);

// ---- Seed Concurrent Users ----
async function seedConcurrentUsers() {
  const concurrent = JSON.parse(fs.readFileSync("./db/seed/conc_users.json"));
  for (const user of concurrent) {
    await db.ref(`status/${user.userId}`).set({
      state: user.state,
      lastSeen: new Date(user.lastSeen).getTime()
    });
    console.log(`Seeded status for ${user.userId}`);
  }
}

// ---- Seed Seat Status ----
async function seedSeatStatus() {
  const seatData = JSON.parse(fs.readFileSync("./db/seed/seat_status.json"));
  for (const trip of seatData) {
    await db.ref(`seatStatus/${trip.tripId}`).set({
      occupied: trip.occupied,
      capacity: trip.capacity,
      lastUpdated: new Date(trip.lastUpdated).getTime()
    });
    console.log(`Seeded seatStatus for ${trip.tripId}`);
  }
}

// ---- Main ----
async function main() {
  await seedConcurrentUsers();
  await seedSeatStatus();
  process.exit(0);
}

main();
