/**
 * src/api/client.ts
 * FINAL MERGED VERSION ✅
 * - Keeps all telemetry & REST endpoints
 * - Automatically attaches JWT to every request (fixes 401)
 * - Delegates all WebSocket subscriptions (vehicles/alerts) to ws.ts (role-aware)
 */

import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { endpoints } from "./endpoints";
import { API, LoginRequest, LoginResponse } from "./types";
import { Route, Vehicle, NextArrival } from "../types";
import { wsConnect } from "./ws"; // ✅ unified WS handler

// =============================================
// 💫 NGROK / BACKEND CONFIGURATION
// =============================================

const NGROK_BACKEND = "https://derick-unmentionable-overdistantly.ngrok-free.dev";
const LOCAL_API_URL = "http://192.168.0.156:5001";

const API_BASE_URL =
  NGROK_BACKEND && NGROK_BACKEND.trim() !== ""
    ? NGROK_BACKEND
    : Constants?.expoConfig?.extra?.API_BASE_URL || LOCAL_API_URL;

const WS_URL =
  API_BASE_URL.replace(/^https?:/, API_BASE_URL.startsWith("https") ? "wss:" : "ws:") +
  "/ws";

// =============================================
// ⚡ AXIOS INSTANCE + AUTH TOKEN HANDLING
// =============================================

const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// ---- Auth token cache (for ws + api)
let cachedToken: string | null = null;

export const setToken = (t: string | null) => {
  cachedToken = t;
};

// ✅ Unified function to retrieve token from memory or AsyncStorage
async function resolveToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  try {
    const keys = ["auth_token", "token", "accessToken", "jwt"];
    for (const k of keys) {
      const v = await AsyncStorage.getItem(k);
      if (v) {
        cachedToken = v;
        return v;
      }
    }

    const userJson = await AsyncStorage.getItem("auth_user");
    if (userJson) {
      const user = JSON.parse(userJson);
      const token =
        user?.token ||
        user?.authToken ||
        user?.accessToken ||
        user?.jwt ||
        user?.idToken ||
        null;
      if (token) cachedToken = token;
      return token;
    }
  } catch (err) {
    console.warn("⚠️ Error retrieving auth token:", err);
  }
  return null;
}

// ✅ Interceptor that ensures Authorization header on every call
http.interceptors.request.use(async (config) => {
  try {
    const token = await resolveToken();
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (err) {
    console.warn("⚠️ Failed to attach auth token:", err);
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
    if (data?.token) setToken(data.token);
    return data;
  },

  // DRIVER LOGIN
  async loginDriver(body) {
    const { data } = await http.post<LoginResponse>("/auth/driver/login", body);
    if (data?.token) setToken(data.token);
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

  // ✅ ALERTS WEBSOCKET SUBSCRIPTION (via ws.ts)
  async subscribeAlerts(cb) {
    console.log("🔔 [WS] Subscribing to alerts via ws.ts ...");
    const disconnect = await wsConnect((msg) => {
      // Normalize alert message types
      if (["alert", "alert_created"].includes(msg.type)) cb(msg);
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

  // ✅ ALERTS (REST fallback, fixes 401s)
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
