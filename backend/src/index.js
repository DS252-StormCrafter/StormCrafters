/**
 * Full backend entrypoint (FINAL FIXED VERSION ✅)
 * - Robust dotenv + emulator detection
 * - WebSocket role tracking + alert filtering
 * - Route wiring (auth, vehicle, routes, feedback, alerts, admin, driver)
 */

import express from "express";
import admin from "firebase-admin";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath, URL } from "url";
import cors from "cors";
import { WebSocketServer } from "ws";
import * as querystring from "querystring"; // ✅ FIX: Safe role parsing for Node ESM
import { authenticate } from "./middleware/auth.js";

// Routes
import authRoutes from "./routes/auth.js";
import vehicleRoutes from "./routes/vehicle.js";
import routeRoutes from "./routes/route.js";
import feedbackRoutes from "./routes/feedback.js";
import alertsRoutes from "./routes/alerts.js";
import adminRoutes from "./routes/admin.js";
import driverRoutes from "./routes/driver.js";

// Environment setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// -----------------------------------------------------------------------------
// Firebase Initialization
// -----------------------------------------------------------------------------
function initFirebase() {
  if (admin.apps.length) return admin.app();

  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST?.trim();
  const projectIdFromEnv = process.env.FIREBASE_PROJECT_ID?.trim() || "fir-transvahan";

  if (emulatorHost) {
    console.log(`🔥 Using Firestore Emulator: ${emulatorHost}`);
    admin.initializeApp({ projectId: projectIdFromEnv });
    const db = admin.firestore();
    db.settings({ host: emulatorHost, ssl: false });
    return admin.app();
  }

  const servicePath = path.resolve(
    process.cwd(),
    process.env.GOOGLE_APPLICATION_CREDENTIALS || ""
  );
  if (!fs.existsSync(servicePath)) {
    console.error("❌ Missing service account JSON:", servicePath);
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(servicePath, "utf8"));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id || projectIdFromEnv,
  });
  console.log(`☁️ Firebase initialized (projectId=${serviceAccount.project_id})`);
  return admin.app();
}

initFirebase();
const db = admin.firestore();

// -----------------------------------------------------------------------------
// Express setup
// -----------------------------------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Routes
app.use("/auth", authRoutes(db));
app.use("/vehicle", authenticate, vehicleRoutes(db));
app.use("/routes", authenticate, routeRoutes(db));
app.use("/feedback", authenticate, feedbackRoutes(db));
app.use("/admin", authenticate, adminRoutes(db));
app.use("/driver", driverRoutes(db)); // driver handles own auth logic

console.log("🛠️ Routes loaded successfully.");

// -----------------------------------------------------------------------------
// Start server + WebSocket
// -----------------------------------------------------------------------------
const PORT = process.env.PORT || 5001;
const server = app.listen(PORT, () =>
  console.log(`🚀 Backend running on http://192.168.0.156:${PORT}`)
);

const wss = new WebSocketServer({ server, path: "/ws" });

// ✅ Role-aware WebSocket tracking (fixed robust parsing)
wss.on("connection", (ws, req) => {
  let userRole = "unknown";
  let clientIp =
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.socket.remoteAddress ||
    "unknown";

  try {
    // ✅ Works even when behind proxies or ngrok
    const fullUrl = req.url || "";
    const queryPart = fullUrl.includes("?") ? fullUrl.split("?")[1] : "";
    const queryParams = querystring.parse(queryPart);
    const roleParam = queryParams.role ? String(queryParams.role).toLowerCase().trim() : "unknown";

    if (["user", "driver", "admin"].includes(roleParam)) {
      userRole = roleParam;
    }
  } catch (err) {
    console.warn("⚠️ Failed to parse WebSocket URL:", err);
  }

  ws.userRole = userRole;
  console.log(`📡 WebSocket connected [role=${userRole}, ip=${clientIp}]`);

  // Send welcome message
  ws.send(
    JSON.stringify({
      type: "welcome",
      data: { role: ws.userRole, ip: clientIp, time: new Date().toISOString() },
    })
  );

  // Periodic vehicle broadcast
  const interval = setInterval(async () => {
    try {
      const snapshot = await db.collection("vehicles").get();
      snapshot.forEach((doc) => {
        const v = doc.data();
        const shaped = {
          id: doc.id,
          vehicle_id: v.plateNo ?? doc.id,
          route_id: v.currentRoute ?? "unknown",
          lat: v.location?.lat ?? 0,
          lng: v.location?.lng ?? 0,
          occupancy: v.occupancy ?? 0,
          capacity: v.capacity ?? 4,
          vacant: (v.capacity ?? 4) - (v.occupancy ?? 0),
          status: v.status ?? "inactive",
          updated_at: v.location?.timestamp
            ? new Date(v.location.timestamp).toISOString()
            : new Date().toISOString(),
        };

        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: "vehicle", data: shaped }));
        }
      });
    } catch (err) {
      console.error("WebSocket broadcast error:", err);
    }
  }, 5001);

  ws.on("close", () => {
    clearInterval(interval);
    console.log(`❌ WebSocket disconnected [role=${ws.userRole}, ip=${clientIp}]`);
  });

  ws.on("error", (err) => {
    console.warn(`⚠️ WebSocket error [role=${ws.userRole}, ip=${clientIp}]:`, err);
  });
});

// Mount alerts routes with wss context
app.use("/alerts", alertsRoutes(db, wss));
console.log("🔔 Alerts route mounted.");

// -----------------------------------------------------------------------------
// Health check
// -----------------------------------------------------------------------------
app.get("/health", async (req, res) => {
  try {
    await db.collection("__healthcheck__").limit(1).get();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export { db, wss };
