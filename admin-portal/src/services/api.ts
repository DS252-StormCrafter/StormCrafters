// admin-portal/src/services/api.ts
import axios from "axios";

const API = "http://10.81.30.77:5001"; // Or your deployed backend

const api = axios.create({
  baseURL: API,
  headers: {
    "Content-Type": "application/json",
  },
});

// Example wrappers
export const getDrivers = () => api.get("/admin/drivers");
export const createDriver = (data: any) => api.post("/admin/drivers", data);
export const deleteDriver = (id: string) => api.delete(`/admin/drivers/${id}`);

export const getVehicles = () => api.get("/vehicle");
export const getUsers = () => api.get("/auth/users"); // adjust based on backend
export const getReports = () => api.get("/admin/analytics");
export const getNotifications = () => api.get("/alerts");

export default api;
