const express = require("express");
const router = express.Router();
const { v4: isUuid } = require("uuid");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { body, validationResult } = require("express-validator");
const rateLimit = require("express-rate-limit");
const { protect, protectAny } = require("../middleware/authMiddleware");
const QueueService = require("../services/queueService");
const { predictWaitTime } = require("../services/aiService");
const organizationQueries = require("../queries/organizationQueries");
const tokenQueries = require("../queries/tokenQueries");

// ─── File upload setup ────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, "..", "uploads", "priority-docs");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Only JPEG, PNG, and PDF files are allowed."), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const joinUpload = upload.fields([
  { name: "govIdFile", maxCount: 1 },
  { name: "medicalDocFile", maxCount: 1 },
]);

// ─── Rate limits ──────────────────────────────────────────────────────────────
const joinLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { success: false, message: "Too many join requests. Please wait a moment." },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
const isValidId = (id) => {
  if (!id) return false;
  try {
    return isUuid(id);
  } catch {
    return false;
  }
};

const emitUpdate = async (req, orgId) => {
  try {
    const io = req.app.get("io");
    if (!io) return;
    const [queue, stats] = await Promise.all([
      QueueService.getQueue(orgId),
      QueueService.getStats(orgId),
    ]);
    io.to(`org:${orgId}`).emit("queueUpdated", {
      queue: queue.map(t => tokenQueries.toPublic(t)),
      stats
    });
  } catch (e) {
    console.error("Socket emit error:", e.message);
  }
};

const sanitizeToken = (token) => {
  const t = { ...(token._doc || token) };
  if (t.verification_data) {
    t.verification_data = { ...t.verification_data };
    delete t.verification_data.otpCode;
  }
  return tokenQueries.toPublic(t);
};

// ══════════════════════════════════════════════════════════════════════════════
// IMPORTANT: /action/* routes MUST come before /:orgId
// ══════════════════════════════════════════════════════════════════════════════

// ─── ADMIN: GET /queue/action/stats ───────────────────────────────────────────
router.get("/action/stats", protect, async (req, res) => {
  try {
    const stats = await QueueService.getStats(req.org.id);
    res.json({ success: true, stats });
  } catch {
    res.status(500).json({ success: false, message: "Failed to fetch stats." });
  }
});

// ─── ADMIN: GET /queue/action/priority-requests ────────────────────────────────
router.get("/action/priority-requests", protect, async (req, res) => {
  try {
    const requests = await QueueService.getPendingPriorityRequests(req.org.id);
    res.json({ success: true, requests: requests.map(r => tokenQueries.toPublic(r)) });
  } catch {
    res.status(500).json({ success: false, message: "Failed to fetch priority requests." });
  }
});

