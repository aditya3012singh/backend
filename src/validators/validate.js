import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().min(10).max(15),
  role: z.enum(["USER", "ADMIN", "TECHNICIAN"]).optional()
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export const updateProfileSchema = z.object({
  name: z.string().min(3).optional(),
  password: z.string().min(6).optional()
});

export const deleteUserSchema = z.object({
  userId: z.string().uuid({ message: "Invalid user ID" }),
});

// 📦 Booking Validation
export const bookingSchema = z.object({
  serviceType: z.enum(["INSTALLATION", "REPAIR", "MAINTENANCE"]),
  address: z.string().min(3),
  preferredDate: z.string(), // ISO format
  brand: z.string().min(2),
  model: z.string().min(1),
  remarks: z.string().optional(),
});

// 🔔 Notification Creation
export const notificationSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(2),
  message: z.string().min(2),
});

// 🧾 Technician Report Submission
export const reportSchema = z.object({
  bookingId: z.string().uuid(),
  remarks: z.string().min(3),
  partsUsed: z.array(z.string().uuid()).optional(),
});

// 🧍 Technician Registration (by Admin)
export const technicianSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(10).max(15),
});

// 🧾 Purchase Entry
export const purchaseSchema = z.object({
  vendorName: z.string().min(2),
  billNumber: z.string().min(1),
  purchaseDate: z.string(), // ISO format
  partId: z.string().uuid(),
  quantity: z.number().int().min(1),
  costPerUnit: z.number().min(0),
  notes: z.string().optional(),
});

// 🛠️ Stock Adjustment
export const stockUpdateSchema = z.object({
  partId: z.string().uuid(),
  quantity: z.number().int(),
  reason: z.string().min(3),
});

// 📜 Service History Search
export const historySearchSchema = z.object({
  mobile: z.string().min(5).optional(),
  name: z.string().min(2).optional(),
});

export const generateOtpSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const verifyOtpSchema = z.object({
  email: z.string().email("Invalid email"),
  otp: z.string().length(6, "OTP must be 6 digits"),
});

