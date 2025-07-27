import express from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { z } from "zod";

const router = express.Router();
const prisma = new PrismaClient();

const uuidParamSchema = z.object({
  id: z.string().uuid({ message: "Invalid notification ID" }),
});

// 📬 Get all notifications for the logged-in user
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    res.json({ notifications });
  } catch (error) {
    console.error("Fetch notifications failed:", error);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
});

// ✅ Mark a notification as read
router.patch("/:id/read", authMiddleware, async (req, res) => {
  const validation = uuidParamSchema.safeParse(req.params);
  if (!validation.success) {
    return res.status(400).json({ message: validation.error.errors[0].message });
  }

  const { id } = validation.data;

  try {
    const notification = await prisma.notification.findUnique({ where: { id } });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    if (notification.userId !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to update this notification" });
    }

    await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    res.json({ message: "Notification marked as read" });
  } catch (error) {
    console.error("Mark read failed:", error);
    res.status(500).json({ message: "Failed to update notification" });
  }
});

// ✅ Optional: Mark all as read
router.patch("/mark-all-read", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    res.json({ message: "All notifications marked as read" });
  } catch (error) {
    console.error("Mark all read failed:", error);
    res.status(500).json({ message: "Failed to update notifications" });
  }
});

export default router;
