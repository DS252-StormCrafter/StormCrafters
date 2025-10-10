// admin-portal/src/routes/Notifications.tsx
import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  fetchNotifications,
  createAlert,
  deleteAlert,
  resolveAlert,
} from "../services/admin";

const WS_URL =
  (import.meta.env.VITE_API_BASE || "http://10.24.240.179:5001").replace(/^http/, "ws") +
  "/ws";

export default function Notifications() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState<"users" | "drivers" | "all">("all");
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [filterTarget, setFilterTarget] = useState<"all" | "users" | "drivers">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "resolved">("all");
  const [searchText, setSearchText] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  const loadAlerts = async () => {
    try {
      const res = await fetchNotifications();
      const arr = Array.isArray(res.data) ? res.data : [];
      setAlerts(arr);
    } catch (err) {
      console.error("❌ Failed to fetch alerts:", err);
    }
  };

  useEffect(() => {
    if (wsRef.current) wsRef.current.close();
    const token = localStorage.getItem("token");
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("🔔 WS connected (admin)");
      setConnected(true);
      if (token) ws.send(JSON.stringify({ type: "auth", token }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const type = msg.type?.toLowerCase();
        const data = msg.data || {};

        if (type === "alert_created" || type === "alert") {
          console.log("📥 New alert via WS:", data);
          setAlerts((prev) => {
            if (prev.some((a) => a.id === data.id)) return prev; // avoid duplicates
            return [{ ...data, id: data.id || Date.now().toString() }, ...prev];
          });
        } else if (type === "alert_resolved") {
          setAlerts((prev) =>
            prev.map((a) =>
              a.id === data.id ? { ...a, resolved: true } : a
            )
          );
        } else if (type === "alert_deleted") {
          setAlerts((prev) => prev.filter((a) => a.id !== data.id));
        }
      } catch (err) {
        console.warn("⚠️ WS parse error:", err);
      }
    };

    ws.onclose = () => {
      console.warn("🔕 WS disconnected");
      setConnected(false);
    };
    ws.onerror = (err) => console.warn("⚠️ WS error:", err);

    loadAlerts();
    return () => ws.close();
  }, []);

  const sendAlert = async () => {
    if (!message.trim()) return alert("⚠️ Message is required");
    setLoading(true);
    try {
      const res = await createAlert({ message, target });
      const id = res?.data?.id;
      const newAlert = {
        id: id || Date.now().toString(),
        message,
        target,
        resolved: false,
        createdAt: new Date().toISOString(),
      };

      setAlerts((prev) => {
        if (prev.some((a) => a.id === newAlert.id)) return prev;
        return [newAlert, ...prev];
      });

      setMessage("");
      alert("✅ Alert sent successfully");
    } catch (err) {
      console.error("❌ Failed to send alert:", err);
      alert("Failed to send alert. Check console.");
    } finally {
      setLoading(false);
    }
  };

  const markResolved = async (id: string) => {
    try {
      await resolveAlert(id);
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, resolved: true } : a))
      );
    } catch (err) {
      console.error("❌ Failed to resolve alert:", err);
    }
  };

  const removeAlert = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this alert?")) return;
    try {
      await deleteAlert(id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error("❌ Failed to delete alert:", err);
    }
  };

  const filteredAlerts = useMemo(() => {
    return alerts
      .filter((a) =>
        filterTarget === "all" ? true : a.target === filterTarget
      )
      .filter((a) =>
        filterStatus === "all"
          ? true
          : filterStatus === "active"
          ? !a.resolved
          : a.resolved
      )
      .filter((a) =>
        searchText
          ? a.message.toLowerCase().includes(searchText.toLowerCase())
          : true
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }, [alerts, filterTarget, filterStatus, searchText]);

  return (
    <div style={{ padding: 20 }}>
      <h2>🔔 System Alerts</h2>

      <div className="card form-row" style={{ marginBottom: 12 }}>
        <input
          placeholder="Alert message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <select value={target} onChange={(e) => setTarget(e.target.value as any)}>
          <option value="all">All (Users & Drivers)</option>
          <option value="users">Users only</option>
          <option value="drivers">Drivers only</option>
        </select>
        <button className="btn" onClick={sendAlert} disabled={loading}>
          {loading ? "Sending..." : "Send Alert"}
        </button>
      </div>

      <div className="card form-row" style={{ marginBottom: 12 }}>
        <select
          value={filterTarget}
          onChange={(e) => setFilterTarget(e.target.value as any)}
        >
          <option value="all">All</option>
          <option value="users">Users</option>
          <option value="drivers">Drivers</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="resolved">Resolved</option>
        </select>

        <input
          placeholder="Search..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <span>{connected ? "🟢 Live" : "🔴 Offline"}</span>
      </div>

      <div className="card">
        <h3>Alerts ({filteredAlerts.length})</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>Message</th>
              <th>Target</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAlerts.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center" }}>
                  No alerts found
                </td>
              </tr>
            ) : (
              filteredAlerts.map((a) => (
                <tr
                  key={a.id}
                  style={{
                    background: a.resolved ? "#e8ffe8" : "#fff",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  <td>{a.message}</td>
                  <td>{a.target || "all"}</td>
                  <td style={{ color: a.resolved ? "#16a34a" : "#dc2626" }}>
                    {a.resolved ? "Resolved ✅" : "Active ⚠️"}
                  </td>
                  <td>
                    {a.createdAt
                      ? new Date(a.createdAt).toLocaleString()
                      : "-"}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {!a.resolved && (
                      <button
                        className="btn"
                        style={{ background: "#16a34a", marginRight: 5 }}
                        onClick={() => markResolved(a.id)}
                      >
                        Resolve
                      </button>
                    )}
                    <button
                      className="btn"
                      style={{ background: "#dc2626" }}
                      onClick={() => removeAlert(a.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
