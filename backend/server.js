require("dotenv").config({ path: "../.env" });
const http = require("http");
const cron = require("node-cron");
const { Server } = require("socket.io");
const connectDB = require("./config/db");
const organizationQueries = require("./queries/organizationQueries");
const app = require("./app");

const PORT = process.env.PORT || 5000;

const start = async () => {
  try {
    await connectDB();
    console.log("✅ Database connected");
  } catch (err) {
    console.error("Failed to connect to database:", err.message);
    process.exit(1);
  }

  const server = http.createServer(app);

  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (origin.endsWith(".vercel.app")) return callback(null, true);
        const allowed = [process.env.CLIENT_URL, "http://localhost:3000"].filter(Boolean);
        if (allowed.includes(origin)) return callback(null, true);
        callback(new Error(`CORS: origin ${origin} not allowed`));
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  app.set("io", io);

  io.on("connection", (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    socket.on("joinOrg", (orgId) => {
      if (!orgId) return;
      socket.join(`org:${orgId}`);
      console.log(`📌 Socket ${socket.id} joined room: org:${orgId}`);
    });

    socket.on("leaveOrg", (orgId) => {
      socket.leave(`org:${orgId}`);
    });

    socket.on("disconnect", (reason) => {
      console.log(`❌ Socket disconnected: ${socket.id} (${reason})`);
    });

    socket.on("error", (err) => {
      console.error(`Socket error [${socket.id}]:`, err);
    });
  });

  // ─── Daily midnight token counter reset ───────────────────────────────────────
  cron.schedule("0 0 * * *", async () => {
    try {
      await organizationQueries.resetAllTokenCounters();
      console.log("🔄 Token counters reset for new day.");
    } catch (err) {
      console.error("Cron reset error:", err.message);
    }
  });

  server.listen(PORT, () => {
    console.log(`\n🚀 QueueZen Server running on port ${PORT}`);
    console.log(`📡 Socket.IO ready`);
    console.log(`🌐 API: http://localhost:${PORT}`);
    console.log(`❤️  Health: http://localhost:${PORT}/health\n`);
  });

  process.on("SIGTERM", () => {
    console.log("SIGTERM received. Shutting down gracefully...");
    server.close(() => {
      console.log("Server closed.");
      process.exit(0);
    });
  });
};

start();