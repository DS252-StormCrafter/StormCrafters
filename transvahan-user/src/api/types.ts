//transvahan-user/src/api/types.ts
import { Route, Vehicle, NextArrival, User } from '../types';


export type LoginRequest = { email: string; password: string };
export type LoginResponse = { token: string; user: User };


export type API = {
login(body: LoginRequest): Promise<LoginResponse>;
getRoutes(): Promise<Route[]>;
getVehicles(): Promise<Vehicle[]>;
getNextArrivals(): Promise<NextArrival[]>;
subscribeVehicles(cb: (v: Vehicle) => void): () => void; // unsubscribe
 subscribeSchedules?(cb: (msg: any) => void): () => void | Promise<() => void>;
};
