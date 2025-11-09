// backend/src/services/tripSynthesizer.js
/**
 * Trip Synthesizer
 * ----------------
 * Periodically scans vehicle telemetry and converts movements into trip_summary docs.
 *  - Detects trip start and end based on status & occupancy transitions
 *  - Computes distance (Haversine) & duration
 *  - Persists summary in Firestore (no fare/cost; institute free service)
 */

import admin from "firebase-admin";
import { haversine } from "../utils/geo.js";

// Simple in-memory cache per vehicle
// { [vehicleId]: { active, lastStatus, points: [{lat,lon,ts}], start_ts, route_id, driver_id } }
const CACHE = {};
const WINDOW_MS = 15 * 60 * 1000; // 15-minute rolling window

export async function runTripSynthesizer(db) {
  try {
    const now = Date.now();
    const vSnap = await db.collection("vehicles").get();
    if (vSnap.empty) return;

    for (const doc of vSnap.docs) {
      const v = doc.data();
      const vid = doc.id;

      const occ = Number(v.occupancy ?? 0);
      const status = v.status || "idle";

      const loc = v.location || {};
      const lat = Number(loc.lat ?? loc.latitude ?? 0);
      const lon = Number(loc.lng ?? loc.longitude ?? 0);
      const ts = Number(loc.timestamp ?? now);

      if (!lat || !lon) continue;

      const existing = CACHE[vid] || {
        active: false,
        lastStatus: "idle",
        points: [],
        start_ts: ts,
        route_id: v.currentRoute ?? null,
        driver_id: v.driver_id ?? null,
      };

      const entry = {
        ...existing,
        lastStatus: status,
        route_id: v.currentRoute ?? existing.route_id ?? null,
        driver_id: v.driver_id ?? existing.driver_id ?? null,
      };

      // record telemetry point
      entry.points.push({ lat, lon, ts });
      CACHE[vid] = entry;

      // ---- detect trip start ----
      if (!entry.active && (status === "active" || occ > 0)) {
        entry.active = true;
        entry.start_ts = ts;
        entry.points = [{ lat, lon, ts }];
      }

      // ---- detect trip end ----
      const lastTs = entry.points[entry.points.length - 1]?.ts || ts;
      const longEnough = lastTs - entry.start_ts > 60 * 1000; // >1 min
      const idleLong =
        (status === "idle" || occ === 0) &&
        longEnough &&
        now - lastTs > 2 * 60 * 1000; // idle/empty for 2+ min

      if (entry.active && idleLong) {
        const trip = computeTrip(entry);

        // filter out micro/noise “trips”
        if (trip.distance_km > 0.05 && trip.duration_s > 60) {
          await db.collection("trip_summary").add({
            vehicle_id: vid,
            // Write both line_id & route_id so analytics code can read either
            line_id: entry.route_id || null,
            route_id: entry.route_id || null,
            driver_id: entry.driver_id || null,
            start_time: admin.firestore.Timestamp.fromMillis(
              trip.start_time
            ),
            end_time: admin.firestore.Timestamp.fromMillis(trip.end_time),
            distance_km: trip.distance_km,
            duration_s: trip.duration_s,
            avg_speed_kmph: trip.avg_speed_kmph,
            status: "completed",
            gps_path: trip.gps_path,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
          });

          console.log(
            `🟢 trip_summary stored for ${vid}: ${trip.distance_km.toFixed(
              2
            )} km, ${trip.duration_s}s`
          );
        }

        // reset cache entry
        CACHE[vid] = {
          active: false,
          lastStatus: status,
          points: [],
          start_ts: now,
          route_id: v.currentRoute ?? entry.route_id ?? null,
          driver_id: v.driver_id ?? entry.driver_id ?? null,
        };
      }

      // ---- trim stale points ----
      entry.points = entry.points.filter((p) => now - p.ts <= WINDOW_MS);
    }
  } catch (err) {
    console.error("❌ TripSynth error:", err);
  }
}

function computeTrip(entry) {
  const pts = entry.points || [];
  if (pts.length < 2) {
    return {
      start_time: entry.start_ts,
      end_time: entry.start_ts,
      distance_km: 0,
      duration_s: 0,
      avg_speed_kmph: 0,
      gps_path: pts,
    };
  }

  let distMeters = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    distMeters += haversine(a.lat, a.lon, b.lat, b.lon);
  }

  const start = pts[0].ts;
  const end = pts[pts.length - 1].ts;
  const durSec = (end - start) / 1000;
  const km = distMeters / 1000;
  const avgSpeed = durSec > 0 ? km / (durSec / 3600) : 0;

  return {
    start_time: start,
    end_time: end,
    distance_km: km,
    duration_s: Math.round(durSec),
    avg_speed_kmph: avgSpeed,
    gps_path: pts,
  };
}