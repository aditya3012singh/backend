// server.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import cron from "node-cron";
import "./cron/reminder.js"; // 👈 Your cron job for due service reminders

// Routes
import authRoutes from "./routes/user.js";
import bookingRoutes from "./routes/booking.js";
import notificationRoutes from "./routes/notification.js";
import technicianRoutes from "./routes/technician.js";
import reportRoutes from "./routes/report.js";
import stockRoutes from "./routes/stock.js";
import purchaseRoutes from "./routes/purchase.js";
import dashboardRoutes from "./routes/dashboard.js";
import dueServiceRoutes from "./routes/dueServices.js";
import historyRoutes from "./routes/history.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/technicians", technicianRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/due-services", dueServiceRoutes);
app.use("/api/history", historyRoutes);

// Health check
app.get("/", (req, res) => {
  res.send("RO Service App API is running ✅");
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
