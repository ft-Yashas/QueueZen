const { query } = require("../config/db");
const bcrypt = require("bcryptjs");

const staffQueries = {
  async findByUsername(username) {
    const result = await query(
      "SELECT * FROM staff WHERE LOWER(username) = LOWER($1)",
      [username]
    );
    return result.rows[0] || null;
  },

  async findById(id) {
    const result = await query("SELECT * FROM staff WHERE id = $1", [id]);
    return result.rows[0] || null;
  },

  async findByOrgId(orgId) {
    const result = await query(
      "SELECT * FROM staff WHERE org_id = $1 AND is_active = true ORDER BY counter_name ASC",
      [orgId]
    );
    return result.rows;
  },

  async findByIdAndOrgId(staffId, orgId) {
    const result = await query(
      "SELECT * FROM staff WHERE id = $1 AND org_id = $2",
      [staffId, orgId]
    );
    return result.rows[0] || null;
  },

  async create({ orgId, counterName, username, password }) {
    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO staff (org_id, counter_name, username, password)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [orgId, counterName.trim(), username.toLowerCase().trim(), hashedPassword]
    );
    return result.rows[0];
  },

  async update(id, updates) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (updates.counterName !== undefined) {
      fields.push(`counter_name = $${paramIndex++}`);
      values.push(updates.counterName);
    }
    if (updates.username !== undefined) {
      fields.push(`username = $${paramIndex++}`);
      values.push(updates.username.toLowerCase().trim());
    }
    if (updates.password !== undefined) {
      const hashedPassword = await bcrypt.hash(updates.password, 12);
      fields.push(`password = $${paramIndex++}`);
      values.push(hashedPassword);
    }
    if (updates.isActive !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(updates.isActive);
    }

    if (fields.length === 0) return null;

    values.push(id);
    const result = await query(
      `UPDATE staff SET ${fields.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async softDelete(id) {
    const result = await query(
      "UPDATE staff SET is_active = false WHERE id = $1 RETURNING *",
      [id]
    );
    return result.rows[0];
  },

  async hardDelete(id) {
    const result = await query("DELETE FROM staff WHERE id = $1 RETURNING *", [id]);
    return result.rows[0];
  },

  toPublic(staff) {
    if (!staff) return null;
    const { password, ...publicStaff } = staff;
    return {
      id: publicStaff.id,
      orgId: publicStaff.org_id,
      counterName: publicStaff.counter_name,
      username: publicStaff.username,
      isActive: publicStaff.is_active,
      createdAt: publicStaff.created_at,
      updatedAt: publicStaff.updated_at,
    };
  },

  toJSON(staff) {
    return this.toPublic(staff);
  },
};

module.exports = staffQueries;