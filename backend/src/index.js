// backend/src/index.js
import express from "express";
import admin from "firebase-admin";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import { WebSocketServer } from "ws";
import { authenticate } from "./middleware/auth.js";

// --- Routes (unchanged) ---
import authRoutes from "./routes/auth.js";
import vehicleRoutes from "./routes/vehicle.js";
import routeRoutes from "./routes/route.js";
import feedbackRoutes from "./routes/feedback.js";
import alertsRoutes from "./routes/alerts.js";
import adminRoutes from "./routes/admin.js";
import driverRoutes from "./routes/driver.js";

// --- Load env (ensure .env in backend/ or adjust path) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// --- Firebase initialization (robust) ---
function initFirebase() {
  if (admin.apps.length) return admin.app();

  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST?.trim();
  const projectIdFromEnv = (process.env.FIREBASE_PROJECT_ID || "").trim();

  // If emulator configured, initialize with projectId and return
  if (emulatorHost) {
    const pid = projectIdFromEnv || "fir-transvahan";
    console.log(`🔥 Using Firestore Emulator at ${emulatorHost} (projectId=${pid})`);
    admin.initializeApp({ projectId: pid });
    const db = admin.firestore();
    db.settings({ host: emulatorHost, ssl: false });
    return admin.app();
  }

  // Otherwise attempt to initialize using service account JSON (GOOGLE_APPLICATION_CREDENTIALS)
  const servicePathRaw = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!servicePathRaw) {
    console.error("❌ GOOGLE_APPLICATION_CREDENTIALS is not set in .env and FIRESTORE_EMULATOR_HOST is not set.");
    console.error("   Please set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON (absolute path) or set FIRESTORE_EMULATOR_HOST for local testing.");
    process.exit(1);
  }

  // Resolve path: absolute or relative to backend/ directory
  const servicePath = path.isAbsolute(servicePathRaw)
    ? servicePathRaw
    : path.resolve(process.cwd(), servicePathRaw);

  if (!fs.existsSync(servicePath)) {
    console.error("❌ Service account JSON file not found at:", servicePath);
    process.exit(1);
  }

  try {
    const serviceAccount = JSON.parse(fs.readFileSync(servicePath, "utf8"));
    const projectId = serviceAccount.project_id || projectIdFromEnv || serviceAccount.projectId;
    console.log(`☁️ Using live Firestore project (projectId=${projectId}) via service account: ${servicePath}`);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
    });
    return admin.app();
  } catch (err) {
    console.error("🔥 Failed to initialize Firebase Admin SDK from service account JSON:", err);
    process.exit(1);
  }
}

// initialize
initFirebase();
const db = admin.firestore();

// --- Express setup ---
const app = express();
app.use(cors());
app.use(express.json());

// --- Routes (public & protected) ---
app.use("/auth", authRoutes(db));

app.use("/vehicle", authenticate, vehicleRoutes(db));
app.use("/routes", authenticate, routeRoutes(db));
app.use("/feedback", authenticate, feedbackRoutes(db));
app.use("/alerts", authenticate, alertsRoutes(db));

app.use("/admin", authenticate, adminRoutes(db));
console.log("🛠️ Admin routes loaded successfully.");

// 🚖 Driver routes (login open, others protected inside router)
app.use("/driver", driverRoutes(db));
console.log("🚖 Driver routes loaded successfully.");

// health (quick check)
app.get("/health", async (req, res) => {
  try {
    // try a cheap read (no heavy quota)
    const q = await db.collection("__healthcheck__").limit(1).get().catch(() => null);
    res.json({ ok: true, projectId: admin.instanceId ? admin.instanceId() : process.env.FIREBASE_PROJECT_ID || null });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Start server ---
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});

// --- WebSocket server (unchanged) ---
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
        try { ws.send(JSON.stringify(shaped)); } catch (e) { /* no-op */ }
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

// export db for other modules (if needed)
export { db };
