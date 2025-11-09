import React, { useEffect, useRef } from "react";
import { connectLiveVehicles, LiveVehicle } from "../services/live";

export type DirectionKey = "to" | "fro";

export type VehiclePoint = {
  id: string;
  vehicle_id: string;
  vehicle_plate?: string;
  route_id?: string | null;
  direction?: DirectionKey | string | null;
  lat: number;
  lon: number;
  occupancy?: number;
  capacity?: number;
  status?: string;
  driver_name?: string;
  demand_high?: boolean;
  last_updated?: string;
};

type Props = {
  routeId?: string;
  direction: DirectionKey;
  assignedVehicleId?: string;
  onData: (rows: VehiclePoint[]) => void;
};

function normalizeVehicles(
  items: LiveVehicle[],
  opts: { routeId?: string; direction: DirectionKey; assignedVehicleId?: string }
): VehiclePoint[] {
  const { routeId, direction, assignedVehicleId } = opts;
  const routeIdStr = routeId ? String(routeId) : null;

  return items
    .map((v) => {
      const lat = Number(v.lat);
      const lon = Number(v.lon);

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

      const vRoute = v.line_id ?? null;

      // Optional: only keep current route if specified
      if (routeIdStr && vRoute && String(vRoute) !== routeIdStr) return null;

      return {
        id: String(v.id),
        vehicle_id: v.id,
        vehicle_plate: v.id,
        route_id: vRoute,
        direction: (v as any).direction ?? direction,
        lat,
        lon,
        occupancy: v.occupancy,
        capacity: v.capacity,
        status: (v as any).status,
        driver_name: v.driver_name,
        demand_high: (v as any).demand_high ?? false,
        last_updated: v.last_updated,
        // You can add derived flags like:
        // isAssigned: assignedVehicleId && String(v.id) === String(assignedVehicleId),
      } as VehiclePoint;
    })
    .filter(Boolean) as VehiclePoint[];
}

/**
 * VehicleLayer
 * - Keeps a single WebSocket subscription per (routeId, direction).
 * - Pushes normalized data to parent via a *stable* callback (useRef).
 */
export default function VehicleLayer({
  routeId,
  direction,
  assignedVehicleId,
  onData,
}: Props) {
  const onDataRef = useRef(onData);

  // keep latest onData without re-running the WS effect
  useEffect(() => {
    onDataRef.current = onData;
  }, [onData]);

  useEffect(() => {
    // If no route selected, clear vehicles and don't connect
    if (!routeId) {
      onDataRef.current?.([]);
      return;
    }

    let cleanupWs: (() => void) | null = null;
    let closed = false;

    const start = () => {
      cleanupWs = connectLiveVehicles({
        lineId: routeId,
        onUpdate: (vehicles) => {
          if (closed) return;

          const rows = normalizeVehicles(vehicles, {
            routeId,
            direction,
            assignedVehicleId,
          });

          onDataRef.current?.(rows);
        },
        onStatusChange: (connected) => {
          if (!connected) {
            // Optional: could trigger HTTP fallback here.
            // For now we just log once.
            // console.debug("[VehicleLayer] live WS disconnected");
          }
        },
      });
    };

    start();

    return () => {
      closed = true;
      if (cleanupWs) {
        try {
          cleanupWs();
        } catch {
          // ignore
        }
      }
      // do NOT call onData here, let the next route/dir effect decide
    };
  }, [routeId, direction, assignedVehicleId]);

  return null;
}
