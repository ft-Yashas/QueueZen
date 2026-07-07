/**
 * Run once to create a default admin organization:
 *   node scripts/createAdmin.js
 */
require("dotenv").config({ path: "../.env" });
const { pool } = require("../config/db");
const organizationQueries = require("../queries/organizationQueries");

const run = async () => {
  try {
    await pool.query("SELECT 1");
    console.log("Connected to PostgreSQL");

    const existing = await organizationQueries.findByUsername("admin");
    if (existing) {
      console.log("⚠️  Admin organization already exists.");
      await pool.end();
      process.exit(0);
    }

    const org = await organizationQueries.create({
      orgName: "QueueZen Demo Office",
      department: "General Services",
      serviceCenter: "Counter 1",
      username: "admin",
      email: "admin@queuezen.com",
      password: "admin123",
    });

    console.log("✅ Admin organization created:");
    console.log(`   Username: admin`);
    console.log(`   Password: admin123`);
    console.log(`   Org: ${org.org_name}`);
    console.log("\n⚠️  Change the password after first login!");

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    await pool.end();
    process.exit(1);
  }
};

run();