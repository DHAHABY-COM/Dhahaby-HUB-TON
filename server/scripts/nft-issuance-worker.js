import dotenv from "dotenv";
import os from "os";
import { Contract, JsonRpcProvider, Wallet, ZeroAddress, keccak256, toUtf8Bytes } from "ethers";
import pool from "../components/db.js";

dotenv.config();

const DEFAULT_RPC_URL = process.env.OPBNB_RPC_URL || "https://opbnb-testnet-rpc.bnbchain.org";
const RPC_URL = process.env.NFT_ISSUANCE_RPC_URL || DEFAULT_RPC_URL;
const PRIVATE_KEY = process.env.NFT_ISSUANCE_PRIVATE_KEY || process.env.OPBNB_PRIVATE_KEY;
const DEFAULT_CONTRACT_ADDRESS =
	process.env.NFT_ISSUANCE_CONTRACT_ADDRESS || process.env.OPBNB_NFT_CONTRACT_ADDRESS || "";
const POLL_INTERVAL_MS = Math.max(Number(process.env.NFT_ISSUANCE_POLL_MS) || 15000, 3000);
const BATCH_SIZE = Math.min(Math.max(Number(process.env.NFT_ISSUANCE_BATCH_SIZE) || 5, 1), 50);
const MAX_RETRIES = Math.max(Number(process.env.NFT_ISSUANCE_MAX_RETRIES) || 3, 1);
const CLAIM_STALE_MS = Math.max(Number(process.env.NFT_ISSUANCE_CLAIM_STALE_MS) || 3 * 60 * 1000, 10000);
const RUN_ONCE = String(process.env.NFT_ISSUANCE_RUN_ONCE || "").toLowerCase() === "true";
const MINT_METHODS = (process.env.NFT_ISSUANCE_MINT_METHODS || "safeMint,mint,mintTo,mintForAsset,mintForPrevaluation")
	.split(",")
	.map((x) => x.trim())
	.filter(Boolean);
const PROCESSOR_ID = `${os.hostname()}-${process.pid}`;

if (!PRIVATE_KEY) {
	throw new Error("Missing NFT_ISSUANCE_PRIVATE_KEY (or OPBNB_PRIVATE_KEY)");
}

