/**
 * WebSocket wrapper for real-time updates (vehicles + alerts)
 * - Adds ?role=user|driver|admin in URL
 * - Auto-reconnects on disconnect or network change
 * - Filters malformed packets gracefully
 * - Detects role fallback automatically from global auth state
 * - Filters out alerts not meant for this role
 */

import NetInfo from "@react-native-community/netinfo";
import { getCurrentAuthRole } from "../utils/role"; // optional utility (see below)

const DEFAULT_API = "http://192.168.0.156:5001"; // ✅ your backend IP
const WS_RETRY_INTERVAL = 5000;

let isConnecting = false;
let reconnectTimer: NodeJS.Timeout | null = null;
let currentWs: WebSocket | null = null;

/**
 * Connects to WebSocket with role identification.
 * @param onMessage - callback for WS messages
 * @param role - "user" | "driver" | "admin" (optional, auto-detected if omitted)
 */
export function wsConnect(
  onMessage: (data: any) => void,
  role: "user" | "driver" | "admin" = "user"
) {
  // Normalize role (force lowercase, singular form)
  const normalizeRole = (r: string) => {
    if (!r) return "user";
    const s = r.toLowerCase().trim();
    if (s === "users") return "user";
    if (s === "drivers") return "driver";
    if (s === "admins") return "admin";
    if (!["user", "driver", "admin"].includes(s)) return "user";
    return s;
  };

  const detectedRole = normalizeRole(role || getCurrentAuthRole() || "user");
  const wsUrl =
    DEFAULT_API.replace(/^http/, "ws") +
    `/ws?role=${encodeURIComponent(detectedRole)}`;

  function connect() {
    if (isConnecting) {
      console.log("⏳ Skipping duplicate WebSocket connection attempt...");
      return;
    }

    isConnecting = true;
    currentWs = new WebSocket(wsUrl);
    console.log(`🌐 Connecting to WebSocket [role=${detectedRole}]:`, wsUrl);

    currentWs.onopen = () => {
      console.log(`✅ WebSocket connected as ${detectedRole}`);
      isConnecting = false;
    };

    currentWs.onerror = (err) => {
      console.warn("⚠️ WebSocket error:", err);
    };

    currentWs.onclose = (evt) => {
      isConnecting = false;
      console.warn(
        `❌ WS closed (${evt.code}). Reconnecting in ${
          WS_RETRY_INTERVAL / 1000
        }s...`
      );

      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, WS_RETRY_INTERVAL);
    };

    currentWs.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        const payload = msg?.data ?? msg;

        if (!payload || typeof payload !== "object") {
          console.warn("⚠️ Ignoring malformed WS packet:", msg);
          return;
        }

        // ✅ Filter out alerts not meant for this role
        if (msg.type === "alert") {
          const target = (payload.target || "all").toString().toLowerCase();
          if (
            (target === "users" && detectedRole !== "user") ||
            (target === "drivers" && detectedRole !== "driver")
          ) {
            console.log(
              `🚫 Skipping alert for role mismatch: target=${target}, current=${detectedRole}`
            );
            return;
          }
        }

        // ✅ Skip invalid coords for vehicles
        if (msg.type === "vehicle") {
          const lat = payload.lat ?? payload.location?.lat;
          const lng = payload.lng ?? payload.location?.lng;
          if (typeof lat !== "number" || typeof lng !== "number") {
            console.warn("⚠️ Skipping vehicle with invalid coords:", payload);
            return;
          }
        }

        // ✅ Deliver clean message to consumer callback
        onMessage({ type: msg.type, ...payload });
      } catch (err) {
        console.warn("⚠️ WS parse error:", err);
      }
    };
  }

  // Initial connection
  connect();

  // ✅ Monitor network changes (auto-reconnect when online again)
  const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      console.log("🌍 Network reconnected, re-establishing WebSocket...");
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, 1000);
    }
  });

  // ✅ Cleanup
  return () => {
    console.log("🔌 Closing WebSocket manually.");
    if (currentWs) {
      currentWs.close();
      currentWs = null;
    }
    if (reconnectTimer) clearTimeout(reconnectTimer);
    unsubscribeNetInfo();
  };
}