// ─── ADMIN: POST /queue/action/verify-priority ────────────────────────────────
router.post(
  "/action/verify-priority",
  protect,
  [
    body("tokenId").notEmpty().withMessage("Token ID is required"),
    body("action").isIn(["approve", "reject"]).withMessage("Action must be approve or reject"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { tokenId, action } = req.body;
    if (!isValidId(tokenId)) {
      return res.status(400).json({ success: false, message: "Invalid token ID." });
    }

    try {
      const token = await tokenQueries.findByIdAndOrgId(tokenId, req.org.id);
      if (!token) {
        return res.status(404).json({ success: false, message: "Token not found." });
      }
      if (token.priority_status !== "pending") {
        return res.status(400).json({ success: false, message: "Token is not pending verification." });
      }

      const newStatus = action === "approve" ? "approved" : "rejected";
      await tokenQueries.updatePriorityStatus(tokenId, newStatus);

      await emitUpdate(req, req.org.id);

      res.json({
        success: true,
        message: `Priority ${newStatus} for ${token.token_display}.`,
      });
    } catch (error) {
      console.error("Verify priority error:", error);
      res.status(500).json({ success: false, message: "Failed to process priority request." });
    }
  }
);

// ─── ADMIN/STAFF: POST /queue/action/next ─────────────────────────────────────
router.post("/action/next", protectAny, async (req, res) => {
  try {
    const next = await QueueService.callNext(req.org.id, req.counterName);
    await emitUpdate(req, req.org.id);
    res.json({
      success: true,
      message: next ? `Now serving ${next.token_display}` : "No more tokens in queue.",
      token: next ? tokenQueries.toPublic(next) : null,
    });
  } catch {
    res.status(500).json({ success: false, message: "Failed to call next token." });
  }
});

// ─── ADMIN/STAFF: POST /queue/action/skip ─────────────────────────────────────
router.post("/action/skip", protectAny, async (req, res) => {
  try {
    const skipped = await QueueService.skipCurrent(req.org.id, req.counterName);
    await emitUpdate(req, req.org.id);
    res.json({
      success: true,
      message: skipped ? `Token ${skipped.token_display} skipped.` : "No token currently serving.",
      token: skipped ? tokenQueries.toPublic(skipped) : null,
    });
  } catch {
    res.status(500).json({ success: false, message: "Failed to skip token." });
  }
});

// ─── ADMIN/STAFF: POST /queue/action/complete ─────────────────────────────────
router.post("/action/complete", protectAny, async (req, res) => {
  try {
    const completed = await QueueService.completeCurrent(req.org.id, req.counterName);
    await emitUpdate(req, req.org.id);
    res.json({
      success: true,
      message: completed ? `Token ${completed.token_display} completed.` : "No token currently serving.",
      token: completed ? tokenQueries.toPublic(completed) : null,
    });
  } catch {
    res.status(500).json({ success: false, message: "Failed to complete token." });
  }
});

// ─── ADMIN/STAFF: POST /queue/action/recall ───────────────────────────────────
router.post("/action/recall", protectAny, async (req, res) => {
  const { tokenId } = req.body;
  if (!tokenId || !isValidId(tokenId)) {
    return res.status(400).json({ success: false, message: "Valid token ID is required." });
  }
  try {
    const token = await QueueService.recallToken(req.org.id, tokenId);
    await emitUpdate(req, req.org.id);
    res.json({ success: true, message: `${token.token_display} re-queued.`, token: tokenQueries.toPublic(token) });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || "Failed to recall token." });
  }
});

// ─── ADMIN: POST /queue/action/toggle-queue ───────────────────────────────────
router.post("/action/toggle-queue", protect, async (req, res) => {
  try {
    const org = await organizationQueries.findById(req.org.id);
    if (!org) return res.status(404).json({ success: false, message: "Organization not found." });

    const updated = await organizationQueries.update(org.id, { isQueueOpen: !org.is_queue_open });

    const io = req.app.get("io");
    if (io) {
      io.to(`org:${org.id}`).emit("queueStatusChanged", { isQueueOpen: updated.is_queue_open });
    }

    res.json({
      success: true,
      isQueueOpen: updated.is_queue_open,
      message: `Queue is now ${updated.is_queue_open ? "open" : "closed"}.`,
    });
  } catch {
    res.status(500).json({ success: false, message: "Failed to toggle queue status." });
  }
});

// ─── ADMIN: DELETE /queue/action/clear ────────────────────────────────────────
router.delete("/action/clear", protect, async (req, res) => {
  try {
    await QueueService.clearQueue(req.org.id);
    await emitUpdate(req, req.org.id);
    res.json({ success: true, message: "Queue cleared successfully." });
  } catch {
    res.status(500).json({ success: false, message: "Failed to clear queue." });
  }
});

// ─── PUBLIC: GET /queue/:orgId ────────────────────────────────────────────────
router.get("/:orgId", async (req, res) => {
  if (!isValidId(req.params.orgId)) {
    return res.status(404).json({ success: false, message: "Organization not found." });
  }
  try {
    const org = await organizationQueries.findById(req.params.orgId);
    if (!org) return res.status(404).json({ success: false, message: "Organization not found." });

    const [queue, stats] = await Promise.all([
      QueueService.getQueue(req.params.orgId),
      QueueService.getStats(req.params.orgId),
    ]);

    res.json({
      success: true,
      org: organizationQueries.toPublic(org),
      queue: queue.map(t => tokenQueries.toPublic(t)),
      stats
    });
  } catch {
    res.status(500).json({ success: false, message: "Failed to fetch queue." });
  }
});

