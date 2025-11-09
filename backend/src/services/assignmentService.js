//backend/src/services/assignmentService.js
import admin from "firebase-admin";

const COLLECTION = "assignments";

function normalizeDirection(direction) {
  const d = (direction || "").toString().toLowerCase();
  if (d === "fro") return "fro";
  return "to";
}

function makeError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function ensureConstraints(db, data, ignoreId) {
  const { driver_id, vehicle_id, route_id } = data;
  const direction = normalizeDirection(data.direction);

  const coll = db.collection(COLLECTION);

  // 1. Driver ↔ exactly one vehicle
  if (driver_id) {
    const snap = await coll
      .where("driver_id", "==", driver_id)
      .where("active", "==", true)
      .get();
    const conflict = snap.docs.find((d) => d.id !== ignoreId);
    if (conflict) {
      throw makeError(
        "Driver is already assigned to a vehicle on another route/direction.",
        409
      );
    }
  }

  // 2. Vehicle ↔ exactly one driver
  if (vehicle_id) {
    const snap = await coll
      .where("vehicle_id", "==", vehicle_id)
      .where("active", "==", true)
      .get();
    const conflict = snap.docs.find((d) => d.id !== ignoreId);
    if (conflict) {
      throw makeError(
        "Vehicle is already assigned to a driver on another route/direction.",
        409
      );
    }
  }

  // 3. Route+direction ↔ at most one active vehicle
  if (route_id) {
    const snap = await coll
      .where("route_id", "==", route_id)
      .where("direction", "==", direction)
      .where("active", "==", true)
      .get();
    const conflict = snap.docs.find((d) => d.id !== ignoreId);
    if (conflict) {
      throw makeError(
        "This route & direction already has an active vehicle assigned. Only one vehicle can run on a route per direction.",
        409
      );
    }
  }
}

export async function listAssignments(db, filters = {}) {
  let ref = db.collection(COLLECTION);
  if (!filters.includeInactive) {
    ref = ref.where("active", "==", true);
  }
  if (filters.route_id) {
    ref = ref.where("route_id", "==", filters.route_id);
  }
  if (filters.driver_id) {
    ref = ref.where("driver_id", "==", filters.driver_id);
  }
  if (filters.vehicle_id) {
    ref = ref.where("vehicle_id", "==", filters.vehicle_id);
  }

  const snap = await ref.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getAssignment(db, id) {
  if (!id) return null;
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

export async function createAssignment(db, payload) {
  const driver_id = String(payload.driver_id || "").trim();
  const vehicle_id = String(payload.vehicle_id || "").trim();
  const route_id = String(payload.route_id || "").trim();
  const direction = normalizeDirection(payload.direction);

  if (!driver_id || !vehicle_id || !route_id) {
    throw makeError("route_id, vehicle_id and driver_id are required", 400);
  }

  await ensureConstraints(db, { driver_id, vehicle_id, route_id, direction }, null);

  // Fetch friendly names for denormalized display
  const [routeDoc, driverDoc, vehicleDoc] = await Promise.all([
    db.collection("routes").doc(route_id).get(),
    db.collection("drivers").doc(driver_id).get(),
    db.collection("vehicles").doc(vehicle_id).get(),
  ]);

  const routeData = routeDoc.exists ? routeDoc.data() : {};
  const driverData = driverDoc.exists ? driverDoc.data() : {};
  const vehicleData = vehicleDoc.exists ? vehicleDoc.data() : {};

  const route_name =
    routeData.route_name || routeData.name || routeData.line || route_id;
  const driver_name = driverData.name || driverData.fullName || "";
  const driver_email = driverData.email || "";
  const vehicle_plate =
    vehicleData.plateNo || vehicleData.vehicle_id || vehicleDoc.id || vehicle_id;

  const now = admin.firestore.FieldValue.serverTimestamp();

  const docRef = await db.collection(COLLECTION).add({
    route_id,
    route_name,
    direction,
    vehicle_id,
    vehicle_plate,
    driver_id,
    driver_name,
    driver_email,
    active: true,
    created_at: now,
    updated_at: now,
  });

  const saved = await docRef.get();
  return { id: docRef.id, ...saved.data() };
}

export async function updateAssignment(db, id, payload) {
  if (!id) throw makeError("assignment id is required", 400);
  const docRef = db.collection(COLLECTION).doc(id);
  const existingSnap = await docRef.get();
  if (!existingSnap.exists) {
    throw makeError("Assignment not found", 404);
  }

  const existing = existingSnap.data() || {};

  const driver_id = payload.driver_id
    ? String(payload.driver_id).trim()
    : existing.driver_id;
  const vehicle_id = payload.vehicle_id
    ? String(payload.vehicle_id).trim()
    : existing.vehicle_id;
  const route_id = payload.route_id
    ? String(payload.route_id).trim()
    : existing.route_id;
  const direction = payload.direction
    ? normalizeDirection(payload.direction)
    : existing.direction || "to";
  const active =
    typeof payload.active === "boolean" ? payload.active : existing.active;

  await ensureConstraints(
    db,
    { driver_id, vehicle_id, route_id, direction, active },
    id
  );

  const updates = {
    driver_id,
    vehicle_id,
    route_id,
    direction,
    active,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  };

  // If IDs changed, refresh denormalized names
  if (driver_id !== existing.driver_id) {
    const dDoc = await db.collection("drivers").doc(driver_id).get();
    const d = dDoc.exists ? dDoc.data() : {};
    updates.driver_name = d.name || d.fullName || "";
    updates.driver_email = d.email || "";
  }

  if (vehicle_id !== existing.vehicle_id) {
    const vDoc = await db.collection("vehicles").doc(vehicle_id).get();
    const v = vDoc.exists ? vDoc.data() : {};
    updates.vehicle_plate = v.plateNo || v.vehicle_id || vDoc.id || vehicle_id;
  }

  if (route_id !== existing.route_id) {
    const rDoc = await db.collection("routes").doc(route_id).get();
    const r = rDoc.exists ? r.data() : {};
    updates.route_name = r.route_name || r.name || r.line || route_id;
  }

  await docRef.set(updates, { merge: true });
  const saved = await docRef.get();
  return { id: saved.id, ...saved.data() };
}

export async function deleteAssignment(db, id) {
  if (!id) throw makeError("assignment id is required", 400);
  const docRef = db.collection(COLLECTION).doc(id);
  const snap = await docRef.get();
  if (!snap.exists) {
    // idempotent delete
    return;
  }

  // soft delete: keep record but mark inactive
  await docRef.set(
    {
      active: false,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}
