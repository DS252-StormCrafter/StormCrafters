// src/api/ws.ts
/**
 * Simple WebSocket wrapper for real-time vehicle updates.
 * - Automatically connects to backend /ws
 * - Reconnects if connection drops
 * - Calls `onMessage(data)` whenever a message is received
 * - Automatically unwraps nested { type, data } payloads
 * - Skips invalid packets safely (no app crash)
 */

const DEFAULT_API = "http://10.217.26.188:5001"; // ✅ replace with your backend IP or use env
const WS_RETRY_INTERVAL = 5000;

export function wsConnect(onMessage: (data: any) => void) {
  let ws: WebSocket | null = null;
  const wsUrl = DEFAULT_API.replace(/^http/, "ws") + "/ws";

  function connect() {
    ws = new WebSocket(wsUrl);
    console.log("🌐 Connecting to WebSocket:", wsUrl);

    ws.onopen = () => console.log("✅ WebSocket connected");

    ws.onerror = (err) => {
      console.warn("⚠️ WebSocket error:", err);
    };

    ws.onclose = (evt) => {
      console.warn(`❌ WebSocket closed (code ${evt.code}). Reconnecting in ${WS_RETRY_INTERVAL / 1000}s...`);
      setTimeout(connect, WS_RETRY_INTERVAL);
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);

        // ✅ Unwrap backend payloads like { type: "vehicle", data: {...} }
        const payload = msg?.data ?? msg;

        if (!payload || typeof payload !== "object") {
          console.warn("⚠️ Ignoring malformed WS packet:", msg);
          return;
        }

        // ✅ Basic coordinate sanity check
        const lat = payload.lat ?? payload.location?.lat;
        const lng = payload.lng ?? payload.location?.lng;
        if (typeof lat !== "number" || typeof lng !== "number") {
          console.warn("⚠️ Skipping packet with invalid coords:", payload);
          return;
        }

        onMessage(payload);
      } catch (err) {
        console.warn("⚠️ WebSocket parse error:", err);
      }
    };
  }

  // Start connection
  connect();

  // Return cleanup function
  return () => {
    if (ws) {
      console.log("🔌 WebSocket connection closed manually.");
      ws.close();
      ws = null;
    }
  };
}
