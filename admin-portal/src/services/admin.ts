// admin-portal/src/services/admin.ts
import axios from "axios";

// ==========================================================
// 🌐 BASE API CONFIG
// ==========================================================
const rawEnv =
  (import.meta as any)?.env?.VITE_API_BASE &&
  String((import.meta as any).env.VITE_API_BASE).trim();

const DEFAULT_LOCAL = "https://derick-unmentionable-overdistantly.ngrok-free.dev";

const API_BASE = rawEnv && rawEnv.length > 0 ? rawEnv : DEFAULT_LOCAL;
const IS_NGROK = /ngrok/i.test(API_BASE);

console.log("[Admin API] baseURL =", API_BASE);

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
    ...(IS_NGROK ? { "ngrok-skip-browser-warning": "true" } : {}),
  },
  timeout: 15000,
  withCredentials: false,
});

// ==========================================================
// 🔐 AUTH TOKEN HANDLING
// ==========================================================
export function setAuthToken(token?: string) {
  if (token) {
    localStorage.setItem("admin_token", token);
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    localStorage.removeItem("admin_token");
    delete api.defaults.headers.common["Authorization"];
  }
}

api.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem("admin_token") ||
      sessionStorage.getItem("admin_token");

    if (token) {
      config.headers = config.headers || {};
      (config.headers as any).Authorization = `Bearer ${token}`;
    }

    (config.headers as any)["ngrok-skip-browser-warning"] = "true";
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error(
      "[Admin API error]",
      error?.config?.method?.toUpperCase(),
      error?.config?.url,
      error?.message
    );
    return Promise.reject(error);
  }
);

// ==========================================================
// 👥 AUTH
// ==========================================================
export const adminLogin = (payload: { email: string; password: string }) =>
  api.post("/auth/admin/login", payload);

// ==========================================================
// 🧑‍✈️ DRIVERS
// ==========================================================
export const fetchDrivers = async (): Promise<
  Array<{ id: string; name?: string; email?: string }>
> => {
  const res = await api.get("/admin/drivers");
  const raw = res.data;
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.drivers)) return raw.drivers;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.items)) return raw.items;
  if (raw && typeof raw === "object") return Object.values(raw);
  return [];
};

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
export const fetchVehicles = async (): Promise<Array<any>> => {
  const res = await api.get("/vehicle");
  const raw = res.data;
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.vehicles)) return raw.vehicles;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.items)) return raw.items;
  if (raw && typeof raw === "object") return Object.values(raw);
  return [];
};

export const updateVehicleCapacity = async (
  id: string,
  capacity: number
): Promise<void> => {
  await api.patch(`/vehicle/${id}/capacity`, { capacity });
};

// ==========================================================
// 📊 ADMIN ANALYTICS (existing, used by Dashboard)
// ==========================================================
export const fetchReports = () => api.get("/admin/analytics");

// ==========================================================
// 📈 TRIP REPORTING (reports page)
// ==========================================================
type ReportParams = {
  from?: string;
  to?: string;
  line_id?: string;
  direction?: "to" | "fro" | string;
};

export const getReportSummary = (params: ReportParams) =>
  api.get("/reports/summary", { params });

export const getReportTemporal = (params: ReportParams) =>
  api.get("/reports/temporal", { params });

export const getReportGeo = (params: ReportParams) =>
  api.get("/reports/geo", { params });

export const getReportDrivers = (params: ReportParams) =>
  api.get("/reports/drivers", { params });

export const getReportAnomalies = (params: ReportParams) =>
  api.get("/reports/anomalies", { params });

export const getReportForecast = () => api.get("/reports/forecast");

// ==========================================================
// 👤 USERS
// ==========================================================
export const fetchUsers = async (): Promise<Array<any>> => {
  const res = await api.get("/auth/users");
  const raw = res.data;
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.users)) return raw.users;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.items)) return raw.items;
  if (raw && typeof raw === "object") return Object.values(raw);
  return [];
};

// ==========================================================
// 🔔 NOTIFICATIONS / ALERTS
// ==========================================================
export const fetchNotifications = () => api.get("/alerts");

export const createAlert = (payload: {
  message: string;
  route_id?: string;
  vehicle_id?: string;
  type?: string;
  target?: "users" | "drivers" | "all";
}) => api.post("/alerts", payload);

export const deleteAlert = (id: string) => api.delete(`/alerts/${id}`);

export const resolveAlert = (id: string) =>
  api.patch(`/alerts/${id}/resolve`);

export default api;

// ==========================================================
// 🗣 FEEDBACK
// ==========================================================
export const getAllFeedback = async (): Promise<
  Array<{ id: string; vehicle_id: string; rating: number; comment: string; timestamp: string }>
> => {
  const res = await api.get("/feedback");
  const raw = res.data;
  if (Array.isArray(raw)) return raw;
  return [];
};