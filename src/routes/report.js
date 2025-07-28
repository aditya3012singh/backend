// routes/report.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { reportSchema } from "../validators/validate.js";

const router = express.Router();
const prisma = new PrismaClient();

// 📝 Submit Service Report (Technician only)
router.post("/", authMiddleware, async (req, res) => {
  if (req.user.role !== "TECHNICIAN") {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  const validation = reportSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: validation.error.errors[0].message,
    });
  }

  const { bookingId, remarks, partsUsed } = validation.data;

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // ⬇️ Create Report
    const report = await prisma.report.create({
      data: {
        bookingId,
        technicianId: req.user.id,
        remarks,
      },
    });

    // 🔧 Link parts used + update stock
    for (const partId of partsUsed) {
      const part = await prisma.part.findUnique({ where: { id: partId } });
      if (!part || part.quantity < 1) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for part ID: ${partId}`,
        });
      }

      // 🔗 Link part to booking
      await prisma.bookingPart.create({
        data: {
          bookingId,
          partId,
        },
      });

      // 📉 Reduce stock
      await prisma.part.update({
        where: { id: partId },
        data: {
          quantity: { decrement: 1 },
        },
      });

      // 🪵 Stock log
      await prisma.stockLog.create({
        data: {
          partId,
          change: -1,
          reason: "Used in service",
        },
      });
    }

    // ✅ Mark booking as completed
    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: "COMPLETED" },
    });

    res.status(201).json({
      success: true,
      message: "Report submitted successfully",
      report,
    });
  } catch (error) {
    console.error("Error submitting report:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ... existing imports and POST route

// 📄 GET all reports (Admin only)
router.get("/",  async (req, res) => {
  // if (req.user.role !== "ADMIN") {
  //   return res.status(403).json({ success: false, message: "Access denied" });
  // }

  try {
    const reports = await prisma.report.findMany({
      include: {
        booking: true,
        // technician: {
        //   select: {
        //     id: true,
        //     name: true,
        //     email: true,
        //     phone: true,
        //   },
        // },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({ success: true, reports });
  } catch (error) {
    console.error("Error fetching reports:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// 📄 GET report by Booking ID (Admin/Technician)
router.get("/:bookingId", authMiddleware, async (req, res) => {
  const { bookingId } = req.params;

  try {
    const report = await prisma.report.findFirst({
      where: { bookingId },
      include: {
        technician: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        booking: true,
      },
    });

    if (!report) {
      return res
        .status(404)
        .json({ success: false, message: "Report not found for this booking" });
    }

    // Only allow technician assigned to the booking or admin
    if (
      req.user.role !== "ADMIN" &&
      req.user.id !== report.technicianId
    ) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    res.json({ success: true, report });
  } catch (error) {
    console.error("Error fetching report:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

export default router;

