const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on("connect", () => {
  console.log("✅ PostgreSQL connected");
});

pool.on("error", (err) => {
  console.error("❌ PostgreSQL connection error:", err);
});

const query = (text, params) => pool.query(text, params);

const getClient = () => pool.connect();

const connectDB = async () => {
  try {
    const client = await pool.connect();
    client.release();
    console.log("✅ PostgreSQL connected successfully");
  } catch (error) {
    console.error("❌ PostgreSQL connection failed:", error.message);
    throw error;
  }
};

module.exports = { pool, query, getClient, connectDB };
