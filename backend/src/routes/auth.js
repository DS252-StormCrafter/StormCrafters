// backend/src/routes/auth.js
import { Router } from "express";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt";

export default function authRoutes(db) {
  const router = Router();

  // =========================================================
  // =============== EMAIL CONFIGURATION =====================
  // =========================================================
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });

  // =========================================================
  // =============== USER SIGNUP =============================
  // =========================================================
  router.post("/signup", async (req, res) => {
    console.log("📥 /auth/signup request received at:", new Date().toISOString());
    console.log("Payload:", req.body);
    try {
      const { email, name, password, passwordHash } = req.body;

      // Support both plain password or pre-hashed (from Expo)
      const rawPassword = password || passwordHash;
      if (!rawPassword)
        return res.status(400).json({ error: "Password is required" });

      const userRef = db.collection("users").doc(email);
      const existing = await userRef.get();
      if (existing.exists)
        return res.status(400).json({ error: "User already exists" });
      console.log("User can exist")
      // Hash password securely before saving
      const hashedPassword = await bcrypt.hash(rawPassword, 10);
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      await userRef.set({
        email,
        name,
        passwordHash: hashedPassword,
        role: "user",
        verified: false,
        otp,
        createdAt: new Date().toISOString(),
      });
      console.log("Need to send otp now")
      // Optional: send OTP email if EMAIL_USER is configured
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: "Transvahan OTP Verification",
          text: `Your OTP is ${otp}`,
        });
      } else {
        console.log(`📩 OTP for ${email}: ${otp} (email not configured)`);
      }

      console.log(
        `✅ User saved in Firestore (${process.env.FIRESTORE_EMULATOR_HOST ? "Emulator" : "Live"}): ${email}`
      );

      res.json({ message: "User registered. Please verify OTP." });
    } catch (err) {
      console.error("Signup error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // =========================================================
  // =============== VERIFY OTP ==============================
  // =========================================================
  router.post("/verify-otp", async (req, res) => {
    const { email, otp } = req.body;
    try {
      const userRef = db.collection("users").doc(email);
      const snap = await userRef.get();
      if (!snap.exists)
        return res.status(400).json({ error: "User not found" });

      if (snap.data().otp !== otp)
        return res.status(400).json({ error: "Invalid OTP" });

      await userRef.update({ verified: true, otp: null });
      console.log(`✅ OTP verified for ${email}`);
      res.json({ message: "OTP verified. You can now login." });
    } catch (err) {
      console.error("Verify OTP error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // =========================================================
  // =============== USER LOGIN ==============================
  // =========================================================
  router.post("/login", async (req, res) => {
    const { email, password, passwordHash } = req.body;
    try {
      const userRef = db.collection("users").doc(email);
      const snap = await userRef.get();
      if (!snap.exists)
        return res.status(400).json({ error: "User not found" });

      const user = snap.data();
      if (!user.verified)
        return res.status(403).json({ error: "User not verified" });

      // Compare bcrypt hash
      const rawPassword = password || passwordHash;
      const match = await bcrypt.compare(rawPassword, user.passwordHash);

      if (!match)
        return res.status(403).json({ error: "Invalid credentials" });

      const token = jwt.sign(
        { uid: email, role: user.role },
        process.env.JWT_SECRET || "secret",
        { expiresIn: "7d" }
      );

      console.log(`✅ User ${email} logged in successfully`);
      res.json({
        token,
        user: { email, name: user.name, role: user.role },
      });
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // =========================================================
  // =============== ADMIN LOGIN =============================
  // =========================================================
  router.post("/admin/login", async (req, res) => {
    const { email, password } = req.body;
    console.log("🟡 Admin login attempt:", email);

    try {
      const snap = await db
        .collection("admins")
        .where("email", "==", email)
        .limit(1)
        .get();

      if (snap.empty) {
        console.log("❌ Admin not found in Firestore");
        return res.status(400).json({ error: "Admin not found" });
      }

      const adminDoc = snap.docs[0];
      const admin = adminDoc.data();

      const match = await bcrypt.compare(password, admin.password);
      console.log("🔍 Password match result:", match);

      if (!match)
        return res.status(403).json({ error: "Invalid credentials" });

      const token = jwt.sign(
        { id: adminDoc.id, email: admin.email, role: "admin" },
        process.env.JWT_SECRET || "secret",
        { expiresIn: "7d" }
      );

      console.log("✅ Admin token generated successfully");
      res.json({
        token,
        user: { email: admin.email, role: "admin" },
      });
    } catch (err) {
      console.error("Admin login error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  // ================= DRIVER LOGIN =================
router.post("/driver/login", async (req, res) => {
  const { email, password } = req.body;
  console.log("🟡 Driver login attempt:", email);

  try {
    const snap = await db
      .collection("drivers")
      .where("email", "==", email)
      .limit(1)
      .get();

    if (snap.empty) {
      console.log("❌ Driver not found in Firestore");
      return res.status(400).json({ error: "Driver not found" });
    }

    const driverDoc = snap.docs[0];
    const driver = driverDoc.data();

    const match = await bcrypt.compare(password, driver.password);
    console.log("🔍 Password match result:", match);

    if (!match) return res.status(403).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { id: driverDoc.id, email: driver.email, role: "driver" },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "7d" }
    );

    console.log("✅ Driver logged in successfully");
    res.json({
      token,
      user: { email: driver.email, role: "driver", name: driver.name },
    });
  } catch (err) {
    console.error("Driver login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});


  return router;
}
