import axios from 'axios';
import Constants from 'expo-constants';
import { endpoints } from './endpoints';
import { API, LoginRequest, LoginResponse } from './types';
import { Route, Vehicle, NextArrival } from '../types';
import { wsConnect } from './ws';


const API_BASE_URL = Constants.expoConfig?.extra?.API_BASE_URL;
const WS_URL = Constants.expoConfig?.extra?.WS_URL;


const http = axios.create({ baseURL: API_BASE_URL, timeout: 8000 });


let token: string | null = null;
export const setToken = (t: string | null) => { token = t; };
http.interceptors.request.use((config) => {
if (token) config.headers.Authorization = `Bearer ${token}`;
return config;
});


export const apiClient: API = {
async login(body: LoginRequest): Promise<LoginResponse> {
const { data } = await http.post<LoginResponse>(endpoints.login, body);
return data;
},
async getRoutes(): Promise<Route[]> {
const { data } = await http.get<Route[]>(endpoints.routes);
return data;
},
async getVehicles(): Promise<Vehicle[]> {
const { data } = await http.get<Vehicle[]>(endpoints.vehicles);
return data;
},
async getNextArrivals(): Promise<NextArrival[]> {
const { data } = await http.get<NextArrival[]>(endpoints.nextArrivals);
return data;
},
subscribeVehicles(cb) {
return wsConnect(cb);
},
};