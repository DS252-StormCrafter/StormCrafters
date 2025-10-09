/**
 * transvahan-user/src/api/ws.ts
 * FINAL DEFENSIVE ROLE-STRICT VERSION ✅
 * - Prevents reconnect storms
 * - Authenticates using JWT
 * - Filters alerts based on role
 * - Normalizes messages from backend
 */

import NetInfo from "@react-native-community/netinfo";
import AsyncStorage from "@react-native-async-storage/async-storage";

console.log("🚀 [TransVahan WS] DEFENSIVE NORMALIZER ACTIVE");

const DEFAULT_API = "https://derick-unmentionable-overdistantly.ngrok-free.dev";
const WS_RETRY_INTERVAL = 5000;

let currentWs: WebSocket | null = null;
let isConnecting = false;
let reconnectTimer: NodeJS.Timeout | null = null;

async function detectRole(): Promise<"user" | "driver" | "admin"> {
  try {
    const lastLoginUrl = await AsyncStorage.getItem("last_login_endpoint");
    if (lastLoginUrl?.includes("/driver/login")) return "driver";
    const userJson = await AsyncStorage.getItem("auth_user");
    if (userJson) {
      const user = JSON.parse(userJson);
      const raw = (
        user?.role ||
        user?.type ||
        user?.roleName ||
        user?.userRole ||
        user?.category ||
        ""
      )
        .toString()
        .toLowerCase()
        .trim();

      if (["driver", "drivers"].includes(raw)) return "driver";
      if (["admin", "admins"].includes(raw)) return "admin";
      return "user";
    }
    return "user";
  } catch {
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
  } catch {
    return null;
  }
}

function normalizeAndFilterMessage(msg: any, role: "user" | "driver" | "admin") {
  if (!msg || typeof msg !== "object") return null;

  let type = (msg.type || "").toString();
  if (type === "alert" || type === "alert_created") type = "alert_created";
  if (type === "alert_resolved") type = "alert_resolved";
  if (type === "alert_deleted") type = "alert_deleted";

  const payload = msg?.data ?? msg;
  const audience = (msg?.audience ?? payload?.target ?? "all").toString().toLowerCase();

  const mismatch =
    (audience === "users" && role !== "user") ||
    (audience === "drivers" && role !== "driver") ||
    (audience === "admins" && role !== "admin");

  if (mismatch) {
    console.log(`🚫 Dropping message type=${type} audience=${audience} for role=${role}`);
    return null;
  }

  return { type, audience, data: payload };
}

export async function wsConnect(onMessage: (data: any) => void) {
  const role = await detectRole();
  const token = await getAuthToken();
  const wsUrl = DEFAULT_API.replace(/^http/, "ws") + `/ws?role=${encodeURIComponent(role)}`;

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
    if (isConnecting) {
      console.log("⏳ Connect already in progress — skipping new attempt");
      return;
    }

    if (currentWs) {
      if (currentWs.readyState === WebSocket.OPEN) {
        console.log("ℹ️ Existing WS already OPEN — reusing it");
        sendSafe({ type: "auth", token });
        setTimeout(flushQueue, 250);
        return;
      }
      if (currentWs.readyState === WebSocket.CONNECTING) {
        console.log("ℹ️ Existing WS CONNECTING — will wait for it");
        return;
      }
    }

    isConnecting = true;

    try {
      currentWs = new WebSocket(wsUrl);
      console.log("🧩 Creating new WebSocket connection...");
    } catch (err) {
      console.warn("❌ WS init failed:", err);
      isConnecting = false;
      return;
    }

    currentWs.onopen = () => {
      console.log(`✅ WS connected (role=${role})`);
      isConnecting = false;
      sendSafe({ type: "auth", token });
      setTimeout(flushQueue, 250);
    };

    currentWs.onmessage = (ev) => {
      try {
        const raw = JSON.parse(ev.data);
        const normalized = normalizeAndFilterMessage(raw, role);
        if (!normalized) return;
        onMessage({
          type: normalized.type,
          data: normalized.data,
          audience: normalized.audience,
        });
      } catch (err) {
        console.warn("⚠️ WS parse error:", err);
      }
    };

    currentWs.onerror = (err) => {
      console.warn("⚠️ WS error:", err);
    };

    currentWs.onclose = (evt) => {
      console.warn(`❌ WS closed (${evt?.code ?? "unknown"})`);
      isConnecting = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, WS_RETRY_INTERVAL);
    };
  }

  connect();

  const netInfoSubscription = NetInfo.addEventListener((s) => {
    if (s.isConnected) {
      console.log("🌍 Network reconnected → reconnecting WS");
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, 1000);
    }
  });

  return () => {
    console.log("🔌 Closing WS manually");
    try {
      currentWs?.close();
    } catch {}
    if (typeof netInfoSubscription === "function") netInfoSubscription();
    else if (netInfoSubscription && typeof netInfoSubscription.remove === "function")
      netInfoSubscription.remove();
  };
}
