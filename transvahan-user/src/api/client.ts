// src/api/client.ts
import axios from "axios";
import Constants from "expo-constants";
import { endpoints } from "./endpoints";
import { API, LoginRequest, LoginResponse } from "./types";
import { Route, Vehicle, NextArrival } from "../types";
import { wsConnect } from "./ws";

const API_BASE_URL = Constants?.expoConfig?.extra?.API_BASE_URL || "http://10.217.26.188:5001";
const WS_URL = API_BASE_URL.replace(/^http/, "ws") + "/ws";

const http = axios.create({ baseURL: API_BASE_URL, timeout: 10000 });
let token: string | null = null;
export const setToken = (t: string | null) => (token = t);

http.interceptors.request.use((config) => {
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const apiClient: API & {
  loginDriver?: (body: { email: string; password: string }) => Promise<LoginResponse>;
  sendTelemetry?: (body: any) => Promise<any>;
  updateOccupancy?: (body: any) => Promise<any>;
  controlTrip?: (body: any) => Promise<any>;
  getAlerts?: () => Promise<any[]>;
  subscribeAlerts?: (cb: (alert: any) => void) => void;
} = {
  async login(body: LoginRequest) {
    const { data } = await http.post<LoginResponse>(endpoints.login, body);
    return data;
  },

  async loginDriver(body) {
    const { data } = await http.post<LoginResponse>("/auth/driver/login", body);
    return data;
  },

  async getRoutes() {
    const { data } = await http.get<Route[]>(endpoints.routes);
    return data;
  },

  async getVehicles() {
    const { data } = await http.get<Vehicle[]>(endpoints.vehicles);
    return data;
  },

  async getNextArrivals() {
    const { data } = await http.get<NextArrival[]>(endpoints.nextArrivals);
    return data;
  },

  subscribeVehicles(cb) {
    const socket = new WebSocket(WS_URL);
    socket.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      if (parsed.type === "vehicle") cb(parsed.data);
    };
    return () => socket.close();
  },

  async sendTelemetry(body) {
    const { data } = await http.post("/driver/telemetry", body);
    return data;
  },

  async updateOccupancy(body) {
    const { data } = await http.post("/driver/occupancy", body);
    return data;
  },

  async controlTrip(body) {
    const { data } = await http.post("/driver/trip", body);
    return data;
  },

  // ✅ ALERTS
  async getAlerts() {
    const { data } = await http.get("/alerts");
    return data;
  },

  subscribeAlerts(cb) {
    const socket = new WebSocket(WS_URL);
    socket.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      if (parsed.type === "alert") cb(parsed.data);
    };
    return () => socket.close();
  },
};
