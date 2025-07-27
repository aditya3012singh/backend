// cron/serviceReminder.js
import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient();

// Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ⏰ Cron job: Runs every day at 10:00 AM
cron.schedule("0 10 * * *", async () => {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  try {
    const oldBookings = await prisma.booking.findMany({
      where: {
        status: "COMPLETED",
        serviceDate: { lte: threeMonthsAgo },
      },
      include: { user: true },
    });

    if (!oldBookings.length) {
      console.log("✅ No due services found today.");
      return;
    }

    let count = 0;

    for (const booking of oldBookings) {
      // Prevent duplicate reminders
      const alreadyNotified = await prisma.notification.findFirst({
        where: {
          userId: booking.userId,
          message: {
            contains: booking.id,
          },
        },
      });

      if (alreadyNotified) continue;

      // 🛎️ Create in-app notification
      await prisma.notification.create({
        data: {
          userId: booking.userId,
          title: "Service Reminder",
          message: `It's time for another ${booking.serviceType.toLowerCase()} service (Booking ID: ${booking.id}).`,
        },
      });

      // 📧 Send email reminder
      if (booking.user.email) {
        try {
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: booking.user.email,
            subject: "Service Reminder",
            text: `Hi ${booking.user.name},\n\nIt's time for another ${booking.serviceType.toLowerCase()} service for your RO system.\n\nBooking ID: ${booking.id}\nDate of last service: ${booking.serviceDate.toDateString()}\n\nThank you,\nTeam RO Services`,
          });
        } catch (emailErr) {
          console.error("❌ Email failed for:", booking.user.email, emailErr.message);
        }
      }

      count++;
    }

    console.log(`✅ ${count} service reminders created and emails sent.`);
  } catch (error) {
    console.error("❌ Cron job error:", error);
  }
});
