// routes/purchase.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/isAdmin.js";
import { purchaseSchema } from "../validators/validate.js";

const router = express.Router();
const prisma = new PrismaClient();

// 🛒 Create a Purchase Entry (Admin only)
router.post("/", authMiddleware, isAdmin, async (req, res) => {
  const validation = purchaseSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: validation.error.errors[0].message,
    });
  }

  const {
    vendorName,
    billNumber,
    purchaseDate,
    partId,
    quantity,
    costPerUnit,
    notes,
  } = validation.data;

  try {
    // Check if part exists
    const part = await prisma.part.findUnique({ where: { id: partId } });
    if (!part) {
      return res.status(404).json({ success: false, message: "Part not found" });
    }

    // Create Purchase Entry
    await prisma.purchaseEntry.create({
      data: {
        vendorName,
        billNumber,
        purchaseDate: new Date(purchaseDate),
        partId,
        quantity,
        costPerUnit,
        notes,
      },
    });

    // Update Stock
    await prisma.part.update({
      where: { id: partId },
      data: {
        quantity: { increment: quantity },
      },
    });

    // Log Stock Update
    await prisma.stockLog.create({
      data: {
        partId,
        change: quantity,
        reason: "Purchased",
      },
    });

    res.status(201).json({ success: true, message: "Purchase recorded successfully" });
  } catch (error) {
    console.error("Error recording purchase:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

export default router;
