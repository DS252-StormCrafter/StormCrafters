// backend/src/controllers/adminController.js
const Admin = require('../models/Admin');
const Driver = require('../models/Driver');
const { generateOTP, isOTPExpired } = require('../services/otpService');
const { sendOTPEmail } = require('../services/mailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Request OTP (admin must exist)
async function adminLoginRequest(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Missing email' });

    let admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) {
      // Optionally create a first admin on the fly if you want:
      // admin = await Admin.create({ email: email.toLowerCase() });
      return res.status(404).json({ message: 'Admin not found' });
    }

    const otp = generateOTP();
    admin.otp = otp;
    admin.otpExpiry = new Date(Date.now() + OTP_TTL_MS);
    await admin.save();

    // send to email (or SMS) - placeholder
    await sendOTPEmail(admin.email, otp);

    return res.json({ message: 'OTP sent' });
  } catch (err) {
    console.error('adminLoginRequest', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

async function adminLoginVerify(req, res) {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: 'Missing fields' });

    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) return res.status(404).json({ message: 'Admin not found' });

    if (!admin.otp || admin.otp !== otp || isOTPExpired(admin.otpExpiry)) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // generate token
    const token = jwt.sign({ id: admin._id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1d' });

    // clear OTP
    admin.otp = undefined;
    admin.otpExpiry = undefined;
    await admin.save();

    return res.json({ token });
  } catch (err) {
    console.error('adminLoginVerify', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

// Create driver (protected)
async function createDriver(req, res) {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Missing fields' });

    const exists = await Driver.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(400).json({ message: 'Driver with email already exists' });

    const hashed = await bcrypt.hash(password, 10);

    const driver = await Driver.create({
      name,
      email: email.toLowerCase(),
      password: hashed,
      phone
    });

    return res.json({ driver });
  } catch (err) {
    console.error('createDriver', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

// Delete driver (protected)
async function removeDriver(req, res) {
  try {
    const id = req.params.id;
    const driver = await Driver.findByIdAndDelete(id);
    if (!driver) return res.status(404).json({ message: 'Driver not found' });
    return res.json({ message: 'Driver removed' });
  } catch (err) {
    console.error('removeDriver', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

// List drivers (protected)
async function listDrivers(req, res) {
  try {
    const drivers = await Driver.find().select('-password');
    return res.json({ drivers });
  } catch (err) {
    console.error('listDrivers', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

module.exports = {
  adminLoginRequest,
  adminLoginVerify,
  createDriver,
  removeDriver,
  listDrivers
};
