/**
 * src/api/client.ts
 * FINAL MERGED VERSION ✅
 * - Keeps all telemetry & REST endpoints
 * - Delegates all WebSocket subscriptions (vehicles/alerts) to ws.ts (role-aware)
 */

import axios from "axios";
import Constants from "expo-constants";
import { endpoints } from "./endpoints";
import { API, LoginRequest, LoginResponse } from "./types";
import { Route, Vehicle, NextArrival } from "../types";
import { wsConnect } from "./ws"; // ✅ NEW unified WS handler

// =============================================
// 💫 NGROK / BACKEND CONFIGURATION
// =============================================

const NGROK_BACKEND = "https://derick-unmentionable-overdistantly.ngrok-free.dev";
const LOCAL_API_URL = "http://10.24.240.85:5001";

const API_BASE_URL =
  NGROK_BACKEND && NGROK_BACKEND.trim() !== ""
    ? NGROK_BACKEND
    : Constants?.expoConfig?.extra?.API_BASE_URL || LOCAL_API_URL;

const WS_URL =
  API_BASE_URL.replace(/^https?:/, API_BASE_URL.startsWith("https") ? "wss:" : "ws:") + "/ws";

// =============================================
// ⚡ AXIOS INSTANCE + AUTH TOKEN HANDLING
// =============================================

const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

let token: string | null = null;

export const setToken = (t: string | null) => {
  token = t;
};

http.interceptors.request.use((config) => {
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// =============================================
// 🚀 API CLIENT IMPLEMENTATION
// =============================================

export const apiClient: API & {
  loginDriver?: (body: { email: string; password: string }) => Promise<LoginResponse>;
  sendTelemetry?: (body: any) => Promise<any>;
  updateOccupancy?: (body: any) => Promise<any>;
  controlTrip?: (body: any) => Promise<any>;
  getAlerts?: () => Promise<any[]>;
  subscribeAlerts?: (cb: (alert: any) => void) => void;
} = {
  // USER LOGIN
  async login(body: LoginRequest) {
    const { data } = await http.post<LoginResponse>(endpoints.login, body);
    return data;
  },

  // DRIVER LOGIN
  async loginDriver(body) {
    const { data } = await http.post<LoginResponse>("/auth/driver/login", body);
    return data;
  },

  // ROUTES
  async getRoutes() {
    const { data } = await http.get<Route[]>(endpoints.routes);
    return data;
  },

  // VEHICLES
  async getVehicles() {
    const { data } = await http.get<Vehicle[]>(endpoints.vehicles);
    return data;
  },

  // NEXT ARRIVALS
  async getNextArrivals() {
    const { data } = await http.get<NextArrival[]>(endpoints.nextArrivals);
    return data;
  },

  // ✅ VEHICLE WEBSOCKET SUBSCRIPTION (via ws.ts)
  async subscribeVehicles(cb) {
    console.log("🚘 [WS] Subscribing to vehicles via ws.ts ...");
    const disconnect = await wsConnect((msg) => {
      if (msg.type === "vehicle") cb(msg);
    });
    return disconnect;
  },

  // ✅ ALERTS SUBSCRIPTION (via ws.ts)
  async subscribeAlerts(cb) {
    console.log("🔔 [WS] Subscribing to alerts via ws.ts ...");
    const disconnect = await wsConnect((msg) => {
      if (msg.type === "alert") cb(msg);
    });
    return disconnect;
  },

  // DRIVER TELEMETRY
  async sendTelemetry(body) {
    const { data } = await http.post("/driver/telemetry", body);
    return data;
  },

  // DRIVER OCCUPANCY
  async updateOccupancy(body) {
    const { data } = await http.post("/driver/occupancy", body);
    return data;
  },

  // DRIVER TRIP CONTROL
  async controlTrip(body) {
    const { data } = await http.post("/driver/trip", body);
    return data;
  },

  // ✅ ALERTS (REST fallback)
  async getAlerts() {
    const { data } = await http.get("/alerts");
    return data;
  },
};

// =============================================
// 🧠 Debug Log (for verification)
// =============================================
console.log("[API] Using base URL:", API_BASE_URL);
console.log("[WS] Using WebSocket URL:", WS_URL);