// ─── PUBLIC: POST /queue/:orgId/join ──────────────────────────────────────────
router.post("/:orgId/join", joinLimiter, (req, res, next) => {
  joinUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
    }
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
}, async (req, res) => {
  if (!isValidId(req.params.orgId)) {
    return res.status(404).json({ success: false, message: "Organization not found." });
  }

  const name = req.body.name?.trim();
  const phone = req.body.phone?.trim() || "";
  const priority = req.body.priority || "normal";

  if (!name) {
    return res.status(400).json({ success: false, message: "Name is required." });
  }

  const validPriorities = ["normal", "senior", "emergency", "authorized"];
  if (!validPriorities.includes(priority)) {
    return res.status(400).json({ success: false, message: "Invalid priority." });
  }

  try {
    const org = await organizationQueries.findById(req.params.orgId);
    if (!org) return res.status(404).json({ success: false, message: "Organization not found." });

    if (!org.is_queue_open) {
      return res.status(403).json({ success: false, message: "The queue is currently closed." });
    }

    if (priority === "emergency" && org.org_type !== "hospital") {
      return res.status(400).json({ success: false, message: "Emergency priority is only available for hospital queues." });
    }

    const govIdFile = req.files?.govIdFile?.[0];
    const medicalDocFile = req.files?.medicalDocFile?.[0];

    const verificationData = {
      dob: req.body.dob || "",
      govIdFilename: govIdFile ? govIdFile.filename : "",
      medicalDocFilename: medicalDocFile ? medicalDocFile.filename : "",
      emergencyReason: req.body.emergencyReason || "",
      officialEmail: req.body.officialEmail || "",
      otpVerified: false,
    };

    let generatedOtp = null;
    if (priority === "authorized") {
      const email = verificationData.officialEmail.toLowerCase();
      if (!email) {
        return res.status(400).json({ success: false, message: "Official email is required for Authorized Priority." });
      }

      if (org.official_email_domain) {
        const domain = org.official_email_domain.toLowerCase().replace(/^@/, "");
        if (!email.endsWith(`@${domain}`)) {
          return res.status(400).json({
            success: false,
            message: `Email must be from @${domain} to use Authorized Priority.`,
          });
        }
      }

      generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      verificationData.otpCode = generatedOtp;
      verificationData.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    }

    const token = await QueueService.joinQueue(
      req.params.orgId,
      name,
      phone,
      priority,
      verificationData
    );

    await emitUpdate(req, req.params.orgId);

    if (priority === "senior" || priority === "emergency") {
      const io = req.app.get("io");
      if (io) {
        io.to(`org:${req.params.orgId}`).emit("priorityRequest", {
          tokenId: token.id,
          tokenDisplay: token.token_display,
          name: token.name,
          priority: token.priority,
          verificationData: {
            dob: token.verification_data?.dob,
            govIdFilename: token.verification_data?.govIdFilename,
            medicalDocFilename: token.verification_data?.medicalDocFilename,
            emergencyReason: token.verification_data?.emergencyReason,
          },
        });
      }
    }

    const responseToken = sanitizeToken(token);
    res.status(201).json({
      success: true,
      token: responseToken,
      ...(generatedOtp ? { demoOtp: generatedOtp } : {}),
    });
  } catch (error) {
    console.error("Join queue error:", error);
    res.status(500).json({ success: false, message: "Failed to join queue." });
  }
});

// ─── PUBLIC: POST /queue/:orgId/token/:tokenId/verify-otp ─────────────────────
router.post("/:orgId/token/:tokenId/verify-otp", async (req, res) => {
  const { orgId, tokenId } = req.params;
  const { otpCode } = req.body;

  if (!isValidId(orgId) || !isValidId(tokenId)) {
    return res.status(404).json({ success: false, message: "Token not found." });
  }

  if (!otpCode) {
    return res.status(400).json({ success: false, message: "OTP is required." });
  }

  try {
    const token = await tokenQueries.findById(tokenId);
    if (!token || token.org_id.toString() !== orgId) {
      return res.status(404).json({ success: false, message: "Token not found." });
    }

    if (token.priority !== "authorized") {
      return res.status(400).json({ success: false, message: "OTP verification is only for Authorized Priority." });
    }

    if (token.priority_status === "approved") {
      return res.json({ success: true, message: "Priority already verified." });
    }

    const vd = token.verification_data;
    if (!vd?.otpCode) {
      return res.status(400).json({ success: false, message: "No OTP was generated for this token." });
    }

    if (vd.otpExpiry && new Date(vd.otpExpiry) < new Date()) {
      return res.status(400).json({ success: false, message: "OTP has expired. Please join the queue again." });
    }

    if (vd.otpCode !== String(otpCode).trim()) {
      return res.status(400).json({ success: false, message: "Incorrect OTP. Please try again." });
    }

    const newVd = { ...vd, otpVerified: true };
    await tokenQueries.updateVerificationData(tokenId, newVd);
    await tokenQueries.updatePriorityStatus(tokenId, "approved");

    await emitUpdate(req, orgId);

    res.json({ success: true, message: "Authorized Priority verified successfully!" });
  } catch (error) {
    console.error("OTP verify error:", error);
    res.status(500).json({ success: false, message: "OTP verification failed." });
  }
});

