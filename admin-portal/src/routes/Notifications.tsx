// admin-portal/src/routes/Notifications.tsx
import React, { useEffect, useState, useMemo } from "react";
import {
  fetchNotifications,
  createAlert,
  deleteAlert,
  resolveAlert,
} from "../services/admin";

// ==========================================================
// 🌐 WebSocket connection for live alerts
// ==========================================================
const WS_URL =
  (import.meta.env.VITE_API_BASE || "http://192.168.0.156:5001").replace(
    /^http/,
    "ws"
  ) + "/ws";

export default function Notifications() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState<"users" | "drivers" | "all">("all");
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);

  const [filterTarget, setFilterTarget] = useState<"all" | "users" | "drivers">(
    "all"
  );
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "resolved">(
    "all"
  );
  const [searchText, setSearchText] = useState("");

  // ==========================================================
  // 🔁 Fetch alerts
  // ==========================================================
  const loadAlerts = async () => {
    try {
      const res = await fetchNotifications();
      setAlerts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("❌ Failed to fetch alerts:", err);
    }
  };

  // ==========================================================
  // 🛰️ Initialize WebSocket for real-time sync
  // ==========================================================
  useEffect(() => {
    loadAlerts();

    const ws = new WebSocket(WS_URL);
    ws.onopen = () => {
      console.log("🔔 WebSocket connected");
      setConnected(true);
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "alert") {
          setAlerts((prev) => [msg.data, ...prev]);
        } else if (msg.type === "alert_deleted") {
          setAlerts((prev) => prev.filter((a) => a.id !== msg.data.id));
        } else if (msg.type === "alert_resolved") {
          setAlerts((prev) =>
            prev.map((a) =>
              a.id === msg.data.id ? { ...a, resolved: true } : a
            )
          );
        }
      } catch (err) {
        console.warn("⚠️ WS parse error:", err);
      }
    };
    ws.onclose = () => {
      console.warn("🔕 WebSocket disconnected");
      setConnected(false);
    };
    ws.onerror = (err) => console.warn("⚠️ WS error:", err);

    return () => ws.close();
  }, []);

  // ==========================================================
  // 📢 Send new alert
  // ==========================================================
  const sendAlert = async () => {
    if (!message.trim()) return alert("⚠️ Message is required");
    setLoading(true);
    try {
      await createAlert({ message, target });
      setMessage("");
      await loadAlerts();
      alert("✅ Alert sent successfully");
    } catch (err) {
      console.error("❌ Failed to send alert:", err);
      alert("Failed to send alert. Check console.");
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================
  // ✅ Resolve & Delete handlers
  // ==========================================================
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

  // ==========================================================
  // 🔍 Filtered + Sorted alerts
  // ==========================================================
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

  // ==========================================================
  // 🧱 UI
  // ==========================================================
  return (
    <div style={{ padding: 20 }}>
      <h2>🔔 System Alerts</h2>

      {/* CREATE */}
      <div className="card form-row" style={{ marginBottom: 12 }}>
        <input
          placeholder="Alert message (e.g., Red Line temporarily down)"
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

      {/* FILTERS */}
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
          placeholder="Search message..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <span>{connected ? "🟢 Live" : "🔴 Offline"}</span>
      </div>

      {/* TABLE */}
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
