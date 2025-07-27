import express from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/isAdmin.js";

const router = express.Router();
const prisma = new PrismaClient();

// Admin dashboard summary route
router.get("/", authMiddleware, isAdmin, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const [totalToday, pending, dueSoon, lowStock] = await Promise.all([
      // Total services scheduled for today
      prisma.booking.count({
        where: { serviceDate: today },
      }),

      // Total pending services
      prisma.booking.count({
        where: { status: "PENDING" },
      }),

      // Due services (serviced 3+ months ago)
      prisma.booking.count({
        where: {
          status: "COMPLETED",
          serviceDate: {
            lte: threeMonthsAgo,
          },
        },
      }),

      // Parts low in stock (quantity ≤ 5)
      prisma.part.findMany({
        where: { quantity: { lte: 5 } },
      }),
    ]);

    res.json({
      totalServicesToday: totalToday,
      pendingServices: pending,
      dueServices: dueSoon,
      lowStockAlert: lowStock,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
