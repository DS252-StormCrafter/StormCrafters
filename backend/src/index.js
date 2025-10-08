// backend/src/index.js
/**
 * Full backend entrypoint (expanded)
 * - Robust dotenv + emulator detection
 * - Service account resolution (absolute or relative)
 * - Route wiring (auth, vehicle, routes, feedback, alerts, admin, driver)
 * - WebSocket server for real-time vehicle updates + alert broadcast integration
 */

import express from "express";
import admin from "firebase-admin";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import { WebSocketServer } from "ws";
import { authenticate } from "./middleware/auth.js";

// --- Routes ---
import authRoutes from "./routes/auth.js";
import vehicleRoutes from "./routes/vehicle.js";
import routeRoutes from "./routes/route.js";
import feedbackRoutes from "./routes/feedback.js";
import alertsRoutes from "./routes/alerts.js";
import adminRoutes from "./routes/admin.js";
import driverRoutes from "./routes/driver.js";

// --- env setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env (prefer backend/.env)
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// -----------------------------------------------------------------------------
// Firebase init (robust: supports emulator and service-account JSON path resolution)
// -----------------------------------------------------------------------------
function initFirebase() {
  if (admin.apps.length) {
    console.log("🔁 Firebase already initialized - reusing existing app");
    return admin.app();
  }

  const emulatorHostRaw = process.env.FIRESTORE_EMULATOR_HOST;
  const firestoreEmulatorHost = emulatorHostRaw ? emulatorHostRaw.trim() : "";

  const projectIdFromEnv = (process.env.FIREBASE_PROJECT_ID || "").trim();

  // 1) If emulator is configured -> init with project id and point to emulator
  if (firestoreEmulatorHost) {
    const pid = projectIdFromEnv || "fir-transvahan";
    console.log(`🔥 Using Firestore Emulator at ${firestoreEmulatorHost} (projectId=${pid})`);
    admin.initializeApp({ projectId: pid });
    const db = admin.firestore();
    db.settings({ host: firestoreEmulatorHost, ssl: false });
    return admin.app();
  }

  // 2) Otherwise, expect a service account JSON via GOOGLE_APPLICATION_CREDENTIALS
  const servicePathRaw = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!servicePathRaw) {
    console.error("❌ GOOGLE_APPLICATION_CREDENTIALS is not set and FIRESTORE_EMULATOR_HOST not set.");
    console.error("   Please set GOOGLE_APPLICATION_CREDENTIALS (absolute path) or enable emulator.");
    process.exit(1);
  }

  // Resolve path (absolute or relative to backend/ directory)
  const servicePath = path.isAbsolute(servicePathRaw)
    ? servicePathRaw
    : path.resolve(process.cwd(), servicePathRaw);

  if (!fs.existsSync(servicePath)) {
    console.error("❌ Service account JSON file not found at:", servicePath);
    process.exit(1);
  }

  try {
    const serviceAccountRaw = fs.readFileSync(servicePath, "utf8");
    const serviceAccount = JSON.parse(serviceAccountRaw);
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

// initialize firebase
initFirebase();
const db = admin.firestore();

// -----------------------------------------------------------------------------
// Express setup
// -----------------------------------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// --- Public routes that don't require admin checks are mounted below
app.use("/auth", authRoutes(db));

// For routes that require authentication we wire `authenticate` middleware when needed.
// We'll mount /vehicle, /routes etc below (some are protected)

app.use("/vehicle", authenticate, vehicleRoutes(db));
app.use("/routes", authenticate, routeRoutes(db));
app.use("/feedback", authenticate, feedbackRoutes(db));

// Admin routes and driver routes are mounted below (admin uses authenticate + requireAdmin inside controllers if required)
app.use("/admin", authenticate, adminRoutes(db));
console.log("🛠️ Admin routes loaded successfully.");

// Driver routes: driverRoutes handles its own protection for subpaths; login remains open inside driverRoutes
app.use("/driver", driverRoutes(db));
console.log("🚖 Driver routes loaded successfully.");

// -----------------------------------------------------------------------------
// Start server and attach WebSocketServer
// -----------------------------------------------------------------------------
const PORT = process.env.PORT || 5001;
const server = app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://192.168.0.156:${PORT}`);
});

// Create WebSocket server on same HTTP server under "/ws"
import { URL } from "url";
const wss = new WebSocketServer({ server, path: "/ws" });

// ✅ Improved WebSocket role tracking
wss.on("connection", (ws, req) => {
  let userRole = "unknown";
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    userRole = url.searchParams.get("role") || "unknown";
  } catch (e) {
    console.warn("⚠️ Could not parse role from WebSocket URL");
  }

  ws.userRole = userRole;
  console.log(`📡 WebSocket connected [role=${userRole}]`);

  // Send welcome message
  try {
    ws.send(
      JSON.stringify({
        type: "welcome",
        data: { role: userRole, serverTime: new Date().toISOString() },
      })
    );
  } catch (e) {}

  // Periodic vehicle updates (unchanged)
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
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: "vehicle", data: shaped }));
        }
      });
    } catch (err) {
      console.error("WebSocket vehicle broadcast error:", err);
    }
  }, 5001);

  ws.on("close", () => {
    clearInterval(interval);
    console.log(`❌ WebSocket disconnected [role=${userRole}]`);
  });

  ws.on("error", (err) => {
    console.warn(`⚠️ WebSocket error [role=${userRole}]:`, err);
  });
});

// -----------------------------------------------------------------------------
// Alerts route wiring
// -----------------------------------------------------------------------------
try {
  // mount alerts WITHOUT global `authenticate` so GET /alerts can be public.
  // alertsRoutes internally protects POST/DELETE/PATCH using `authenticate` and `requireAdmin`.
  app.use("/alerts", alertsRoutes(db, wss));
  console.log("🔔 Alerts route mounted (routes control protection)");
} catch (err) {
  try {
    app.use("/alerts", alertsRoutes(db));
    console.log("🔔 Alerts route mounted (fallback: db only)");
  } catch (e) {
    console.error("❌ Failed to mount alerts route:", e);
  }
}

// -----------------------------------------------------------------------------
// Health check
// -----------------------------------------------------------------------------
app.get("/health", async (req, res) => {
  try {
    // cheap read (no heavy quota)
    await db.collection("__healthcheck__").limit(1).get().catch(() => null);
    res.json({ ok: true, projectId: process.env.FIREBASE_PROJECT_ID || admin.instanceId?.() || null });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Export db and wss for other modules if needed
export { db, wss };
