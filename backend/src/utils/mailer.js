import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// Gmail SMTP transporter
export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // App Password
  },
});

// Send OTP email
export const sendOtpEmail = async (to, otp) => {
  const mailOptions = {
    from: `"Transvahan" <${process.env.EMAIL_USER}>`,
    to, // recipient email (user)
    subject: "Your Transvahan OTP Code",
    text: `Your OTP for verifying your Transvahan account is: ${otp}\n\nThis code expires in 5 minutes.`,
  };

  await transporter.sendMail(mailOptions);
};
