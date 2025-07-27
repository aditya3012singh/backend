// routes/stock.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/isAdmin.js";
import { stockUpdateSchema } from "../validators/validate.js";

const router = express.Router();
const prisma = new PrismaClient();

// 📦 GET all parts with stock logs (Admin)
router.get("/", authMiddleware, isAdmin, async (req, res) => {
  try {
    const parts = await prisma.part.findMany({
      include: { stockLogs: true },
      orderBy: { name: "asc" },
    });

    res.json({ success: true, parts });
  } catch (error) {
    console.error("Error fetching stock:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ➕ PATCH add quantity to part (Admin)
router.patch("/:id/add", authMiddleware, isAdmin, async (req, res) => {
  const result = stockUpdateSchema.safeParse({
    ...req.body,
    partId: req.params.id,
  });

  if (!result.success) {
    return res
      .status(400)
      .json({ success: false, message: result.error.errors[0].message });
  }

  const { partId, quantity, reason } = result.data;

  try {
    const part = await prisma.part.findUnique({ where: { id: partId } });

    if (!part) {
      return res.status(404).json({ success: false, message: "Part not found" });
    }

    await prisma.part.update({
      where: { id: partId },
      data: {
        quantity: { increment: quantity },
      },
    });

    await prisma.stockLog.create({
      data: {
        partId,
        change: quantity,
        reason,
      },
    });

    res.json({ success: true, message: "Stock updated successfully" });
  } catch (error) {
    console.error("Error adding stock:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

export default router;
