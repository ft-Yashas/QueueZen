const jwt = require("jsonwebtoken");
const organizationQueries = require("../queries/organizationQueries");
const staffQueries = require("../queries/staffQueries");

const protect = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ success: false, message: "Not authorized. No token provided." });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type === "staff") {
      return res.status(403).json({ success: false, message: "Admin access required." });
    }
    const org = await organizationQueries.findById(decoded.id);
    if (!org) return res.status(401).json({ success: false, message: "Organization not found." });
    req.org = organizationQueries.toPublic(org);
    next();
  } catch (error) {
    const msg = error.name === "TokenExpiredError"
      ? "Token expired. Please login again."
      : "Invalid token.";
    return res.status(401).json({ success: false, message: msg });
  }
};

const protectStaff = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ success: false, message: "Not authorized." });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== "staff") {
      return res.status(403).json({ success: false, message: "Staff access required." });
    }
    const staff = await staffQueries.findById(decoded.staffId);
    if (!staff || !staff.is_active) {
      return res.status(401).json({ success: false, message: "Staff account not found." });
    }
    const org = await organizationQueries.findById(decoded.orgId);
    if (!org) return res.status(401).json({ success: false, message: "Organization not found." });
    req.staff = staffQueries.toPublic(staff);
    req.org = organizationQueries.toPublic(org);
    req.counterName = staff.counter_name;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid token." });
  }
};

const protectAny = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ success: false, message: "Not authorized." });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type === "staff") {
      const staff = await staffQueries.findById(decoded.staffId);
      if (!staff || !staff.is_active) {
        return res.status(401).json({ success: false, message: "Staff account not found." });
      }
      const org = await organizationQueries.findById(decoded.orgId);
      if (!org) return res.status(401).json({ success: false, message: "Organization not found." });
      req.staff = staffQueries.toPublic(staff);
      req.org = organizationQueries.toPublic(org);
      req.counterName = staff.counter_name;
    } else {
      const org = await organizationQueries.findById(decoded.id);
      if (!org) return res.status(401).json({ success: false, message: "Organization not found." });
      req.org = organizationQueries.toPublic(org);
      req.counterName = null;
    }
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid token." });
  }
};

module.exports = { protect, protectStaff, protectAny };