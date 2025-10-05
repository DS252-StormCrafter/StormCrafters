// backend/src/middleware/auth.js
import jwt from "jsonwebtoken";
import admin from "firebase-admin";

/**
 * Middleware to authenticate any protected route.
 * Verifies JWT, extracts normalized user identity, and attaches to req.user.
 */
export function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "No Authorization header" });
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({ error: "Malformed Authorization header" });
    }

    const token = parts[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");

      // ✅ Normalize token payload
      const id = decoded.id ?? decoded.uid ?? null;
      const email = decoded.email ?? decoded.uid ?? null;
      const role = decoded.role ?? null;

      if (!email) {
        return res.status(401).json({ error: "Invalid token: missing email" });
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
 * Admin-only middleware, ensures current user exists in Firestore `admins` collection.
 */
export async function requireAdmin(req, res, next) {
  try {
    if (!req.user?.email) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const db = admin.firestore();
    const snap = await db
      .collection("admins")
      .where("email", "==", req.user.email)
      .limit(1)
      .get();

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
