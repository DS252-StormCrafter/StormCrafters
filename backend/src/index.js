/**
 * backend/src/index.js
 * FINAL — WebSocket auth-first approach (ready to paste)
 *
 * - Waits for initial { type: 'auth', token: '...' } message from client
 * - Verifies JWT and sets ws.userRole from token (role|userRole|type)
 * - Falls back to ?role= or /ws/:role or header if auth not sent in timeout
 * - Keeps all previous features intact (vehicle broadcast, alerts route, etc.)
 */

import express from "express";
import admin from "firebase-admin";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import { WebSocketServer } from "ws";
import * as querystring from "querystring";
import jwt from "jsonwebtoken";
import { authenticate } from "./middleware/auth.js";

import authRoutes from "./routes/auth.js";
import vehicleRoutes from "./routes/vehicle.js";
import routeRoutes from "./routes/route.js";
import feedbackRoutes from "./routes/feedback.js";
import alertsRoutes from "./routes/alerts.js";
import adminRoutes from "./routes/admin.js";
import driverRoutes from "./routes/driver.js";

// -----------------------------------------------------------------------------
// Environment + Firebase
// -----------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

function initFirebase() {
  if (admin.apps.length) return admin.app();

  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST?.trim();
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim() || "midterm-transvahan";

  if (emulatorHost) {
    console.log(`🔥 Using Firestore Emulator: ${emulatorHost}`);
    admin.initializeApp({ projectId });
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
    projectId: serviceAccount.project_id || projectId,
  });
  console.log(`☁️ Firebase initialized (projectId=${serviceAccount.project_id})`);
  return admin.app();
}

initFirebase();
const db = admin.firestore();

// -----------------------------------------------------------------------------
// Express setup (unchanged behavior)
 // -----------------------------------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use("/auth", authRoutes(db));
app.use("/vehicle", authenticate, vehicleRoutes(db));
app.use("/routes", authenticate, routeRoutes(db));
app.use("/feedback", authenticate, feedbackRoutes(db));
app.use("/admin", authenticate, adminRoutes(db));
app.use("/driver", driverRoutes(db));

console.log("🛠️ Routes loaded successfully.");

// -----------------------------------------------------------------------------
// HTTP + WebSocket Server
// -----------------------------------------------------------------------------
const PORT = process.env.PORT || 5001;
const server = app.listen(PORT, () =>
  console.log(`🚀 Backend running on http://192.168.0.156:${PORT}`)
);

const wss = new WebSocketServer({ noServer: true });

// Upgrade handler: still capture role from path/query if present (used as fallback)
server.on("upgrade", (req, socket, head) => {
  try {
    const url = req.url || "";
    let rawRole = "";

    // 1) path style /ws/driver
    const pathMatch = (url || "").match(/^\/ws\/([a-z]+)/i);
    if (pathMatch) rawRole = pathMatch[1];

    // 2) fallback query ?role=driver
    if (!rawRole && url.includes("?")) {
      const parsed = querystring.parse(url.split("?")[1]);
      rawRole = parsed.role ? String(parsed.role).toLowerCase().trim() : "";
    }

    // 3) fallback header x-user-role (if any)
    const headerRaw = req.headers["x-user-role"]
      ? String(req.headers["x-user-role"]).toLowerCase().trim()
      : "";

    const candidate = rawRole || headerRaw || "";
    req.roleParam = ["user", "driver"].includes(candidate) ? candidate : "user";
  } catch (err) {
    req.roleParam = "user";
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});

// -----------------------------------------------------------------------------
// WebSocket connection handler — FINAL FIXED VERSION ✅
// -----------------------------------------------------------------------------
wss.on("connection", (ws, req) => {
  let roleGuess = req.roleParam || "user";
  const clientIp =
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.socket.remoteAddress ||
    "unknown";

  let broadcastInterval = null;
  let authTimer = null;
  let authenticated = false;

  const startBroadcast = () => {
    if (broadcastInterval) return;

    // ✅ Persist role on multiple known keys for detectClientRole
    ws.userRole = roleGuess;
    ws.role = ws.userRole;
    ws._roleHint = ws.userRole;

    console.log(`📡 WebSocket connected [role=${ws.userRole}, ip=${clientIp}]`);

    try {
      ws.send(
        JSON.stringify({
          type: "welcome",
          data: { role: ws.userRole, ip: clientIp, time: new Date().toISOString() },
        })
      );
    } catch (e) {}

    broadcastInterval = setInterval(async () => {
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
  };

  authTimer = setTimeout(() => {
    if (!authenticated) {
      console.log(
        `⏱️ Auth timeout — no auth message received. Proceeding with guessed role=${roleGuess} for ip=${clientIp}`
      );
      startBroadcast();
    }
  }, 4000);

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (!msg || typeof msg !== "object") return;

      if (msg.type === "auth") {
        clearTimeout(authTimer);
        const token = msg.token || msg.jwt || msg.authToken;
        if (!token) {
          console.log("⚠️ WS auth message missing token — proceeding with guess role.");
          startBroadcast();
          return;
        }

        try {
          const secret = process.env.JWT_SECRET || "secret";
          const decoded = jwt.verify(token, secret);

          const tokenRole = (decoded.role || decoded.userRole || decoded.type || "")
            .toString()
            .toLowerCase()
            .trim();

          if (["driver", "user", "admin"].includes(tokenRole)) {
            roleGuess = tokenRole;
          }

          ws.user = decoded;
          ws.userRole = roleGuess;
          ws.role = ws.userRole;
          ws._roleHint = ws.userRole;
          authenticated = true;

          ws.send(
            JSON.stringify({
              type: "auth_ack",
              success: true,
              role: ws.userRole,
            })
          );

          console.log(`🔐 Authenticated WS [role=${ws.userRole}, ip=${clientIp}] via token`);
        } catch (err) {
          console.warn("❌ WS token verification failed:", err.message);
          ws.send(
            JSON.stringify({ type: "auth_ack", success: false, error: "invalid_token" })
          );
        } finally {
          startBroadcast();
        }
        return;
      }

      if (msg.type === "ping") {
        ws.send(JSON.stringify({ type: "pong", time: Date.now() }));
        return;
      }
    } catch (err) {
      console.warn("⚠️ WS message parse error:", err);
    }
  });

  ws.on("close", () => {
    if (authTimer) clearTimeout(authTimer);
    if (broadcastInterval) clearInterval(broadcastInterval);
    console.log(`❌ WebSocket disconnected [role=${ws.userRole}, ip=${clientIp}]`);
  });

  ws.on("error", (err) => {
    console.warn(`⚠️ WebSocket error [ip=${clientIp}]:`, err);
  });
});


// -----------------------------------------------------------------------------
// Alerts mount (unchanged)
 // -----------------------------------------------------------------------------

// create the router only once (so it shares same wss reference)
const alertsRouter = alertsRoutes(db, wss);
app.use("/alerts", alertsRouter);

console.log("🔔 Alerts route mounted (persistent instance).");

// -----------------------------------------------------------------------------
// Health check (unchanged)
 // -----------------------------------------------------------------------------
app.get("/health", async (req, res) => {
  try {
    // just ping a normal collection instead
    await db.collection("users").limit(1).get();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});


export { db, wss };
