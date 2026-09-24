import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import userRoutes from "./routes/userRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/period_tracker";

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Routes
app.use("/api/user", userRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  res.json({
    status: "ok",
    service: "Period Tracker API",
    database: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

// Database connection & server listener
console.log(`Connecting to MongoDB at ${MONGODB_URI}...`);

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("✅ Successfully connected to MongoDB");
  })
  .catch((err) => {
    console.warn("⚠️ Could not connect to local MongoDB database:", err.message);
    console.warn("💡 Tip: Make sure MongoDB Service or mongod is running on your computer, or set MONGODB_URI in .env");
  });

app.listen(PORT, () => {
  console.log(`🚀 Express Backend Server running on http://localhost:${PORT}`);
});
