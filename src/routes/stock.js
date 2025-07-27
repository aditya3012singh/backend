// routes/stock.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/isAdmin.js";
import { stockUpdateSchema } from "../validators/validate.js";

const router = express.Router();
const prisma = new PrismaClient();

/**
 * 📦 GET all parts with their stock logs (Admin Only)
 */
router.get("/", authMiddleware, isAdmin, async (req, res) => {
  try {
    const parts = await prisma.part.findMany({
      include: {
        stockLogs: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { name: "asc" },
    });

    res.json({ success: true, parts });
  } catch (error) {
    console.error("Error fetching stock:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

/**
 * ➕ PATCH: Add quantity to a part (Admin Only)
 * URL: /stock/:id/add
 */
router.patch("/:id/add", authMiddleware, isAdmin, async (req, res) => {
  const result = stockUpdateSchema.safeParse({
    ...req.body,
    partId: req.params.id,
  });

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result.error.errors[0].message,
    });
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

    res.json({ success: true, message: "Stock increased successfully" });
  } catch (error) {
    console.error("Error updating stock:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});
// In routes/stock.js
router.post("/", authMiddleware, isAdmin, async (req, res) => {
  const { name, description, unitCost, quantity } = req.body;

  if (!name || quantity == null || unitCost == null) {
    return res.status(400).json({
      success: false,
      message: "Name, quantity, and unit cost are required",
    });
  }

  try {
    const newPart = await prisma.part.create({
      data: {
        name,
        description: description || null,
        unitCost: parseFloat(unitCost),
        quantity: parseInt(quantity),
      },
    });

    res.status(201).json({ success: true, part: newPart });
  } catch (error) {
    console.error("Error creating part:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});


/**
 * ➖ PATCH: Reduce quantity of a part (Admin Only)
 * URL: /stock/:id/reduce
 */
router.patch("/:id/reduce", authMiddleware, isAdmin, async (req, res) => {
  const result = stockUpdateSchema.safeParse({
    ...req.body,
    partId: req.params.id,
  });

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result.error.errors[0].message,
    });
  }

  const { partId, quantity, reason } = result.data;

  try {
    const part = await prisma.part.findUnique({ where: { id: partId } });

    if (!part) {
      return res.status(404).json({ success: false, message: "Part not found" });
    }

    if (part.quantity < quantity) {
      return res.status(400).json({
        success: false,
        message: "Insufficient stock to reduce",
      });
    }

    await prisma.part.update({
      where: { id: partId },
      data: {
        quantity: { decrement: quantity },
      },
    });

    await prisma.stockLog.create({
      data: {
        partId,
        change: -quantity,
        reason,
      },
    });

    res.json({ success: true, message: "Stock reduced successfully" });
  } catch (error) {
    console.error("Error reducing stock:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

export default router;

