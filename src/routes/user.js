// File: routes/auth.ts
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";
import {
  loginSchema,
  signupSchema,
  updateProfileSchema,
  deleteUserSchema,
} from "../validators/validate.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/isAdmin.js";

dotenv.config();

const router = express.Router();
const prisma = new PrismaClient();
const redis = new Redis('redis://default:3jV9jzkjA5exL5BXPl7B7iUDL4MLpjOf@redis-15622.crce179.ap-south-1-1.ec2.redns.redis-cloud.com:15622');
redis.ping().then(console.log);

// Mailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ---------------- OTP ROUTES ----------------
router.post("/generate-otp", async (req, res) => {
  const email = req.body.email?.toLowerCase();
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    await redis.set(`otp:${email}`, otpCode, "EX", 600);

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP Code",
      text: `Your verification code is ${otpCode}`,
    });

    return res.json({ message: "OTP sent to email!" });
  } catch (e) {
    console.error("OTP error:", e);
    return res.status(500).json({ message: "Failed to send OTP" });
  }
});

router.post("/verify-otp", async (req, res) => {
  const email = req.body.email?.toLowerCase();
  const code = req.body.code;

  try {
    const storedOtp = await redis.get(`otp:${email}`);
    if (!storedOtp || storedOtp !== code) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    await redis.del(`otp:${email}`);
    await redis.set(`verified:${email}`, "true", "EX", 600);

    return res.json({ message: "OTP verified. You can now sign up." });
  } catch (e) {
    console.error("OTP verification failed:", e);
    return res.status(500).json({ message: "Failed to verify OTP." });
  }
});

// ---------------- CHECK ROUTES ----------------
router.get("/check-admin", async (req, res) => {
  try {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    res.json({ adminExists: adminCount > 0, adminCount });
  } catch (e) {
    console.error("Error checking admin existence:", e);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/check-user", async (req, res) => {
  const email = req.query.email?.toString().toLowerCase();
  if (!email) return res.status(400).json({ message: "Email is required" });

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    res.json({ exists: !!existingUser });
  } catch (e) {
    console.error("Error checking user existence:", e);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------- AUTH ROUTES ----------------
router.post("/signup", async (req, res) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(403).json({ errors: parsed.error.errors });
    }

    const { email: rawEmail, name, password, phone, role, location } =
      parsed.data;
    const email = rawEmail.toLowerCase();

    const isVerified = await redis.get(`verified:${email}`);
    if (!isVerified) {
      return res
        .status(403)
        .json({ message: "Please verify your email via OTP before signing up." });
    }

    if (role === "ADMIN") {
      const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
      if (adminCount > 0) {
        return res.status(403).json({
          message: "Admin already exists. Only one admin is allowed per system.",
        });
      }
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        phone,
        location: location ?? null, // Now we save the address
        role: role ?? "USER",
      },
    });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "24h" }
    );

    await redis.del(`verified:${email}`);

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        location: user.location,
        role: user.role,
      },
    });
  } catch (e) {
    console.error("Signup error:", e);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/signin", async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ errors: parsed.error.errors, message: "Invalid credentials" });
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });
    if (!user) return res.status(403).json({ message: "User not found" });

    const isPasswordValid = await bcrypt.compare(
      parsed.data.password,
      user.password
    );
    if (!isPasswordValid)
      return res.status(401).json({ message: "Incorrect password" });

    const token = jwt.sign(
      { id: user.id, role: user.role }, // Now includes role
      process.env.JWT_SECRET || "secret",
      { expiresIn: "24h" }
    );

    const { password, ...userWithoutPassword } = user;
    res.json({ message: "Login successful", token, user: userWithoutPassword });
  } catch (e) {
    console.error("Signin error:", e);
    res.status(500).json({ message: "Login failed due to server error" });
  }
});

// ---------------- PROFILE ROUTES ----------------
router.put("/update-profile", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errors: parsed.error.errors });
    }

    const { name, password, location, phone } = parsed.data;
    const updateData = {};

    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (location) updateData.location = location;
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateData.password = hashedPassword;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        location: true,
        createdAt: true,
      },
    });

    res.json({ message: "Profile updated", user: updatedUser });
  } catch (e) {
    console.error("Error updating profile:", e);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        location: true,
        role: true,
        createdAt: true,
      },
    });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user });
  } catch (e) {
    console.error("Error fetching user info:", e);
    res.status(500).json({ message: "Failed to fetch user info" });
  }
});

// Admin route to get all users
router.get("/users", authMiddleware, isAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: "USER" }, // Only fetch customers
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        location: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ users });
  } catch (e) {
    console.error("Error fetching users:", e);
    res.status(500).json({ message: "Internal server error" });
  }
});
router.get("/technicians", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: "TECHNICIAN" }, // Only fetch customers
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        location: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ users });
  } catch (e) {
    console.error("Error fetching users:", e);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Delete user (admin only)
router.delete("/user", authMiddleware, isAdmin, async (req, res) => {
  try {
    const parsed = deleteUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errors: parsed.error.errors });
    }
    await prisma.user.delete({ where: { id: parsed.data.userId } });
    res.json({ message: "User deleted successfully" });
  } catch (e) {
    console.error("Error deleting user:", e);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
