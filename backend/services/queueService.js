const organizationQueries = require("../queries/organizationQueries");
const tokenQueries = require("../queries/tokenQueries");

const PRIORITY_WEIGHT = { emergency: 0, authorized: 1, senior: 2, normal: 3 };

const getEffectivePriority = (token) => {
  if (token.priority !== "normal" && token.priorityStatus === "approved") {
    return PRIORITY_WEIGHT[token.priority] ?? 3;
  }
  return PRIORITY_WEIGHT.normal;
};

const sortByPriority = (tokens) =>
  tokens.sort((a, b) => {
    const pa = getEffectivePriority(a);
    const pb = getEffectivePriority(b);
    if (pa !== pb) return pa - pb;
    return new Date(a.created_at) - new Date(b.created_at);
  });

class QueueService {
  static async joinQueue(orgId, name, phone = "", priority = "normal", verificationData = {}) {
    let priorityStatus = "none";
    if (priority !== "normal") {
      if (priority === "authorized" && verificationData.otpVerified) {
        priorityStatus = "approved";
      } else {
        priorityStatus = "pending";
      }
    }

    const org = await organizationQueries.incrementTokenCounter(orgId);
    if (!org) throw new Error("Organization not found");

    const tokenNumber = org.token_counter;
    const tokenDisplay = `T${String(tokenNumber).padStart(3, "0")}`;

    const token = await tokenQueries.create({
      orgId,
      name: name.trim(),
      phone: phone ? phone.trim() : "",
      tokenNumber,
      tokenDisplay,
      status: "waiting",
      priority: priority || "normal",
      priorityStatus,
      verificationData: {
        dob: verificationData.dob || "",
        govIdFilename: verificationData.govIdFilename || "",
        medicalDocFilename: verificationData.medicalDocFilename || "",
        emergencyReason: verificationData.emergencyReason || "",
        officialEmail: verificationData.officialEmail || "",
        otpCode: verificationData.otpCode || "",
        otpExpiry: verificationData.otpExpiry || null,
        otpVerified: verificationData.otpVerified || false,
      },
    });

    return token;
  }

  static async getQueue(orgId) {
    const queue = await tokenQueries.findByOrgId(orgId);
    const waiting = sortByPriority(queue.filter((t) => t.status === "waiting"));
    const others = queue.filter((t) => t.status !== "waiting");
    return [...waiting, ...others];
  }

  static async getActiveQueue(orgId) {
    const queue = await tokenQueries.findByOrgIdAndStatuses(orgId, ["waiting", "serving"]);
    const waiting = sortByPriority(queue.filter((t) => t.status === "waiting"));
    const serving = queue.filter((t) => t.status === "serving");
    return [...serving, ...waiting];
  }

  static async callNext(orgId, counterName = null) {
    const servingMatch = counterName
      ? { orgId, status: "serving", counter: counterName }
      : { orgId, status: "serving", counter: null };

    // Find and complete current serving token
    const current = counterName
      ? await tokenQueries.findServingByOrgIdAndCounter(orgId, counterName)
      : await tokenQueries.findServingByOrgId(orgId);

    if (current) {
      await tokenQueries.updateStatus(current.id, "completed", { completedAt: new Date() });
    }

    const waiting = await tokenQueries.findWaitingByOrgId(orgId);
    if (waiting.length === 0) return null;

    sortByPriority(waiting);
    return await tokenQueries.updateStatus(waiting[0].id, "serving", {
      servedAt: new Date(),
      counter: counterName,
    });
  }

  static async skipCurrent(orgId, counterName = null) {
    const current = counterName
      ? await tokenQueries.findServingByOrgIdAndCounter(orgId, counterName)
      : await tokenQueries.findServingByOrgId(orgId);

    if (!current) return null;
    return await tokenQueries.updateStatus(current.id, "skipped");
  }

  static async completeCurrent(orgId, counterName = null) {
    const current = counterName
      ? await tokenQueries.findServingByOrgIdAndCounter(orgId, counterName)
      : await tokenQueries.findServingByOrgId(orgId);

    if (!current) return null;
    return await tokenQueries.updateStatus(current.id, "completed", { completedAt: new Date() });
  }

  static async recallToken(orgId, tokenId) {
    const token = await tokenQueries.findByIdAndOrgId(tokenId, orgId);
    if (!token || token.status !== "skipped") throw new Error("Token not found or not in skipped state");
    return await tokenQueries.updateStatus(tokenId, "waiting", { servedAt: null, counter: null });
  }

  static async clearQueue(orgId) {
    const result = await tokenQueries.updateManyStatuses(orgId, ["waiting", "serving"], "completed", {
      completedAt: new Date(),
    });
    await organizationQueries.resetTokenCounter(orgId);
    return result;
  }

  static async getStats(orgId) {
    const stats = await tokenQueries.getStatsByOrgId(orgId);
    const recentCompleted = await tokenQueries.getRecentCompleted(orgId, 20);

    let avgWaitMinutes = null;
    let avgServiceMinutes = null;
    let avgRating = null;

    if (recentCompleted.length > 0) {
      const waits = recentCompleted
        .map((t) => (new Date(t.served_at) - new Date(t.created_at)) / 60000)
        .filter((w) => w >= 0 && w < 300);
      if (waits.length > 0) avgWaitMinutes = Math.round(waits.reduce((a, b) => a + b, 0) / waits.length);

      const services = recentCompleted
        .filter((t) => t.completed_at && t.served_at)
        .map((t) => (new Date(t.completed_at) - new Date(t.served_at)) / 60000)
        .filter((s) => s >= 0 && s < 120);
      if (services.length > 0) {
        avgServiceMinutes = Math.round((services.reduce((a, b) => a + b, 0) / services.length) * 10) / 10;
      }

      const ratings = recentCompleted
        .filter((t) => t.feedback?.rating)
        .map((t) => t.feedback.rating);
      if (ratings.length > 0) {
        avgRating = Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
      }
    }

    return { ...stats, avgWaitMinutes, avgServiceMinutes, avgRating };
  }

  static async getTokenById(tokenId) {
    return await tokenQueries.findById(tokenId);
  }

  static async getPendingPriorityRequests(orgId) {
    return await tokenQueries.getPendingPriorityRequests(orgId);
  }

  static async submitFeedback(orgId, tokenId, rating, comment) {
    const token = await tokenQueries.findByIdAndOrgId(tokenId, orgId);
    if (!token || token.status !== "completed") throw new Error("Token not found or not completed");
    if (token.feedback?.rating) throw new Error("Feedback already submitted");

    const feedback = {
      rating,
      comment: comment || "",
      submittedAt: new Date(),
    };
    return await tokenQueries.updateFeedback(tokenId, feedback);
  }
}

module.exports = QueueService;