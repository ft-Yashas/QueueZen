const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const { protect, protectStaff } = require("../middleware/authMiddleware");
const staffQueries = require("../queries/staffQueries");

// ─── POST /staff/login ────────────────────────────────────────────────────────
router.post(
  "/login",
  [
    body("username").notEmpty().withMessage("Username is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { username, password } = req.body;

    try {
      const staff = await staffQueries.findByUsername(username.toLowerCase().trim());
      if (!staff || !staff.is_active) {
        return res.status(401).json({ success: false, message: "Invalid credentials." });
      }

      const match = await bcrypt.compare(password, staff.password);
      if (!match) {
        return res.status(401).json({ success: false, message: "Invalid credentials." });
      }

      const token = jwt.sign(
        {
          staffId: staff.id,
          orgId: staff.org_id,
          counterName: staff.counter_name,
          type: "staff",
        },
        process.env.JWT_SECRET,
        { expiresIn: "12h" }
      );

      res.json({
        success: true,
        token,
        staff: {
          id: staff.id,
          counterName: staff.counter_name,
          username: staff.username,
          orgId: staff.org_id,
        },
      });
    } catch (error) {
      console.error("Staff login error:", error);
      res.status(500).json({ success: false, message: "Login failed." });
    }
  }
);

// ─── GET /staff/me ────────────────────────────────────────────────────────────
router.get("/me", protectStaff, async (req, res) => {
  res.json({
    success: true,
    staff: req.staff,
    org: req.org,
    counterName: req.counterName,
  });
});

// ─── GET /staff/list ──────────────────────────────────────────────────────────
router.get("/list", protect, async (req, res) => {
  try {
    const staffList = await staffQueries.findByOrgId(req.org.id);
    res.json({ success: true, staff: staffList.map(s => staffQueries.toPublic(s)) });
  } catch {
    res.status(500).json({ success: false, message: "Failed to fetch staff list." });
  }
});

// ─── POST /staff/create ───────────────────────────────────────────────────────
router.post(
  "/create",
  protect,
  [
    body("counterName").trim().notEmpty().withMessage("Counter name is required").isLength({ max: 50 }),
    body("username").trim().notEmpty().withMessage("Username is required").isLength({ min: 3, max: 30 }),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { counterName, username, password } = req.body;

    try {
      const existing = await staffQueries.findByUsername(username.toLowerCase().trim());
      if (existing) {
        return res.status(400).json({ success: false, message: "Username already taken." });
      }

      const staff = await staffQueries.create({
        orgId: req.org.id,
        counterName: counterName.trim(),
        username: username.toLowerCase().trim(),
        password,
      });

      res.status(201).json({
        success: true,
        message: `Counter staff "${staff.counter_name}" created.`,
        staff: staffQueries.toPublic(staff),
      });
    } catch (error) {
      console.error("Create staff error:", error);
      if (error.code === "23505") {
        return res.status(400).json({ success: false, message: "Username already taken." });
      }
      res.status(500).json({ success: false, message: "Failed to create staff account." });
    }
  }
);

// ─── DELETE /staff/:staffId ───────────────────────────────────────────────────
router.delete("/:staffId", protect, async (req, res) => {
  try {
    const staff = await staffQueries.findByIdAndOrgId(req.params.staffId, req.org.id);
    if (!staff) {
      return res.status(404).json({ success: false, message: "Staff member not found." });
    }
    await staffQueries.softDelete(req.params.staffId);
    res.json({ success: true, message: `Staff member "${staff.counter_name}" deleted.` });
  } catch {
    res.status(500).json({ success: false, message: "Failed to delete staff member." });
  }
});

module.exports = router;