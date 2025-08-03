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
 * Get all booking remarks (Admin only)
 */
router.get("/remarks", authMiddleware, isAdmin, async (req, res) => {
  try {
    const remarks = await prisma.booking.findMany({
      select: {
        id: true,
        remarks: true,
        userId: true,
        serviceType: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ remarks });
  } catch (error) {
    console.error("Error fetching remarks:", error);
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

/**
 * Update booking details (Admin only)
 */
router.patch("/:id", authMiddleware, isAdmin, async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { serviceType, serviceDate, remarks } = req.body;

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        ...(serviceType && { serviceType }),
        ...(serviceDate && { serviceDate: new Date(serviceDate) }),
        ...(remarks && { remarks }),
      },
    });

    res.json({ message: "Booking updated successfully", booking: updatedBooking });
  } catch (error) {
    console.error("Error updating booking:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

function updateRemarksFields(remarks, updates) {
  const lines = remarks.split("\n").filter(Boolean); // Remove empty lines
  const lineMap = new Map();

  // Convert current remarks to a Map
  for (const line of lines) {
    const [key, ...rest] = line.split(":");
    if (key && rest.length) {
      lineMap.set(key.trim(), rest.join(":").trim());
    }
  }

  // Apply updates or insert new fields
  for (const key in updates) {
    lineMap.set(key, updates[key]); // always overwrite or add
  }

  // Return joined string
  return Array.from(lineMap.entries())
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");

}


/**
 * Update booking remarks fields (name, phone, address, problem)
 */
router.patch("/:id/remarks", authMiddleware, isAdmin, async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { name, phone, address, problem } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const updates = {};
    if (name) updates["Name"] = name;
    if (phone) updates["Phone"] = phone;
    if (address) updates["Address"] = address;
    if (problem) updates["Problem"] = problem;

    const updatedRemarks = updateRemarksFields(booking.remarks || "", updates);

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: { remarks: updatedRemarks },
    });

    res.json({
      message: "Remarks updated successfully",
      remarks: updatedRemarks,
      booking: updatedBooking,
    });
  } catch (error) {
    console.error("Error updating remarks:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


/**
 * Delete a booking by ID (Admin only)
 */
/**
 * Delete a booking by ID (Admin only)
 */
import { parseBookingRemarks } from "../utils/parseBookingRemarks.js";

router.delete("/bookings/:id", async (req, res) => {
  const bookingId = req.params.id;

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // 1. Parse name, phone, address from booking.remarks
    const { name, phone, address } = parseBookingRemarks(booking.remarks);

    // 2. Delete related reports that match phone + address + serviceDate
    await prisma.report.deleteMany({
      where: {
        mobileNumber: phone,
        address: address,
        dateTime: booking.serviceDate,
      },
    });

    // 3. Delete booking itself
    await prisma.booking.delete({
      where: { id: bookingId },
    });

    return res.json({ success: true, message: "Booking and related reports deleted." });
  } catch (error) {
    console.error("Error deleting booking and reports:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});
// utils/parseBookingRemarks.js
export function parseBookingRemarks(remarks) {
  const result = {
    name: "",
    phone: "",
    address: "",
    problem: "",
  };

  if (!remarks) return result;

  const lines = remarks.split(",");

  lines.forEach((line) => {
    const [key, ...rest] = line.split(":");
    const value = rest.join(":").trim();

    if (key.toLowerCase().includes("name")) result.name = value;
    if (key.toLowerCase().includes("phone")) result.phone = value;
    if (key.toLowerCase().includes("address")) result.address = value;
    if (key.toLowerCase().includes("problem")) result.problem = value;
  });

  return result;
}





export default router;
