const { query } = require("../config/db");
const bcrypt = require("bcryptjs");

const organizationQueries = {
  async findByUsername(username) {
    const result = await query(
      "SELECT * FROM organizations WHERE LOWER(username) = LOWER($1)",
      [username]
    );
    return result.rows[0] || null;
  },

  async findByEmail(email) {
    const result = await query(
      "SELECT * FROM organizations WHERE LOWER(email) = LOWER($1)",
      [email]
    );
    return result.rows[0] || null;
  },

  async findById(id) {
    const result = await query(
      "SELECT * FROM organizations WHERE id = $1",
      [id]
    );
    return result.rows[0] || null;
  },

  async findByUsernameOrEmail(username, email) {
    const result = await query(
      "SELECT * FROM organizations WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2)",
      [username, email]
    );
    return result.rows[0] || null;
  },

  async create({ orgName, department, serviceCenter, orgType, officialEmailDomain, username, email, password }) {
    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO organizations (org_name, department, service_center, org_type, official_email_domain, username, email, password)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        orgName,
        department,
        serviceCenter,
        orgType,
        officialEmailDomain ? officialEmailDomain.toLowerCase().replace(/^@/, "") : "",
        username.toLowerCase(),
        email.toLowerCase(),
        hashedPassword,
      ]
    );
    return result.rows[0];
  },

  async update(id, updates) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (updates.orgName !== undefined) {
      fields.push(`org_name = $${paramIndex++}`);
      values.push(updates.orgName);
    }
    if (updates.department !== undefined) {
      fields.push(`department = $${paramIndex++}`);
      values.push(updates.department);
    }
    if (updates.serviceCenter !== undefined) {
      fields.push(`service_center = $${paramIndex++}`);
      values.push(updates.serviceCenter);
    }
    if (updates.officialEmailDomain !== undefined) {
      fields.push(`official_email_domain = $${paramIndex++}`);
      values.push(updates.officialEmailDomain.toLowerCase().replace(/^@/, ""));
    }
    if (updates.isQueueOpen !== undefined) {
      fields.push(`is_queue_open = $${paramIndex++}`);
      values.push(updates.isQueueOpen);
    }
    if (updates.logoUrl !== undefined) {
      fields.push(`logo_url = $${paramIndex++}`);
      values.push(updates.logoUrl);
    }

    if (fields.length === 0) return null;

    values.push(id);
    const result = await query(
      `UPDATE organizations SET ${fields.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async incrementTokenCounter(id) {
    const result = await query(
      `UPDATE organizations SET token_counter = token_counter + 1 WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0];
  },

  async resetTokenCounter(id) {
    const result = await query(
      `UPDATE organizations SET token_counter = 0 WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0];
  },

  async resetAllTokenCounters() {
    await query(`UPDATE organizations SET token_counter = 0`);
  },

  async findAll() {
    const result = await query("SELECT * FROM organizations ORDER BY created_at DESC");
    return result.rows;
  },

  toPublic(org) {
    if (!org) return null;
    const { password, ...publicOrg } = org;
    return {
      id: publicOrg.id,
      orgName: publicOrg.org_name,
      department: publicOrg.department,
      serviceCenter: publicOrg.service_center,
      orgType: publicOrg.org_type,
      officialEmailDomain: publicOrg.official_email_domain,
      isQueueOpen: publicOrg.is_queue_open,
      logoUrl: publicOrg.logo_url,
      username: publicOrg.username,
      email: publicOrg.email,
      tokenCounter: publicOrg.token_counter,
      isActive: publicOrg.is_active,
      createdAt: publicOrg.created_at,
      updatedAt: publicOrg.updated_at,
    };
  },
};

module.exports = organizationQueries;
