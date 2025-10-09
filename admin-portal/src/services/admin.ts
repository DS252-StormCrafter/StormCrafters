// admin-portal/src/services/admin.ts
import axios from "axios";

// ==========================================================
// 🌐 BASE API CONFIG
// ==========================================================
const API = import.meta.env.VITE_API_BASE || "http://10.81.30.75:5001";

const api = axios.create({
  baseURL: API,
  headers: { "Content-Type": "application/json" },
});

// ==========================================================
// 🔐 AUTH TOKEN HANDLING
// ==========================================================

// ✅ Legacy-compatible token setter (used by Drivers.tsx and others)
export function setAuthToken(token?: string) {
  if (token) {
    localStorage.setItem("admin_token", token);
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    localStorage.removeItem("admin_token");
    delete api.defaults.headers.common["Authorization"];
  }
}

// ✅ Auto-attach token from localStorage or sessionStorage
api.interceptors.request.use((config) => {
  const token =
    localStorage.getItem("admin_token") ||
    sessionStorage.getItem("admin_token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ==========================================================
// 👥 AUTH
// ==========================================================
export const adminLogin = (payload: { email: string; password: string }) =>
  api.post("/auth/admin/login", payload);

// ==========================================================
// 🧑‍✈️ DRIVERS
// ==========================================================
export const fetchDrivers = () => api.get("/admin/drivers");

export const createDriver = (payload: {
  name: string;
  email: string;
  password: string;
}) => api.post("/admin/drivers", payload);

export const updateDriver = (
  id: string,
  payload: Partial<{ name: string; email: string; password: string }>
) => api.put(`/admin/drivers/${id}`, payload);

export const deleteDriver = (id: string) => api.delete(`/admin/drivers/${id}`);

// ==========================================================
// 🚍 VEHICLES
// ==========================================================
export const fetchVehicles = () => api.get("/vehicle");

// ==========================================================
// 📊 REPORTS
// ==========================================================
export const fetchReports = () => api.get("/admin/analytics");

// ==========================================================
// 👤 USERS
// ==========================================================
export const fetchUsers = () => api.get("/auth/users");

// ==========================================================
// 🔔 NOTIFICATIONS / ALERTS
// ==========================================================
export const fetchNotifications = () => api.get("/alerts");

// ✅ Create new alert
export const createAlert = (payload: {
  message: string;
  route_id?: string;
  vehicle_id?: string;
  type?: string;
  target?: "users" | "drivers" | "all";
}) => api.post("/alerts", payload);

// ✅ Delete alert
export const deleteAlert = (id: string) => api.delete(`/alerts/${id}`);

// ✅ Resolve alert
export const resolveAlert = (id: string) => api.patch(`/alerts/${id}/resolve`);

// ==========================================================
// 🧩 DEFAULT EXPORT (optional for convenience)
// ==========================================================
export default api;
