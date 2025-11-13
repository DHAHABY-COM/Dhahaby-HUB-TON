import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import pool from "../components/db.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationFile = path.resolve(__dirname, "../db/migrations/2026-05-15-create-legal-policies.sql");

const run = async () => {
  const connection = await pool.getConnection();
  try {
    const sql = fs.readFileSync(migrationFile, "utf8");
    const statements = sql
      .split(/;\s*\n/g)
      .map((s) => s.trim())
      .filter(Boolean);

    for (const statement of statements) {
      // eslint-disable-next-line no-await-in-loop
      await connection.query(statement);
    }

    console.log(`✅ Legal policies migration complete. Executed ${statements.length} statements.`);
  } catch (error) {
    console.error("❌ Legal policies migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    connection.release();
    await pool.end();
  }
};

run();
