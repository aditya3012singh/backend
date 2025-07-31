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

  const {
    customerName,
    mobileNumber,
    address,
    dateTime,
    serviceType,
    partsUsed,
    amountreceived
  } = validation.data;

  try {
    let summary = "";
    let totalMoney = 0;

    for (const item of partsUsed) {
      const part = await prisma.part.findUnique({ where: { id: item.id } });
      if (!part || part.quantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for part: ${item.id}`,
        });
      }

      summary += `${part.name} x${item.quantity}, `;
      totalMoney += part.unitCost * item.quantity;

      // Decrement stock
      await prisma.part.update({
        where: { id: item.id },
        data: { quantity: { decrement: item.quantity } },
      });
    }

    summary = summary.slice(0, -2); // remove trailing comma

    // Combine everything into remarks
    const remarks = `Customer: ${customerName}, Phone: ${mobileNumber}, Address: ${address}, DateTime: ${dateTime}, Service: ${serviceType}, AmountReceived : ${amountreceived}`;

    const report = await prisma.report.create({
      data: {
        technicianId: req.user.id,
        remarks,
        summary,
        totalMoney,
      },
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
router.get("/", authMiddleware, async (req, res) => {
  // Check if user is admin
  // if (!req.user || req.user.role !== "ADMIN") {
  //   return res.status(403).json({ success: false, message: "Access denied" });
  // }

  try {
    const reports = await prisma.report.findMany({
      include: {
        technician: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({ success: true, reports });
  } catch (error) {
    console.error("Error fetching reports:", error.stack || error);
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

// 🔄 PUT update report by ID (Technician only)
router.put("/:reportId", authMiddleware, async (req, res) => {
  const { reportId } = req.params;

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

  const {
    customerName,
    mobileNumber,
    address,
    dateTime,
    serviceType,
    partsUsed,
    amountreceived,
  } = validation.data;

  try {
    const existingReport = await prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!existingReport) {
      return res
        .status(404)
        .json({ success: false, message: "Report not found" });
    }

    if (existingReport.technicianId !== req.user.id) {
      return res
        .status(403)
        .json({ success: false, message: "You can only update your own reports" });
    }

    // Revert previous stock before applying new parts
    const previousSummaryParts = existingReport.summary
      .split(", ")
      .map((entry) => {
        const [name, qty] = entry.split(" x");
        return { name: name.trim(), quantity: parseInt(qty) || 0 };
      });

    for (const prev of previousSummaryParts) {
      const part = await prisma.part.findFirst({ where: { name: prev.name } });
      if (part) {
        await prisma.part.update({
          where: { id: part.id },
          data: { quantity: { increment: prev.quantity } },
        });
      }
    }

    // Handle new part usage
    let newSummary = "";
    let newTotalMoney = 0;

    for (const item of partsUsed) {
      const part = await prisma.part.findUnique({ where: { id: item.id } });
      if (!part || part.quantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for part: ${item.id}`,
        });
      }

      newSummary += `${part.name} x${item.quantity}, `;
      newTotalMoney += part.unitCost * item.quantity;

      await prisma.part.update({
        where: { id: item.id },
        data: { quantity: { decrement: item.quantity } },
      });
    }

    newSummary = newSummary.slice(0, -2); // remove trailing comma

    const newRemarks = `Customer: ${customerName}, Phone: ${mobileNumber}, Address: ${address}, DateTime: ${dateTime}, Service: ${serviceType}, AmountReceived : ${amountreceived}`;

    const updatedReport = await prisma.report.update({
      where: { id: reportId },
      data: {
        remarks: newRemarks,
        summary: newSummary,
        totalMoney: newTotalMoney,
      },
    });

    res.json({
      success: true,
      message: "Report updated successfully",
      report: updatedReport,
    });
  } catch (error) {
    console.error("Error updating report:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});


export default router;

