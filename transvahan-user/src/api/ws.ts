/**
 * WebSocket wrapper for real-time updates (vehicles + alerts)
 * - Adds ?role=user|driver|admin in URL
 * - Auto-reconnects on disconnect or network change
 * - Filters malformed packets gracefully
 * - Detects role automatically from storage/global context
 * - Filters out alerts not meant for this role
 */

import NetInfo from "@react-native-community/netinfo";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DEFAULT_API = "https://derick-unmentionable-overdistantly.ngrok-free.dev"; // ✅ your backend URL
const WS_RETRY_INTERVAL = 5000;

let isConnecting = false;
let reconnectTimer: NodeJS.Timeout | null = null;
let currentWs: WebSocket | null = null;

/**
 * ✅ Detects the current role from AsyncStorage or global auth context.
 * Falls back to "user" by default.
 */
async function detectRole(): Promise<"user" | "driver" | "admin"> {
  try {
    // 1️⃣ Try persistent storage first (works even after app reload)
    const userJson = await AsyncStorage.getItem("auth_user");
    if (userJson) {
      const user = JSON.parse(userJson);
      if (user?.role === "driver") return "driver";
      if (user?.role === "admin") return "admin";
      return "user";
    }

    // 2️⃣ Try global auth context fallback (during active session)
    const ctx = (globalThis as any).__AUTH_CONTEXT__;
    if (ctx?.isDriver || ctx?.user?.role === "driver") return "driver";
    if (ctx?.user?.role === "admin") return "admin";
    return "user";
  } catch (err) {
    console.warn("⚠️ Role detection fallback:", err);
    return "user";
  }
}

/**
 * Connects to WebSocket with role identification.
 * @param onMessage - callback for WS messages
 */
export async function wsConnect(onMessage: (data: any) => void) {
  const detectedRole = await detectRole();

  const normalizeRole = (r: string) => {
    if (!r) return "user";
    const s = r.toLowerCase().trim();
    if (["users", "user"].includes(s)) return "user";
    if (["drivers", "driver"].includes(s)) return "driver";
    if (["admins", "admin"].includes(s)) return "admin";
    return "user";
  };

  const role = normalizeRole(detectedRole);
  const wsUrl =
    DEFAULT_API.replace(/^http/, "ws") +
    `/ws?role=${encodeURIComponent(role)}`;

  function connect() {
    if (isConnecting) {
      console.log("⏳ Skipping duplicate WebSocket connection attempt...");
      return;
    }

    isConnecting = true;
    currentWs = new WebSocket(wsUrl);
    console.log(`🌐 Connecting to WebSocket [role=${role}]:`, wsUrl);

    currentWs.onopen = () => {
      console.log(`✅ WebSocket connected as ${role}`);
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
            (target === "users" && role !== "user") ||
            (target === "drivers" && role !== "driver") ||
            (target === "admins" && role !== "admin")
          ) {
            console.log(
              `🚫 Skipping alert for role mismatch: target=${target}, current=${role}`
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

        // ✅ Deliver message to consumer
        onMessage({ type: msg.type, ...payload });
      } catch (err) {
        console.warn("⚠️ WS parse error:", err);
      }
    };
  }

  // Initial connection
  connect();

  // ✅ Monitor network state and reconnect automatically
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
