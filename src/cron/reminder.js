import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient();

// Email transporter (Gmail)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Run every day at 10 AM
cron.schedule("0 10 * * *", async () => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  try {
    const dueBookings = await prisma.booking.findMany({
      where: {
        status: "COMPLETED",
        serviceDate: { lte: thirtyDaysAgo },
      },
      include: {
        user: true,
        technician: true,
      },
    });

    if (!dueBookings.length) {
      console.log("✅ No 30-day due services today.");
      return;
    }

    let notifiedCount = 0;

    for (const booking of dueBookings) {
      // Avoid duplicate notifications
      const alreadyNotified = await prisma.notification.findFirst({
        where: {
          message: { contains: booking.id },
        },
      });
      if (alreadyNotified) continue;

      const reminderMessage = `30 days have passed since the last ${booking.serviceType.toLowerCase()} for ${booking.user.name} (Booking ID: ${booking.id}). Time to schedule a new service.`;

      // 1. Notify all Admins
      const admins = await prisma.user.findMany({ where: { role: "ADMIN" } });
      for (const admin of admins) {
        await prisma.notification.create({
          data: {
            userId: admin.id,
            title: "Service Due Reminder",
            message: reminderMessage,
          },
        });

        if (admin.email) {
          try {
            await transporter.sendMail({
              from: process.env.EMAIL_USER,
              to: admin.email,
              subject: "30-Day Service Reminder",
              text: reminderMessage,
            });
          } catch (err) {
            console.error(`Email to admin ${admin.email} failed:`, err.message);
          }
        }
      }

      // 2. Notify the Technician (Provider)
      if (booking.technicianId) {
        await prisma.notification.create({
          data: {
            userId: booking.technicianId,
            title: "Service Due Reminder",
            message: reminderMessage,
          },
        });
      }

      // 3. Notify the User
      await prisma.notification.create({
        data: {
          userId: booking.userId,
          title: "It's Time for Your Next Service",
          message: `It's been 30 days since your last ${booking.serviceType.toLowerCase()} (Booking ID: ${booking.id}). Please contact us to schedule your next visit.`,
        },
      });

      if (booking.user.email) {
        try {
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: booking.user.email,
            subject: "Time for Your Next Service",
            text: `Hi ${booking.user.name},\n\nIt's been 30 days since your last ${booking.serviceType.toLowerCase()}. Please contact us to schedule your next visit.\n\nBooking ID: ${booking.id}\nDate of last service: ${booking.serviceDate.toDateString()}\n\nThank you,\nTeam RO Services`,
          });
        } catch (emailErr) {
          console.error(`Email to user ${booking.user.email} failed:`, emailErr.message);
        }
      }

      notifiedCount++;
    }

    console.log(`✅ ${notifiedCount} reminders sent to Admins, Technicians, and Users.`);
  } catch (error) {
    console.error("❌ Cron job error:", error);
  }
});
