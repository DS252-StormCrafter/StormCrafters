import axios from "axios";
const API = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const api = axios.create({
  baseURL: API,
  headers: { "Content-Type": "application/json" }
});

// attach token dynamically via a helper (not on creation)
export function setAuthToken(token?: string) {
  if (token) api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  else delete api.defaults.headers.common["Authorization"];
}

// auth
export const adminLogin = (payload: { email: string; password: string }) => api.post("/auth/admin/login", payload);

// drivers
export const fetchDrivers = () => api.get("/admin/drivers");
export const createDriver = (payload: { name: string; email: string; password: string }) => api.post("/admin/drivers", payload);
export const updateDriver = (id: string, payload: Partial<{ name: string; email: string; password: string }>) => api.put(`/admin/drivers/${id}`, payload);
export const deleteDriver = (id: string) => api.delete(`/admin/drivers/${id}`);

// vehicles
export const fetchVehicles = () => api.get("/vehicle");

// reports
export const fetchReports = () => api.get("/admin/analytics");

// users
export const fetchUsers = () => api.get("/auth/users");

// notifications / alerts
export const fetchNotifications = () => api.get("/alerts");
