import express from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/isAdmin.js";

const router = express.Router();
const prisma = new PrismaClient();

// GET services completed 3+ months ago
router.get("/", authMiddleware, isAdmin, async (req, res) => {
  try {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const dueServices = await prisma.booking.findMany({
      where: {
        status: "COMPLETED",
        serviceDate: {
          lte: threeMonthsAgo,
        },
      },
      include: {
        user: true,
        technician: true,
      },
      orderBy: {
        serviceDate: "desc",
      },
    });

    res.json({ dueServices });
  } catch (error) {
    console.error("Error fetching due services:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