// ─── PUBLIC: POST /queue/:orgId/token/:tokenId/feedback ───────────────────────
router.post("/:orgId/token/:tokenId/feedback", async (req, res) => {
  const { orgId, tokenId } = req.params;
  const { rating, comment } = req.body;

  if (!isValidId(orgId) || !isValidId(tokenId)) {
    return res.status(404).json({ success: false, message: "Token not found." });
  }

  const ratingNum = Number(rating);
  if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ success: false, message: "Rating must be between 1 and 5." });
  }

  try {
    const token = await QueueService.submitFeedback(orgId, tokenId, ratingNum, comment || "");
    res.json({ success: true, message: "Feedback submitted. Thank you!", token: tokenQueries.toPublic(token) });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || "Failed to submit feedback." });
  }
});

// ─── PUBLIC: GET /queue/:orgId/token/:tokenId ─────────────────────────────────
router.get("/:orgId/token/:tokenId", async (req, res) => {
  const { orgId, tokenId } = req.params;
  if (!isValidId(orgId) || !isValidId(tokenId)) {
    return res.status(404).json({ success: false, message: "Token not found." });
  }
  try {
    const token = await tokenQueries.findById(tokenId);
    if (!token || token.org_id.toString() !== orgId) {
      return res.status(404).json({ success: false, message: "Token not found." });
    }

    const queue = await QueueService.getQueue(orgId);
    const waitingQueue = queue.filter((t) => t.status === "waiting");
    const position = waitingQueue.findIndex((t) => t.id.toString() === tokenId);

    res.json({ success: true, token: tokenQueries.toPublic(token), position: position === -1 ? null : position });
  } catch {
    res.status(500).json({ success: false, message: "Failed to fetch token." });
  }
});

// ─── PUBLIC: GET /queue/:orgId/token/:tokenId/ai-wait-estimate ────────────────
router.get("/:orgId/token/:tokenId/ai-wait-estimate", async (req, res) => {
  const { orgId, tokenId } = req.params;
  if (!isValidId(orgId) || !isValidId(tokenId)) {
    return res.status(404).json({ success: false, message: "Token not found." });
  }

  try {
    const token = await tokenQueries.findById(tokenId);
    if (!token || token.org_id.toString() !== orgId) {
      return res.status(404).json({ success: false, message: "Token not found." });
    }

    if (token.status !== "waiting") return res.json({ success: true, estimate: null });

    const [queue, stats] = await Promise.all([
      QueueService.getQueue(orgId),
      QueueService.getStats(orgId),
    ]);

    const waitingQueue = queue.filter((t) => t.status === "waiting");
    const position = waitingQueue.findIndex((t) => t.id.toString() === tokenId);

    if (position === -1) return res.json({ success: true, estimate: null });

    const aheadBreakdown = { emergency: 0, authorized: 0, senior: 0, normal: 0 };
    waitingQueue.slice(0, position).forEach((t) => {
      const key = t.priority === "authorized" ? "authorized" : t.priority;
      if (aheadBreakdown[key] !== undefined) aheadBreakdown[key]++;
    });

    const now = new Date();
    const timeOfDay = now.toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit", hour12: true,
    });

    const estimate = await predictWaitTime({
      position,
      aheadBreakdown,
      avgServiceMinutes: stats.avgServiceMinutes,
      avgWaitMinutes: stats.avgWaitMinutes,
      totalWaiting: stats.waiting,
      priority: token.priority,
      timeOfDay,
    });

    res.json({ success: true, estimate });
  } catch (error) {
    console.error("AI wait estimate error:", error);
    res.status(500).json({ success: false, message: "Estimation unavailable." });
  }
});

module.exports = router;