require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth");
const itemRoutes = require("./routes/items");
const bidRoutes = require("./routes/bids");
const aiRoutes = require("./routes/ai");
const userRoutes = require("./routes/users");
const { setupSocketHandlers } = require("./socket");

const app = express();
const httpServer = http.createServer(app);

// ── Socket.io (real-time bidding) ──────────────
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});
setupSocketHandlers(io);

// ── Middleware ─────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:3000", credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting (prevent abuse)
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, message: { error: "Too many requests, slow down!" } });
app.use("/api/", limiter);

// Stricter limit for auth routes
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: "Too many login attempts" } });
app.use("/api/auth/", authLimiter);

// ── Routes ─────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/bids", bidRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/users", userRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString(), app: "BidX Auction API" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

// ── Start server ───────────────────────────────
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`\n🚀 BidX Server running on http://localhost:${PORT}`);
  console.log(`📡 Socket.io ready for real-time bidding`);
  console.log(`🤖 AI features: Gemini API connected`);
  console.log(`🗄️  Database: PostgreSQL via Prisma\n`);
});

module.exports = { app, io };
