// backend/src/middleware/auth.js
import jwt from "jsonwebtoken";
import admin from "firebase-admin";

/**
 * Middleware to authenticate protected routes.
 * Accepts common JWT payload fields: id, uid, sub, email, userId
 * Attaches `req.user = { id, email, role, raw }`
 */
export function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader) {
      // No auth header present -> respond 401 (route-level decisions can be done by mounting without this middleware)
      return res.status(401).json({ error: "No Authorization header" });
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({ error: "Malformed Authorization header" });
    }

    const token = parts[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");

      // Normalize token payload
      const id = decoded.id ?? decoded.uid ?? decoded.sub ?? decoded.userId ?? null;
      const email = decoded.email ?? decoded.emailAddress ?? decoded.userEmail ?? null;
      const role = decoded.role ?? decoded.userRole ?? decoded.roleName ?? null;

      // If email isn't present, many JWT flows still use 'sub' — tolerate id-only tokens:
      if (!email && !id) {
        return res.status(401).json({ error: "Invalid token: missing identity" });
      }

      req.user = { id, email, role, raw: decoded };
      next();
    } catch (err) {
      console.error("❌ Token verification error:", err.message);
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  } catch (err) {
    console.error("Auth middleware fatal error:", err);
    return res.status(500).json({ error: "Auth middleware failure" });
  }
}

/**
 * Admin-only middleware - verifies existence in Firestore `admins` collection.
 */
export async function requireAdmin(req, res, next) {
  try {
    if (!req.user?.email && !req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const db = admin.firestore();
    const query = req.user.email
      ? db.collection("admins").where("email", "==", req.user.email).limit(1)
      : db.collection("admins").where("id", "==", req.user.id).limit(1);

    const snap = await query.get();

    if (snap.empty) {
      return res.status(403).json({ error: "Admins only" });
    }

    req.admin = snap.docs[0].data();
    next();
  } catch (err) {
    console.error("requireAdmin error:", err);
    res.status(500).json({ error: "Admin auth failed" });
  }
}
