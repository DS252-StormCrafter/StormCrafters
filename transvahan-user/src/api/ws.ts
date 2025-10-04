// src/api/ws.ts
/**
 * Simple WebSocket wrapper for real-time vehicle updates.
 * - Automatically connects to backend /ws
 * - Reconnects if connection drops
 * - Calls `onMessage(data)` whenever a message is received
 */

const DEFAULT_API = "http://10.81.30.77:5000"; // ✅ replace with your backend IP or use env

export function wsConnect(onMessage: (data: any) => void) {
  let ws: WebSocket | null = null;
  const wsUrl = DEFAULT_API.replace(/^http/, "ws") + "/ws";

  function connect() {
    ws = new WebSocket(wsUrl);
    console.log("🌐 Connecting to WebSocket:", wsUrl);

    ws.onopen = () => console.log("✅ WebSocket connected");
    ws.onerror = (err) => console.warn("⚠️ WS error:", err);
    ws.onclose = () => {
      console.log("❌ WS closed, retrying in 5s...");
      setTimeout(connect, 5000);
    };

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        onMessage(data);
      } catch (err) {
        console.warn("WS parse error", err);
      }
    };
  }

  connect();

  // return cleanup function
  return () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
      console.log("🔌 WebSocket connection closed manually.");
    }
  };
}
