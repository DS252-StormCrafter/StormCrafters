/**
 * TransVahan WebSocket client (FINAL VERIFIED VERSION ✅)
 * Fixes missing ?role parameter and guarantees auth delivery
 */

import NetInfo from "@react-native-community/netinfo";
import AsyncStorage from "@react-native-async-storage/async-storage";

console.log("🚀 [TransVahan WS] FINAL QUEUED VERSION ACTIVE");

const DEFAULT_API = "https://derick-unmentionable-overdistantly.ngrok-free.dev";
const WS_RETRY_INTERVAL = 5000;

let currentWs: WebSocket | null = null;
let isConnecting = false;
let reconnectTimer: NodeJS.Timeout | null = null;

/* ---------------------------------------------------------- */
/* Utility functions                                           */
/* ---------------------------------------------------------- */

async function detectRole(): Promise<"user" | "driver" | "admin"> {
  try {
    // 🚀 Step 1: check if last login endpoint shows driver
    const lastLoginUrl = await AsyncStorage.getItem("last_login_endpoint");
    if (lastLoginUrl?.includes("/driver/login")) {
      console.log("🟢 Role inferred from last_login_endpoint: driver");
      return "driver";
    }

    // 🚀 Step 2: check stored user object
    const userJson = await AsyncStorage.getItem("auth_user");
    if (userJson) {
      const user = JSON.parse(userJson);
      const raw =
        (
          user?.role ||
          user?.type ||
          user?.roleName ||
          user?.userRole ||
          user?.category ||
          ""
        )
          .toString()
          .toLowerCase()
          .trim() || "user";

      if (["driver", "drivers"].includes(raw)) {
        console.log("🟢 Detected role from storage: driver");
        return "driver";
      }
      if (["admin", "admins"].includes(raw)) {
        console.log("🟣 Detected role from storage: admin");
        return "admin";
      }
      console.log("🔵 Defaulting to role=user from storage");
      return "user";
    }

    console.log("🔵 Defaulting to role=user (no stored user)");
    return "user";
  } catch (err) {
    console.warn("⚠️ detectRole error:", err);
    return "user";
  }
}

async function getAuthToken(): Promise<string | null> {
  try {
    const keys = ["auth_token", "token", "accessToken", "jwt"];
    for (const k of keys) {
      const v = await AsyncStorage.getItem(k);
      if (v) return v;
    }

    const userJson = await AsyncStorage.getItem("auth_user");
    if (userJson) {
      const user = JSON.parse(userJson);
      return (
        user?.token ||
        user?.authToken ||
        user?.accessToken ||
        user?.jwt ||
        user?.idToken ||
        null
      );
    }

    return null;
  } catch (err) {
    console.warn("⚠️ getAuthToken error:", err);
    return null;
  }
}

/* ---------------------------------------------------------- */
/* Main connection logic                                       */
/* ---------------------------------------------------------- */

export async function wsConnect(onMessage: (data: any) => void) {
  const role = await detectRole();
  const token = await getAuthToken();

  // ✅ Ensure role param is actually appended
  const wsUrl =
    DEFAULT_API.replace(/^http/, "ws") +
    `/ws?role=${encodeURIComponent(role)}`;

  console.log("🌐 WS URL Built:", wsUrl);

  const messageQueue: string[] = [];

  function sendSafe(obj: any) {
    const msg = JSON.stringify(obj);
    if (currentWs && currentWs.readyState === WebSocket.OPEN) {
      currentWs.send(msg);
      console.log("📨 Sent:", msg);
    } else {
      console.log("⌛ Queued:", msg);
      messageQueue.push(msg);
    }
  }

  function flushQueue() {
    if (currentWs && currentWs.readyState === WebSocket.OPEN) {
      while (messageQueue.length > 0) {
        const msg = messageQueue.shift();
        if (msg) {
          currentWs.send(msg);
          console.log("📤 Flushed:", msg);
        }
      }
    }
  }

  function connect() {
    if (isConnecting) return;
    isConnecting = true;

    try {
      currentWs = new WebSocket(wsUrl);
    } catch (err) {
      console.warn("❌ WS init failed:", err);
      isConnecting = false;
      return;
    }

    currentWs.onopen = () => {
      console.log(`✅ WS connected (role=${role})`);
      isConnecting = false;
      sendSafe({ type: "auth", token });
      setTimeout(flushQueue, 500);
    };

    currentWs.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        const payload = msg?.data ?? msg;

        if (msg.type === "auth_ack" && msg.success) {
          console.log(`🔓 Auth acknowledged (role=${msg.role})`);
          flushQueue();
          return;
        }

        if (msg.type === "alert") {
          const target = (payload.target || "all").toString().toLowerCase();
          if (
            (target === "users" && role !== "user") ||
            (target === "drivers" && role !== "driver")
          )
            return;
        }

        if (msg.type === "vehicle") {
          const lat = payload.lat ?? payload.location?.lat;
          const lng = payload.lng ?? payload.location?.lng;
          if (typeof lat !== "number" || typeof lng !== "number") return;
        }

        onMessage({ type: msg.type, ...payload });
      } catch (err) {
        console.warn("⚠️ WS parse error:", err);
      }
    };

    currentWs.onerror = (err) => {
      console.warn("⚠️ WS error:", err);
    };

    currentWs.onclose = (evt) => {
      console.warn(`❌ WS closed (${evt.code})`);
      isConnecting = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, WS_RETRY_INTERVAL);
    };
  }

  connect();

  const unsubscribe = NetInfo.addEventListener((s) => {
    if (s.isConnected) {
      console.log("🌍 Network reconnected → reconnecting WS");
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, 1000);
    }
  });

  return () => {
    console.log("🔌 Closing WS manually");
    currentWs?.close();
    unsubscribe();
  };
}