const ERC721_MINT_ABI = [
	"function safeMint(address to, string tokenURI) returns (uint256)",
	"function mint(address to, string tokenURI) returns (uint256)",
	"function mintTo(address to, string tokenURI) returns (uint256)",
	"function safeMint(address to) returns (uint256)",
	"function mint(address to) returns (uint256)",
	"function mintForAsset(address to, string tokenURI, bytes32 assetKey) returns (uint256)",
	"function mintForPrevaluation(address to, string tokenURI, uint256 prevaluationId) returns (uint256)",
	"event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];

const provider = new JsonRpcProvider(RPC_URL);
const wallet = new Wallet(PRIVATE_KEY, provider);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const toAssetKey = (prevaluationId) => keccak256(toUtf8Bytes(`dhahaby-prevaluation:${prevaluationId}`));

const findTokenIdFromReceipt = (contract, receipt) => {
	for (const log of receipt?.logs || []) {
		try {
			const parsed = contract.interface.parseLog(log);
			if (!parsed || parsed.name !== "Transfer") continue;
			const from = String(parsed.args?.from || "").toLowerCase();
			const tokenId = parsed.args?.tokenId;
			if (from === ZeroAddress.toLowerCase() && tokenId !== undefined && tokenId !== null) {
				return tokenId.toString();
			}
		} catch {
			// Ignore unrelated logs.
		}
	}
	return null;
};

const tryMethodCall = async ({ contract, methodName, issuance }) => {
	if (typeof contract[methodName] !== "function") {
		throw new Error(`method_not_found:${methodName}`);
	}
	const to = issuance.owner_wallet_address;
	const uri = issuance.metadata_uri || "";
	const prevaluationId = Number(issuance.prevaluation_id);
	if (methodName === "mintForAsset") {
		const tx = await contract[methodName](to, uri, toAssetKey(prevaluationId));
		const receipt = await tx.wait();
		return { txHash: tx.hash, receipt, methodName };
	}
	if (methodName === "mintForPrevaluation") {
		const tx = await contract[methodName](to, uri, prevaluationId);
		const receipt = await tx.wait();
		return { txHash: tx.hash, receipt, methodName };
	}
	try {
		const tx = await contract[methodName](to, uri);
		const receipt = await tx.wait();
		return { txHash: tx.hash, receipt, methodName };
	} catch {
		const tx = await contract[methodName](to);
		const receipt = await tx.wait();
		return { txHash: tx.hash, receipt, methodName };
	}
};

const attemptMintTx = async ({ contract, issuance }) => {
	const errors = [];
	for (const methodName of MINT_METHODS) {
		try {
			return await tryMethodCall({ contract, methodName, issuance });
		} catch (error) {
			errors.push(`${methodName}: ${error?.shortMessage || error?.message || "unknown error"}`);
		}
	}
	throw new Error(errors.length ? errors.join(" | ") : "No compatible mint method found");
};

const recoverStaleProcessing = async () => {
	const staleSeconds = Math.floor(CLAIM_STALE_MS / 1000);
	await pool.query(
		`UPDATE nft_issuances
		 SET status = 'queued',
		     processor_id = NULL,
		     processing_started_at = NULL,
		     failure_reason = CONCAT(IFNULL(failure_reason, ''), CASE WHEN IFNULL(failure_reason, '') = '' THEN '' ELSE ' | ' END, 'stale lock recovered'),
		     updated_at = NOW()
		 WHERE status = 'processing'
		   AND processing_started_at IS NOT NULL
		   AND TIMESTAMPDIFF(SECOND, processing_started_at, NOW()) >= ?`,
		[staleSeconds]
	);
};

const claimQueuedJobs = async (limit) => {
	const connection = await pool.getConnection();
	try {
		await connection.beginTransaction();
		const [rows] = await connection.query(
			`SELECT id, prevaluation_id, organization_id, owner_wallet_address, chain_key, token_standard,
			        contract_address, metadata_uri, retry_count, max_retries
			 FROM nft_issuances
			 WHERE status = 'queued'
			 ORDER BY id ASC
			 LIMIT ?
			 FOR UPDATE`,
			[limit]
		);
		if (rows.length === 0) {
			await connection.commit();
			return [];
		}
		const ids = rows.map((row) => row.id);
		await connection.query(
			`UPDATE nft_issuances
			 SET status = 'processing',
			     processor_id = ?,
			     processing_started_at = NOW(),
			     failure_reason = NULL,
			     updated_at = NOW()
			 WHERE id IN (${ids.map(() => "?").join(",")})`,
			[PROCESSOR_ID, ...ids]
		);
		await connection.commit();
		return rows;
	} catch (error) {
		try { await connection.rollback(); } catch {}
		throw error;
	} finally {
		connection.release();
	}
};

const markMinted = async ({ issuanceId, txHash, tokenId, contractAddress }) => {
	const connection = await pool.getConnection();
	try {
		await connection.beginTransaction();
		await connection.query(
			`UPDATE nft_issuances
			 SET status = 'minted',
			     tx_hash = ?,
			     token_id = ?,
			     contract_address = ?,
			     failure_reason = NULL,
			     minted_at = NOW(),
			     processor_id = NULL,
			     processing_started_at = NULL,
			     updated_at = NOW()
			 WHERE id = ? AND status = 'processing'`,
			[txHash, tokenId, contractAddress, issuanceId]
		);
		await connection.query(
			`INSERT INTO appraiser_audit_logs (organization_id, user_id, action_type, target_type, target_id, payload_json)
			 SELECT organization_id, NULL, 'nft_issuance_minted', 'nft_issuance', CAST(id AS CHAR), CAST(? AS JSON)
			 FROM nft_issuances
			 WHERE id = ?`,
			[
				JSON.stringify({
					tx_hash: txHash,
					token_id: tokenId,
					contract_address: contractAddress,
					minted_at: new Date().toISOString(),
					processor_id: PROCESSOR_ID,
				}),
				issuanceId,
			]
		);
		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
};

const markFailedOrRequeue = async (issuance, reason) => {
	const currentRetry = Number(issuance.retry_count || 0);
	const maxRetries = Number(issuance.max_retries || MAX_RETRIES);
	const nextRetry = currentRetry + 1;
	const shouldFail = nextRetry >= maxRetries;
	await pool.query(
		`UPDATE nft_issuances
		 SET status = ?,
		     retry_count = ?,
		     max_retries = ?,
		     failure_reason = ?,
		     processor_id = NULL,
		     processing_started_at = NULL,
		     updated_at = NOW()
		 WHERE id = ? AND status = 'processing'`,
		[
			shouldFail ? "failed" : "queued",
			nextRetry,
			maxRetries,
			reason.slice(0, 2000),
			issuance.id,
		]
	);
	return { failed: shouldFail, requeued: !shouldFail, retry: nextRetry, maxRetries };
};

const processOneIssuance = async (issuance) => {
	const contractAddress = String(issuance.contract_address || DEFAULT_CONTRACT_ADDRESS || "").trim();
	if (!contractAddress) {
		return markFailedOrRequeue(issuance, "Missing contract address on issuance and NFT_ISSUANCE_CONTRACT_ADDRESS");
	}
	if (String(issuance.chain_key || "").toLowerCase() !== "bnb") {
		return markFailedOrRequeue(issuance, `Unsupported chain_key: ${issuance.chain_key || "<empty>"}`);
	}
	if (String(issuance.token_standard || "").toUpperCase() !== "ERC721") {
		return markFailedOrRequeue(issuance, `Unsupported token_standard: ${issuance.token_standard || "<empty>"}`);
	}
	if (!issuance.owner_wallet_address) {
		return markFailedOrRequeue(issuance, "Missing owner_wallet_address");
	}

	try {
		const contract = new Contract(contractAddress, ERC721_MINT_ABI, wallet);
		const { txHash, receipt, methodName } = await attemptMintTx({ contract, issuance });
		const tokenId = findTokenIdFromReceipt(contract, receipt);
		await markMinted({
			issuanceId: issuance.id,
			txHash,
			tokenId,
			contractAddress,
		});
		console.log(
			`[nft-worker] minted issuance=${issuance.id} prevaluation=${issuance.prevaluation_id} tx=${txHash} method=${methodName} tokenId=${tokenId || "n/a"}`
		);
		return { minted: true };
	} catch (error) {
		const reason = error?.shortMessage || error?.message || "Mint failed";
		const result = await markFailedOrRequeue(issuance, reason);
		console.error(
			`[nft-worker] ${result.failed ? "failed" : "requeued"} issuance=${issuance.id} retry=${result.retry}/${result.maxRetries}: ${reason}`
		);
		return result;
	}
};

const runCycle = async () => {
	await recoverStaleProcessing();
	const queued = await claimQueuedJobs(BATCH_SIZE);
	if (queued.length === 0) {
		console.log("[nft-worker] no queued issuances");
		return;
	}
	console.log(`[nft-worker] claimed ${queued.length} queued issuance(s) as processor=${PROCESSOR_ID}`);
	for (const issuance of queued) {
		await processOneIssuance(issuance);
	}
};

let stopping = false;
const stop = async (signal) => {
	if (stopping) return;
	stopping = true;
	console.log(`[nft-worker] received ${signal}, shutting down...`);
	await pool.end();
	process.exit(0);
};

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

console.log(
	`[nft-worker] started rpc=${RPC_URL} wallet=${wallet.address} runOnce=${RUN_ONCE} pollMs=${POLL_INTERVAL_MS} maxRetries=${MAX_RETRIES} processor=${PROCESSOR_ID}`
);

if (RUN_ONCE) {
	try {
		await runCycle();
	} finally {
		await pool.end();
	}
	process.exit(0);
}

while (!stopping) {
	try {
		await runCycle();
	} catch (error) {
		console.error("[nft-worker] cycle error:", error?.message || error);
	}
	await sleep(POLL_INTERVAL_MS);
}
