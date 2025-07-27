import express from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/isAdmin.js";
import { z } from "zod";

const router = express.Router();
const prisma = new PrismaClient();

// Zod schema to validate query param
const historySearchSchema = z.object({
  query: z.string().optional(),
});

router.get("/", authMiddleware, isAdmin, async (req, res) => {
  try {
    // ✅ Validate search query
    const parsed = historySearchSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }

    const { query } = parsed.data;

    const users = await prisma.user.findMany({
      where: query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { phone: { contains: query } },
            ],
          }
        : {},

      include: {
        bookings: {
          include: {
            bookingParts: {
              include: { part: true },
            },
            report: true,
            technician: true,
          },
          orderBy: {
            serviceDate: "desc",
          },
        },
      },
    });

    res.json({ users });
  } catch (error) {
    console.error("Error fetching history:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
