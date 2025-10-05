// src/api/client.ts
import axios from "axios";
import Constants from "expo-constants";
import { endpoints } from "./endpoints";
import { API, LoginRequest, LoginResponse } from "./types";
import { Route, Vehicle, NextArrival } from "../types";
import { wsConnect } from "./ws";

// ======================================================
// ✅ Base URLs
// ======================================================
const API_BASE_URL =
  Constants?.expoConfig?.extra?.API_BASE_URL || "http://10.81.30.77:5000";
const WS_URL =
  Constants?.expoConfig?.extra?.WS_URL ||
  API_BASE_URL.replace(/^http/, "ws") + "/ws";

// ======================================================
// ✅ Axios Instance
// ======================================================
const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// ======================================================
// ✅ Token handling
// ======================================================
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

// ======================================================
// ✅ API Client
// ======================================================
export const apiClient: API & {
  loginDriver?: (body: { email: string; password: string }) => Promise<LoginResponse>;
  sendTelemetry?: (body: { vehicleId: string; lat: number; lng: number; occupancy?: number; status?: string; route_id?: string }) => Promise<any>;
  updateOccupancy?: (body: { vehicleId: string; delta: number }) => Promise<any>;
  controlTrip?: (body: { vehicleId: string; action: "start" | "stop"; route_id?: string }) => Promise<any>;
} = {
  // -------------------------
  // 👤 Normal user login
  // -------------------------
  async login(body: LoginRequest): Promise<LoginResponse> {
    const { data } = await http.post<LoginResponse>(endpoints.login, body);
    return data;
  },

  // -------------------------
  // 🚐 Driver login
  // -------------------------
  async loginDriver(body: { email: string; password: string }): Promise<LoginResponse> {
    const { data } = await http.post<LoginResponse>("/auth/driver/login", body);
    return data;
  },

  // -------------------------
  // 🛣️ Fetch all routes
  // -------------------------
  async getRoutes(): Promise<Route[]> {
    const { data } = await http.get<Route[]>(endpoints.routes);
    return data;
  },

  // -------------------------
  // 🚍 Fetch all vehicles
  // -------------------------
  async getVehicles(): Promise<Vehicle[]> {
    const { data } = await http.get<Vehicle[]>(endpoints.vehicles);
    return data;
  },

  // -------------------------
  // ⏰ Get upcoming arrivals
  // -------------------------
  async getNextArrivals(): Promise<NextArrival[]> {
    const { data } = await http.get<NextArrival[]>(endpoints.nextArrivals);
    return data;
  },

  // -------------------------
  // 🔁 Subscribe to real-time shuttle updates
  // -------------------------
  subscribeVehicles(cb) {
    return wsConnect(cb);
  },

  // ======================================================
  // 🛰️ TELEMETRY
  // ======================================================
  async sendTelemetry(body) {
    const { data } = await http.post("/driver/telemetry", body);
    return data;
  },

  // ======================================================
  // 👥 OCCUPANCY
  // ======================================================
  async updateOccupancy(body) {
    const { data } = await http.post("/driver/occupancy", body);
    return data;
  },

  // ======================================================
  // 🏁 TRIP CONTROL
  // ======================================================
  async controlTrip(body) {
    const { data } = await http.post("/driver/trip", body);
    return data;
  },
};
