import express from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/isAdmin.js";
import { technicianSchema } from "../validators/validate.js";

const router = express.Router();
const prisma = new PrismaClient();

// 🛠 GET all technicians (Admin)
router.get("/", authMiddleware, isAdmin, async (req, res) => {
  try {
    const technicians = await prisma.technician.findMany({
      include: {
        services: true,
      },
      orderBy: { name: "asc" },
    });
    res.json({ success: true, technicians });
  } catch (error) {
    console.error("Error fetching technicians:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// 🛠 GET single technician by ID (Admin)
router.get("/:id", authMiddleware, isAdmin, async (req, res) => {
  try {
    const technician = await prisma.technician.findUnique({
      where: { id: req.params.id },
      include: { services: true },
    });

    if (!technician) {
      return res.status(404).json({ success: false, message: "Technician not found" });
    }

    res.json({ success: true, technician });
  } catch (error) {
    console.error("Error fetching technician:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// 🛠 CREATE technician (Admin)
router.post("/", authMiddleware, isAdmin, async (req, res) => {
  const result = technicianSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ success: false, message: result.error.errors[0].message });
  }

  const { name, phone } = result.data;

  try {
    const technician = await prisma.technician.create({ data: { name, phone } });
    res.status(201).json({ success: true, message: "Technician created", technician });
  } catch (error) {
    console.error("Error creating technician:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// 🛠 UPDATE technician (Admin)
router.patch("/:id", authMiddleware, isAdmin, async (req, res) => {
  const result = technicianSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ success: false, message: result.error.errors[0].message });
  }

  const technicianId = req.params.id;

  try {
    const existing = await prisma.technician.findUnique({ where: { id: technicianId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Technician not found" });
    }

    const updated = await prisma.technician.update({
      where: { id: technicianId },
      data: result.data,
    });

    res.json({ success: true, message: "Technician updated", technician: updated });
  } catch (error) {
    console.error("Error updating technician:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// 🛠 DELETE technician (Admin)
router.delete("/:id", authMiddleware, isAdmin, async (req, res) => {
  const technicianId = req.params.id;

  try {
    const existing = await prisma.technician.findUnique({ where: { id: technicianId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Technician not found" });
    }

    await prisma.technician.delete({ where: { id: technicianId } });
    res.json({ success: true, message: "Technician deleted" });
  } catch (error) {
    console.error("Error deleting technician:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// 🧑 Technician - Get Own Profile
router.get("/me", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "TECHNICIAN") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const technician = await prisma.technician.findUnique({
      where: { id: req.user.id },
    });

    res.json({ success: true, technician });
  } catch (error) {
    console.error("Error fetching technician profile:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// 📋 Technician - Get Assigned Bookings + Update Last Active
router.get("/all", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "TECHNICIAN") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const bookings = await prisma.booking.findMany({
      where: { technicianId: req.user.id },
      include: {
        user: true,
        report: true,
        bookingParts: {
          include: { part: true },
        },
      },
      orderBy: { serviceDate: "asc" },
    });

    await prisma.technician.update({
      where: { id: req.user.id },
      data: { lastActive: new Date() },
    });

    res.json({ success: true, bookings });
  } catch (error) {
    console.error("Error fetching technician bookings:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// 📊 Technician - Stats (Completed Jobs)
router.get("/me/stats", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "TECHNICIAN") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const totalCompletedJobs = await prisma.booking.count({
      where: {
        technicianId: req.user.id,
        status: "COMPLETED",
      },
    });

    res.json({ success: true, totalCompletedJobs });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

export default router;
