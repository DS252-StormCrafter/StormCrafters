import jwt from "jsonwebtoken";
import admin from "firebase-admin";

export function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader) return res.status(401).json({ error: "No Authorization header" });

    const [bearer, token] = authHeader.split(" ");
    if (bearer !== "Bearer" || !token)
      return res.status(401).json({ error: "Malformed Authorization header" });

    const secret = process.env.JWT_SECRET || "secret";
    const decoded = jwt.verify(token, secret);

    const role =
      decoded.role ||
      decoded.userRole ||
      decoded.type ||
      decoded.roleName ||
      decoded.category ||
      "user";

    req.user = {
      id: decoded.id || decoded.uid || decoded.sub || null,
      email: decoded.email || decoded.emailAddress || null,
      role: role.toString().toLowerCase(),
      raw: decoded,
    };

    next();
  } catch (err) {
    console.error("❌ Auth verification failed:", err.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export async function requireAdmin(req, res, next) {
  try {
    if (req.user?.role !== "admin") return res.status(403).json({ error: "Admins only" });
    next();
  } catch (err) {
    console.error("requireAdmin error:", err);
    res.status(500).json({ error: "Admin auth failed" });
  }
}
