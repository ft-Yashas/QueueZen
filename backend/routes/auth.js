const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const organizationQueries = require("../queries/organizationQueries");
const { protect } = require("../middleware/authMiddleware");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, message: "Too many login attempts. Try again in 15 minutes." },
});

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

const orgFields = (org) => ({
  id: org.id,
  orgName: org.org_name,
  department: org.department,
  serviceCenter: org.service_center,
  orgType: org.org_type,
  officialEmailDomain: org.official_email_domain,
  username: org.username,
  email: org.email,
});

// ─── POST /auth/register ──────────────────────────────────────────────────────
router.post(
  "/register",
  [
    body("orgName").trim().notEmpty().withMessage("Organization name is required"),
    body("department").trim().notEmpty().withMessage("Department is required"),
    body("serviceCenter").trim().notEmpty().withMessage("Service center is required"),
    body("orgType")
      .isIn(["college", "business", "government", "hospital"])
      .withMessage("Invalid organization type"),
    body("username").trim().isLength({ min: 3 }).withMessage("Username must be at least 3 characters"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { orgName, department, serviceCenter, orgType, officialEmailDomain, username, email, password } = req.body;

      const existing = await organizationQueries.findByUsernameOrEmail(username.toLowerCase(), email.toLowerCase());

      if (existing) {
        const field = existing.username === username.toLowerCase() ? "username" : "email";
        return res.status(409).json({ success: false, message: `This ${field} is already registered.` });
      }

      const org = await organizationQueries.create({
        orgName,
        department,
        serviceCenter,
        orgType,
        officialEmailDomain: officialEmailDomain ? officialEmailDomain.toLowerCase().replace(/^@/, "") : "",
        username,
        email,
        password,
      });

      res.status(201).json({
        success: true,
        message: "Organization registered successfully!",
        token: generateToken(org.id),
        org: orgFields(org),
      });
    } catch (error) {
      console.error("Register error:", error);
      if (error.code === "23505") {
        const field = error.constraint?.includes("username") ? "username" : "email";
        return res.status(409).json({ success: false, message: `This ${field} is already registered.` });
      }
      res.status(500).json({ success: false, message: "Server error during registration." });
    }
  }
);

// ─── POST /auth/login ─────────────────────────────────────────────────────────
router.post(
  "/login",
  loginLimiter,
  [
    body("username").trim().notEmpty().withMessage("Username is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { username, password } = req.body;
      const org = await organizationQueries.findByUsername(username.toLowerCase());
      if (!org) return res.status(401).json({ success: false, message: "Invalid username or password." });

      const isMatch = await bcrypt.compare(password, org.password);
      if (!isMatch) return res.status(401).json({ success: false, message: "Invalid username or password." });

      res.json({
        success: true,
        token: generateToken(org.id),
        org: orgFields(org),
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ success: false, message: "Server error during login." });
    }
  }
);

// ─── GET /auth/me ─────────────────────────────────────────────────────────────
router.get("/me", protect, async (req, res) => {
  res.json({ success: true, org: req.org });
});

// ─── PUT /auth/settings ───────────────────────────────────────────────────────
router.put(
  "/settings",
  protect,
  [
    body("orgName").optional().trim().notEmpty(),
    body("department").optional().trim().notEmpty(),
    body("serviceCenter").optional().trim().notEmpty(),
    body("officialEmailDomain").optional().trim(),
  ],
  async (req, res) => {
    try {
      const { orgName, department, serviceCenter, officialEmailDomain } = req.body;
      const updates = {};
      if (orgName) updates.orgName = orgName;
      if (department) updates.department = department;
      if (serviceCenter) updates.serviceCenter = serviceCenter;
      if (officialEmailDomain !== undefined) {
        updates.officialEmailDomain = officialEmailDomain.toLowerCase().replace(/^@/, "");
      }

      const org = await organizationQueries.update(req.org.id, updates);
      res.json({ success: true, org: organizationQueries.toPublic(org) });
    } catch (error) {
      res.status(500).json({ success: false, message: "Failed to update settings." });
    }
  }
);

module.exports = router;