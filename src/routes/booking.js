import express from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/isAdmin.js";

const prisma = new PrismaClient();
const router = express.Router();

/**
 * Create a new booking (User)
 */
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { serviceType, serviceDate, remarks } = req.body;
    const userId = req.user.id;

    const booking = await prisma.booking.create({
      data: {
        userId,
        serviceType,
        serviceDate: new Date(serviceDate),
        remarks,
      },
    });

    res.status(201).json({ message: "Booking created", booking });
  } catch (error) {
    console.error("Booking creation failed:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * Get all bookings (Admin)
 */
router.get("/", authMiddleware, isAdmin, async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      include: {
        user: true,
        technician: true,
        report: true,
        bookingParts: { include: { part: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ bookings });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * Get current user's bookings
 */
router.get("/my", authMiddleware, async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { userId: req.user.id },
      include: {
        technician: true,
        report: true,
        bookingParts: { include: { part: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ bookings });
  } catch (error) {
    console.error("Error fetching user bookings:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * Assign technician to booking (Admin)
 */
router.post("/:id/assign", authMiddleware, isAdmin, async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { technicianId } = req.body;

    const booking = await prisma.booking.update({
      where: { id: bookingId },
      data: { technicianId, status: "IN_PROGRESS" },
    });

    await prisma.technician.update({
      where: { id: technicianId },
      data: { totalJobs: { increment: 1 } },
    });

    res.json({ message: "Technician assigned", booking });
  } catch (error) {
    console.error("Technician assignment failed:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * Update booking status (Technician/Admin)
 */
router.patch("/:id/status", authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const bookingId = req.params.id;

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: { status },
    });

    res.json({ message: "Booking status updated", booking: updated });
  } catch (error) {
    console.error("Error updating booking status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * Add a report to a booking (Technician)
 */
router.post("/:id/report", authMiddleware, async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { summary } = req.body;

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const report = await prisma.report.create({
      data: { bookingId, summary },
    });

    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: "COMPLETED" },
    });

    res.json({ message: "Report added", report });
  } catch (error) {
    console.error("Error adding report:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * Get a single booking by ID
 */
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const bookingId = req.params.id;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: true,
        technician: true,
        report: true,
        bookingParts: { include: { part: true } },
      },
    });

    if (!booking) return res.status(404).json({ message: "Booking not found" });

    res.json({ booking });
  } catch (error) {
    console.error("Error fetching booking:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * Add parts used in a booking (Technician/Admin)
 */
router.post("/:id/parts", authMiddleware, async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { parts } = req.body; // [{ partId, quantity }]

    const createdParts = await Promise.all(
      parts.map(async ({ partId, quantity }) => {
        // Decrease stock quantity
        await prisma.part.update({
          where: { id: partId },
          data: { quantity: { decrement: quantity } },
        });

        // Log part usage in booking
        return prisma.bookingPart.create({
          data: { bookingId, partId, quantity },
        });
      })
    );

    res.json({ message: "Parts added to booking", bookingParts: createdParts });
  } catch (error) {
    console.error("Error adding parts:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
