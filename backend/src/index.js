// backend/src/index.js
import express from "express";
import admin from "firebase-admin";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import { WebSocketServer } from "ws";
import { authenticate } from "./middleware/auth.js";

// --- Route Imports ---
import authRoutes from "./routes/auth.js";
import vehicleRoutes from "./routes/vehicle.js";
import routeRoutes from "./routes/route.js";
import feedbackRoutes from "./routes/feedback.js";
import alertsRoutes from "./routes/alerts.js";
import adminRoutes from "./routes/admin.js";

// --- Load Environment Variables ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// --- Firebase Initialization ---
if (process.env.FIRESTORE_EMULATOR_HOST) {
  console.log(`🔥 Using Firestore Emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`);
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || "demo-transvahan",
  });
} else {
  console.log("⚙️ Using live Firestore project");
  admin.initializeApp();
}

const db = admin.firestore();

// --- Express Setup ---
const app = express();
app.use(cors());
app.use(express.json());

// --- Public Routes ---
app.use("/auth", authRoutes(db));

// --- Protected Routes ---
app.use("/vehicle", authenticate, vehicleRoutes(db));
app.use("/routes", authenticate, routeRoutes(db));
app.use("/feedback", authenticate, feedbackRoutes(db));
app.use("/alerts", authenticate, alertsRoutes(db));

// --- Admin Routes (Protected) ---
app.use("/admin", authenticate, adminRoutes(db));
console.log("🛠️ Admin routes loaded successfully.");

// --- Start HTTP Server ---
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () =>
  console.log(`🚀 Backend running on http://localhost:${PORT}`)
);

// --- WebSocket Server for Real-time Vehicle Data ---
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  console.log("📡 WebSocket client connected");

  const interval = setInterval(async () => {
    try {
      const snapshot = await db.collection("vehicles").get();
      snapshot.forEach((doc) => {
        const d = doc.data();
        const shaped = {
          id: doc.id,
          vehicle_id: d.plateNo ?? doc.id,
          route_id: d.currentRoute ?? "unknown",
          lat: d.location?.lat ?? 0,
          lng: d.location?.lng ?? 0,
          occupancy: d.occupancy ?? 0,
          capacity: d.capacity ?? 4,
          vacant: (d.capacity ?? 4) - (d.occupancy ?? 0),
          status: d.status ?? "inactive",
          updated_at: d.location?.timestamp
            ? new Date(d.location.timestamp).toISOString()
            : new Date().toISOString(),
        };
        ws.send(JSON.stringify(shaped));
      });
    } catch (err) {
      console.error("WebSocket error:", err);
    }
  }, 5000);

  ws.on("close", () => {
    clearInterval(interval);
    console.log("❌ WebSocket client disconnected");
  });
});

// --- Export Firestore Reference ---
export { db };
