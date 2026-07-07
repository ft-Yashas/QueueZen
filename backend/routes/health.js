const express = require("express");
const router = express.Router();
const { pool } = require("../config/db");

router.get("/", (req, res) => {
  pool.query("SELECT 1")
    .then(() => {
      res.json({
        success: true,
        status: "QueueZen API is running 🚀",
        database: "connected",
        timestamp: new Date().toISOString(),
        uptime: `${Math.floor(process.uptime())}s`,
      });
    })
    .catch(() => {
      res.json({
        success: true,
        status: "QueueZen API is running 🚀",
        database: "disconnected",
        timestamp: new Date().toISOString(),
        uptime: `${Math.floor(process.uptime())}s`,
      });
    });
});

module.exports = router;