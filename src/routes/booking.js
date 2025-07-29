import express from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/isAdmin.js";

const prisma = new PrismaClient();
const router = express.Router();

/**
 * Create a new booking (User) - Default status PENDING
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
        status: "PENDING", // Explicitly set default
      },
    });

    res.status(201).json({ message: "Booking created", booking });
  } catch (error) {
    console.error("Booking creation failed:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * Get all bookings (Admin only)
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

/**x
 * Assign technician to booking (Admin only)
 * Auto-sets status to IN_PROGRESS
 */
router.post("/:id/assign", authMiddleware, isAdmin, async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { technicianId } = req.body;

    console.log("Technician ID received:", technicianId);

    // Sanity check: is the technician in the DB?
    const tech = await prisma.technician.findUnique({ where: { id: technicianId } });
    if (!tech) {
      console.log("❌ Technician not found in DB");
      return res.status(404).json({ message: "Technician not found" });
    }

    // Proceed to update booking
    const booking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        technicianId,
        status: "IN_PROGRESS",
      },
    });

    console.log("✅ Booking updated:", booking);

    // Increment total jobs
    await prisma.technician.update({
      where: { id: technicianId },
      data: {
        totalJobs: { increment: 1 },
      },
    });

    res.json({
      message: "Technician assigned. Booking is now IN_PROGRESS.",
      booking,
    });
  } catch (error) {
    console.error("Technician assignment failed:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});




/**
 * Update booking status (Admin only)
 * Can move IN_PROGRESS -> COMPLETED (or revert if needed)
 */
router.patch("/:id/status", authMiddleware, isAdmin, async (req, res) => {
  try {
    const { status } = req.body; // e.g. COMPLETED
    const bookingId = req.params.id;

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: { status },
    });

    res.json({ message: `Booking status updated to ${status}`, booking: updated });
  } catch (error) {
    console.error("Error updating booking status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * Add a report (Technician)
 * Does NOT auto-complete booking anymore
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

    // Keep booking status as is (likely IN_PROGRESS)
    res.json({ message: "Report added. Awaiting admin to finalize booking.", report });
  } catch (error) {
    console.error("Error adding report:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * Get a single booking by ID (User or Admin)
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
 * Still allowed, but does not close the booking.
 */
router.post("/:id/parts", authMiddleware, async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { parts } = req.body; // [{ partId, quantity }]

    const createdParts = await Promise.all(
      parts.map(async ({ partId, quantity }) => {
        await prisma.part.update({
          where: { id: partId },
          data: { quantity: { decrement: quantity } },
        });

        return prisma.bookingPart.create({
          data: { bookingId, partId, quantity },
        });
      })
    );

    res.json({ message: "Parts logged for booking.", bookingParts: createdParts });
  } catch (error) {
    console.error("Error adding parts:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
