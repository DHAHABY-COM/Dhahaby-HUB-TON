import dotenv from "dotenv";
import pool from "../components/db.js";

dotenv.config();

const statements = [
	`ALTER TABLE nft_issuances ADD COLUMN retry_count INT NOT NULL DEFAULT 0 AFTER failure_reason`,
	`ALTER TABLE nft_issuances ADD COLUMN max_retries INT NOT NULL DEFAULT 3 AFTER retry_count`,
	`ALTER TABLE nft_issuances ADD COLUMN processor_id VARCHAR(128) NULL AFTER max_retries`,
	`ALTER TABLE nft_issuances ADD COLUMN processing_started_at TIMESTAMP NULL AFTER processor_id`,
	`ALTER TABLE nft_issuances ADD COLUMN cancelled_at TIMESTAMP NULL AFTER minted_at`,
	`CREATE INDEX idx_nft_issuance_status_updated ON nft_issuances (status, updated_at)`,
	`CREATE INDEX idx_nft_issuance_processor ON nft_issuances (processor_id)`,
];

const run = async () => {
	const connection = await pool.getConnection();
	try {
		for (const sql of statements) {
			console.log("[migrate:nft-worker] executing:", sql.replace(/\s+/g, " ").trim());
			try {
				await connection.query(sql);
			} catch (error) {
				const duplicateField = error?.code === "ER_DUP_FIELDNAME";
				const duplicateKey = error?.code === "ER_DUP_KEYNAME";
				if (!duplicateField && !duplicateKey) {
					throw error;
				}
				console.log("[migrate:nft-worker] already exists, skipping");
			}
		}
		console.log("[migrate:nft-worker] done");
	} finally {
		connection.release();
		await pool.end();
	}
};

run().catch((error) => {
	console.error("[migrate:nft-worker] failed:", error.message);
	process.exit(1);
});
