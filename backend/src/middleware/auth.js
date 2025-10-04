// backend/src/middleware/auth.js


// backend/src/routes/auth.js
import { Router } from "express";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import admin from "firebase-admin";

export default function authRoutes(db) {
const router = Router();


// Email transporter (using Gmail app password)
const transporter = nodemailer.createTransport({
service: "gmail",
auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});


router.post("/signup", async (req, res) => {
const { email, name, passwordHash } = req.body;
const userRef = db.collection("users").doc(email);
const existing = await userRef.get();
if (existing.exists) return res.status(400).json({ error: "User already exists" });


const otp = Math.floor(100000 + Math.random() * 900000).toString();
await userRef.set({ email, name, passwordHash, role: "user", verified: false, otp });


await transporter.sendMail({
from: process.env.EMAIL_USER,
to: email,
subject: "Transvahan OTP Verification",
text: `Your OTP is ${otp}`,
});


res.json({ message: "User registered. Please verify OTP." });
});


router.post("/verify-otp", async (req, res) => {
const { email, otp } = req.body;
const userRef = db.collection("users").doc(email);
const snap = await userRef.get();
if (!snap.exists) return res.status(400).json({ error: "User not found" });
if (snap.data().otp !== otp) return res.status(400).json({ error: "Invalid OTP" });


await userRef.update({ verified: true, otp: null });
res.json({ message: "OTP verified. You can now login." });
});


router.post("/login", async (req, res) => {
const { email, passwordHash } = req.body;
const userRef = db.collection("users").doc(email);
const snap = await userRef.get();
if (!snap.exists) return res.status(400).json({ error: "User not found" });


const user = snap.data();
if (!user.verified) return res.status(403).json({ error: "User not verified" });
if (user.passwordHash !== passwordHash) return res.status(403).json({ error: "Invalid credentials" });


const token = jwt.sign({ uid: email, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
res.json({ token, user: { email, name: user.name, role: user.role } });
});


return router;
}
export function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader) return res.status(401).json({ error: "No Authorization header" });

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({ error: "Malformed Authorization header" });
    }

    const token = parts[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
      req.user = decoded; // { uid, role, email }
      return next();
    } catch (verr) {
      console.error("Token verify error:", verr);
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(500).json({ error: "Auth middleware failure" });
  }
}

// --- NEW: requireAdmin middleware ---
export async function requireAdmin(req, res, next) {
  try {
    if (!req.user?.email) return res.status(401).json({ error: "Unauthorized" });

    const db = admin.firestore();
    const snap = await db.collection("admins")
      .where("email", "==", req.user.email)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(403).json({ error: "Admins only" });
    }

    req.admin = snap.docs[0].data();
    return next();
  } catch (err) {
    console.error("requireAdmin error:", err);
    return res.status(500).json({ error: "Admin auth failed" });
  }
}
