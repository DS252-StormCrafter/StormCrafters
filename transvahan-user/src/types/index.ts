export type User = { id: string; name: string; email: string; role: 'user' };
export type Stop = { id: string; name: string; lat: number; lng: number; };
export type Route = { id: string; name: string; stops: Stop[]; schedule: string[] };
export type Vehicle = {
id: string;
vehicle_id: string;
route_id: string;
lat: number;
lng: number;
occupancy: number;
capacity: number;
status: 'idle' | 'running' | 'offline';
updated_at: string; // ISO
};
export type NextArrival = { route_id: string; eta_minutes: number };