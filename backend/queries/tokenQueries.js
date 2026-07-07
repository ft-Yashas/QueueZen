const { query } = require("../config/db");

const tokenQueries = {
  async findById(id) {
    const result = await query("SELECT * FROM tokens WHERE id = $1", [id]);
    return result.rows[0] || null;
  },

  async findByIdAndOrgId(tokenId, orgId) {
    const result = await query(
      "SELECT * FROM tokens WHERE id = $1 AND org_id = $2",
      [tokenId, orgId]
    );
    return result.rows[0] || null;
  },

  async findByOrgId(orgId) {
    const result = await query(
      "SELECT * FROM tokens WHERE org_id = $1 ORDER BY token_number ASC",
      [orgId]
    );
    return result.rows;
  },

  async findByOrgIdAndStatus(orgId, status) {
    const result = await query(
      "SELECT * FROM tokens WHERE org_id = $1 AND status = $2 ORDER BY created_at ASC",
      [orgId, status]
    );
    return result.rows;
  },

  async findByOrgIdAndStatuses(orgId, statuses) {
    const placeholders = statuses.map((_, i) => `$${i + 2}`).join(", ");
    const result = await query(
      `SELECT * FROM tokens WHERE org_id = $1 AND status IN (${placeholders}) ORDER BY created_at ASC`,
      [orgId, ...statuses]
    );
    return result.rows;
  },

  async findWaitingByOrgId(orgId) {
    const result = await query(
      "SELECT * FROM tokens WHERE org_id = $1 AND status = 'waiting' ORDER BY created_at ASC",
      [orgId]
    );
    return result.rows;
  },

  async findServingByOrgIdAndCounter(orgId, counterName) {
    const result = await query(
      "SELECT * FROM tokens WHERE org_id = $1 AND status = 'serving' AND counter = $2",
      [orgId, counterName]
    );
    return result.rows[0] || null;
  },

  async findServingByOrgId(orgId) {
    const result = await query(
      "SELECT * FROM tokens WHERE org_id = $1 AND status = 'serving' AND counter IS NULL",
      [orgId]
    );
    return result.rows[0] || null;
  },

  async create(tokenData) {
    const {
      orgId,
      name,
      phone,
      tokenNumber,
      tokenDisplay,
      status = "waiting",
      priority = "normal",
      priorityStatus = "none",
      verificationData = {},
      counter = null,
    } = tokenData;

    const result = await query(
      `INSERT INTO tokens (org_id, name, phone, token_number, token_display, status, priority, priority_status, verification_data, counter)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        orgId,
        name.trim(),
        phone ? phone.trim() : "",
        tokenNumber,
        tokenDisplay,
        status,
        priority,
        priorityStatus,
        JSON.stringify(verificationData),
        counter,
      ]
    );
    return result.rows[0];
  },

  async updateStatus(id, status, additionalFields = {}) {
    const fields = ["status = $2"];
    const values = [id, status];
    let paramIndex = 3;

    if (additionalFields.servedAt !== undefined) {
      fields.push(`served_at = $${paramIndex++}`);
      values.push(additionalFields.servedAt);
    }
    if (additionalFields.completedAt !== undefined) {
      fields.push(`completed_at = $${paramIndex++}`);
      values.push(additionalFields.completedAt);
    }
    if (additionalFields.counter !== undefined) {
      fields.push(`counter = $${paramIndex++}`);
      values.push(additionalFields.counter);
    }

    values.push(id);
    const result = await query(
      `UPDATE tokens SET ${fields.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async updatePriorityStatus(id, priorityStatus) {
    const result = await query(
      "UPDATE tokens SET priority_status = $2 WHERE id = $1 RETURNING *",
      [id, priorityStatus]
    );
    return result.rows[0];
  },

  async updateVerificationData(id, verificationData) {
    const result = await query(
      "UPDATE tokens SET verification_data = $2 WHERE id = $1 RETURNING *",
      [id, JSON.stringify(verificationData)]
    );
    return result.rows[0];
  },

  async updateFeedback(id, feedback) {
    const result = await query(
      "UPDATE tokens SET feedback = $2 WHERE id = $1 RETURNING *",
      [id, JSON.stringify(feedback)]
    );
    return result.rows[0];
  },

  async updateManyStatuses(orgId, statuses, status, additionalFields = {}) {
    const placeholders = statuses.map((_, i) => `$${i + 2}`).join(", ");
    let sql = `UPDATE tokens SET status = $2, completed_at = CURRENT_TIMESTAMP WHERE org_id = $1 AND status IN (${placeholders})`;

    const values = [orgId, status, ...statuses];

    if (additionalFields.completedAt !== undefined) {
      sql = sql.replace("completed_at = CURRENT_TIMESTAMP", "completed_at = $3");
      values.splice(2, 0, additionalFields.completedAt);
    }

    const result = await query(sql, values);
    return result;
  },

  async getStatsByOrgId(orgId) {
    const result = await query(
      `SELECT status, COUNT(*) as count FROM tokens WHERE org_id = $1 GROUP BY status`,
      [orgId]
    );
    const stats = { total: 0, waiting: 0, serving: 0, completed: 0, skipped: 0 };
    result.rows.forEach((row) => {
      stats[row.status] = parseInt(row.count);
      stats.total += parseInt(row.count);
    });
    return stats;
  },

  async getRecentCompleted(orgId, limit = 20) {
    const result = await query(
      `SELECT * FROM tokens
       WHERE org_id = $1 AND status = 'completed' AND served_at IS NOT NULL
       ORDER BY completed_at DESC LIMIT $2`,
      [orgId, limit]
    );
    return result.rows;
  },

  async getPendingPriorityRequests(orgId) {
    const result = await query(
      `SELECT * FROM tokens
       WHERE org_id = $1 AND status = 'waiting' AND priority_status = 'pending'
       AND priority IN ('senior', 'emergency')
       ORDER BY created_at ASC`,
      [orgId]
    );
    return result.rows;
  },

  toPublic(token) {
    if (!token) return null;
    return {
      id: token.id,
      orgId: token.org_id,
      name: token.name,
      phone: token.phone,
      tokenNumber: token.token_number,
      tokenDisplay: token.token_display,
      status: token.status,
      servedAt: token.served_at,
      completedAt: token.completed_at,
      priority: token.priority,
      priorityStatus: token.priority_status,
      verificationData: typeof token.verification_data === "string"
        ? JSON.parse(token.verification_data)
        : (token.verification_data || {}),
      counter: token.counter,
      feedback: typeof token.feedback === "string"
        ? JSON.parse(token.feedback)
        : (token.feedback || {}),
      note: token.note,
      createdAt: token.created_at,
      updatedAt: token.updated_at,
    };
  },
};

module.exports = tokenQueries;