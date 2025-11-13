import fs from "fs/promises";
import path from "path";
import pool from "../components/db.js";

const MIGRATION_FILE = path.resolve(
  process.cwd(),
  "db/migrations/2026-02-15-add-firebase-uid-to-appraiser-users.sql"
);

function splitSqlStatements(sql) {
  return sql
    .split(/;\s*\n/g)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => `${s};`);
}

async function run() {
  const rawSql = await fs.readFile(MIGRATION_FILE, "utf8");
  const statements = splitSqlStatements(rawSql);

  if (statements.length === 0) {
    throw new Error("No SQL statements found in migration file.");
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const statement of statements) {
      // eslint-disable-next-line no-await-in-loop
      await connection.query(statement);
    }
    await connection.commit();
    console.log(`✅ Firebase UID migration complete. Executed ${statements.length} statements.`);
  } catch (error) {
    await connection.rollback();
    console.error("❌ Firebase UID migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    connection.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error("❌ Unexpected migration error:", error.message);
  process.exit(1);
});
