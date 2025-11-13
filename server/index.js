import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import OpenAI from "openai";
import multer from "multer";
import { itemCategories } from "./itemCategories.js";
import pool from "./components/db.js";
import { verifyFirebaseIdToken } from "./components/firebaseAdmin.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { sendCreateValuation } from "./components/tonClient.js";
import { recordValuationOnOpBnb } from "./components/opbnbClient.js";
import { recordValuationOnAvax } from "./components/avaxClient.js";
import sha256 from "sha256";
import nodemailer from "nodemailer";
import {
	Connection,
	Keypair,
	PublicKey
} from "@solana/web3.js";

import {
	createMint,
	getOrCreateAssociatedTokenAccount,
		mintTo
} from "@solana/spl-token";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

console.log("[startup] FIREBASE_PROJECT_ID:", process.env.FIREBASE_PROJECT_ID || "<missing>");

const app = express();
const port = process.env.PORT || 3002;
app.use(cors({ origin: "*" }));
app.use(bodyParser.json({ limit: "10mb" }));
app.use("/items", express.static("items"));
app.use("/metadata", express.static("metadata"));

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------- FILE UPLOAD CONFIG ----------
const uploadDir = "./items";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
	destination: (req, file, cb) => cb(null, uploadDir),
	filename: (req, file, cb) => {
		const ext = path.extname(file.originalname);
		cb(null, `${Date.now()}${ext}`);
	},
});

const upload = multer({ storage });

// ---------- IG CONFIG ----------
const IG_BASE_URL = process.env.IG_BASE_URL || "https://demo-api.ig.com/gateway/deal";
const IG_FALLBACK_BASE_URL = process.env.IG_FALLBACK_BASE_URL || "https://api.ig.com/gateway/deal";
const IG_API_KEY = process.env.IG_API_KEY;
const IG_USERNAME = process.env.IG_USERNAME;
const IG_PASSWORD = process.env.IG_PASSWORD;
const IG_GOLD_EPIC = process.env.IG_GOLD_EPIC;
const IG_USDINR_EPIC = process.env.IG_USDINR_EPIC || "CS.D.USDINR.TODAY.IP";
const IG_SESSION_TTL_MS = 5 * 60 * 60 * 1000;
const IG_CACHE_TTL_MS = 60 * 1000;
const IG_STALE_CACHE_MAX_AGE_MS =
	Math.max(Number(process.env.IG_STALE_CACHE_MAX_AGE_HOURS) || 120, 1) * 60 * 60 * 1000;
const IG_STALE_CACHE_FILE =
	process.env.IG_STALE_CACHE_FILE || path.resolve(__dirname, "cache", "ig-xau-cache.json");
const GOLDAPI_BASE_URL = process.env.GOLDAPI_BASE_URL || "https://www.goldapi.io/api";
const GOLDAPI_ACCESS_TOKEN = process.env.GOLDAPI_ACCESS_TOKEN;
const igGoldCache = new Map();
const igSessionByBaseUrl = new Map();

const loadIgGoldCacheFromDisk = () => {
	try {
		if (!fs.existsSync(IG_STALE_CACHE_FILE)) return;
		const raw = fs.readFileSync(IG_STALE_CACHE_FILE, "utf8");
		if (!raw) return;
		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object") return;
		for (const [currency, entry] of Object.entries(parsed)) {
			if (!entry || typeof entry !== "object") continue;
			const fetchedAt = Number(entry.fetchedAt || 0);
			if (!fetchedAt || !entry.payload) continue;
			igGoldCache.set(String(currency).toUpperCase(), {
				fetchedAt,
				payload: entry.payload,
				source: String(entry.source || entry.payload?.quote_source || "ig").toLowerCase(),
			});
		}
	} catch (error) {
		console.warn("⚠️ Failed to load IG stale cache:", error.message);
	}
};

const persistIgGoldCacheToDisk = () => {
	try {
		const parentDir = path.dirname(IG_STALE_CACHE_FILE);
		if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
		const serialized = {};
		for (const [currency, entry] of igGoldCache.entries()) {
			serialized[currency] = {
				fetchedAt: entry.fetchedAt,
				payload: entry.payload,
				source: entry.source || "ig",
			};
		}
		fs.writeFileSync(IG_STALE_CACHE_FILE, JSON.stringify(serialized, null, 2));
	} catch (error) {
		console.warn("⚠️ Failed to persist IG stale cache:", error.message);
	}
};

loadIgGoldCacheFromDisk();

const getIgBaseCandidates = () => {
	const candidates = [];
	const pushUnique = (value) => {
		const normalized = String(value || "").trim().replace(/\/+$/, "");
		if (!normalized) return;
		if (!candidates.includes(normalized)) candidates.push(normalized);
	};
	pushUnique(IG_BASE_URL);
	pushUnique(IG_FALLBACK_BASE_URL);
	return candidates;
};

const ensureIgSession = async (baseUrl) => {
	if (!IG_API_KEY || !IG_USERNAME || !IG_PASSWORD) {
		throw new Error("Missing IG credentials: IG_API_KEY, IG_USERNAME, IG_PASSWORD");
	}

	const now = Date.now();
	const current = igSessionByBaseUrl.get(baseUrl);
	if (current?.cst && current?.securityToken && now - current.fetchedAt < IG_SESSION_TTL_MS) {
		return current;
	}

	const response = await fetch(`${baseUrl}/session`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json; charset=UTF-8",
			Accept: "application/json; charset=UTF-8",
			"X-IG-API-KEY": IG_API_KEY,
			Version: "2",
		},
		body: JSON.stringify({
			identifier: IG_USERNAME,
			password: IG_PASSWORD,
			encryptedPassword: false,
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`IG session failed (${response.status}): ${errorText}`);
	}

	const cst = response.headers.get("cst");
	const securityToken = response.headers.get("x-security-token");
	if (!cst || !securityToken) {
		throw new Error("IG session did not return CST or X-SECURITY-TOKEN headers");
	}

	const nextSession = {
		cst,
		securityToken,
		fetchedAt: Date.now(),
	};
	igSessionByBaseUrl.set(baseUrl, nextSession);
	return nextSession;
};

const fetchIgMarket = async (epic) => {
	const baseCandidates = getIgBaseCandidates();
	if (baseCandidates.length === 0) {
		throw new Error("IG_BASE_URL is not configured");
	}
	const errors = [];
	for (const baseUrl of baseCandidates) {
		try {
			const session = await ensureIgSession(baseUrl);
			const response = await fetch(`${baseUrl}/markets/${encodeURIComponent(epic)}`, {
				headers: {
					Accept: "application/json; charset=UTF-8",
					"X-IG-API-KEY": IG_API_KEY,
					CST: session.cst,
					"X-SECURITY-TOKEN": session.securityToken,
					Version: "4",
				},
			});

			if (response.status === 401 || response.status === 403) {
				igSessionByBaseUrl.delete(baseUrl);
				const refreshedSession = await ensureIgSession(baseUrl);
				const retryResponse = await fetch(`${baseUrl}/markets/${encodeURIComponent(epic)}`, {
					headers: {
						Accept: "application/json; charset=UTF-8",
						"X-IG-API-KEY": IG_API_KEY,
						CST: refreshedSession.cst,
						"X-SECURITY-TOKEN": refreshedSession.securityToken,
						Version: "4",
					},
				});

				if (!retryResponse.ok) {
					const errorText = await retryResponse.text();
					throw new Error(`IG market fetch failed (${retryResponse.status}) via ${baseUrl}: ${errorText}`);
				}

				return retryResponse.json();
			}

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`IG market fetch failed (${response.status}) via ${baseUrl}: ${errorText}`);
			}

			return response.json();
		} catch (error) {
			errors.push(error?.message || String(error));
		}
	}

	throw new Error(errors.join(" | "));
};

const toNumberOrNull = (value) => {
	if (value === null || value === undefined) return null;
	const normalized =
		typeof value === "string"
			? value.trim().replace(/,/g, "")
			: value;
	const parsed = Number(normalized);
	return Number.isFinite(parsed) ? parsed : null;
};

const isValidGoldPayload = (payload) => {
	if (!payload || typeof payload !== "object") return false;
	return toNumberOrNull(payload.price) !== null;
};

const upsertGoldCacheEntry = (currency, payload, source = "ig") => {
	igGoldCache.set(String(currency || "").toUpperCase(), {
		fetchedAt: Date.now(),
		payload,
		source: String(source || "ig").toLowerCase(),
	});
};

const mapGoldApiPayload = (raw, currency) => {
	const normalizedCurrency = String(currency || "").toUpperCase();
	const price = toNumberOrNull(raw?.price);
	if (price === null) {
		throw new Error(`goldapi missing price for XAU/${normalizedCurrency}`);
	}
	const ask = toNumberOrNull(raw?.ask);
	const bid = toNumberOrNull(raw?.bid);
	const high = toNumberOrNull(raw?.high_price ?? raw?.high);
	const low = toNumberOrNull(raw?.low_price ?? raw?.low);
	const ch = toNumberOrNull(raw?.ch ?? raw?.change);
	const chp = toNumberOrNull(raw?.chp ?? raw?.change_percent);
	const gramsPerOunce = 31.1034768;
	const pricePerGram24k = price / gramsPerOunce;
	const pricePerGram = (karat) => pricePerGram24k * (karat / 24);
	const timestamp = toNumberOrNull(raw?.timestamp) || Math.floor(Date.now() / 1000);

	return {
		timestamp,
		metal: "XAU",
		currency: normalizedCurrency,
		exchange: "goldapi.io",
		symbol: `XAU/${normalizedCurrency}`,
		prev_close_price: toNumberOrNull(raw?.prev_close_price ?? raw?.prev_close ?? null),
		open_price: toNumberOrNull(raw?.open_price ?? raw?.open ?? null),
		low_price: low,
		high_price: high,
		open_time: raw?.open_time || null,
		price,
		ch,
		chp,
		ask,
		bid,
		has_live_bid_offer: ask !== null && bid !== null,
		price_gram_24k: pricePerGram24k,
		price_gram_22k: pricePerGram(22),
		price_gram_21k: pricePerGram(21),
		price_gram_20k: pricePerGram(20),
		price_gram_18k: pricePerGram(18),
		price_gram_16k: pricePerGram(16),
		price_gram_14k: pricePerGram(14),
		price_gram_10k: pricePerGram(10),
		quote_source: "goldapi",
	};
};

const fetchGoldApiCurrency = async (currency) => {
	if (!GOLDAPI_ACCESS_TOKEN) {
		throw new Error("GOLDAPI_ACCESS_TOKEN is not configured");
	}
	const normalizedCurrency = String(currency || "").toUpperCase();
	const response = await fetch(`${GOLDAPI_BASE_URL}/XAU/${normalizedCurrency}`, {
		headers: {
			"x-access-token": GOLDAPI_ACCESS_TOKEN,
			Accept: "application/json",
		},
	});
	const data = await response.json().catch(() => null);
	if (!response.ok) {
		throw new Error(data?.error || data?.message || `goldapi request failed (${response.status})`);
	}
	return mapGoldApiPayload(data || {}, normalizedCurrency);
};

const getUsdInrRate = async () => {
	const fxData = await fetchIgMarket(IG_USDINR_EPIC);
	const snapshot = fxData.snapshot || {};
	const priceLadder = Array.isArray(snapshot.priceLadder) ? snapshot.priceLadder : [];
	let fxBid = toNumberOrNull(snapshot.bid ?? priceLadder[0]?.bid ?? null);
	let fxOffer = toNumberOrNull(snapshot.offer ?? priceLadder[0]?.ask ?? priceLadder[0]?.offer ?? null);

	if (fxBid === null && fxOffer !== null) fxBid = fxOffer;
	if (fxOffer === null && fxBid !== null) fxOffer = fxBid;

	if (fxBid === null || fxOffer === null) {
		throw new Error(`USD/INR market snapshot missing bid/offer for epic ${IG_USDINR_EPIC}`);
	}

	return { bid: fxBid, offer: fxOffer, epic: IG_USDINR_EPIC };
};

// ---------- ROUTE: Create user by given telegramId ----------
app.post("/api/user/create", async (req, res) => {
	try {
		const { telegramId, fullName } = req.body;

		const [existingUser] = await pool.query(
			"SELECT id FROM users WHERE telegram_id = ?",
			[telegramId]
		);

		if (existingUser.length > 0) {
			return res.status(400).json({ error: "User already exists" });
		}

		const [insertUser] = await pool.query(
			"INSERT INTO users (telegram_id, full_name, role) VALUES (?, ?, 'customer')",
			[telegramId || null, fullName || null]
		);

		res.json({
			success: true,
			message: "User created",
			user_id: insertUser.insertId,
		});
	} catch (error) {
		console.error("❌ Create User Error:", error);
		res.status(500).json({ error: "Failed to create user", details: error.message });
	}
}
);

// ---------- ROUTE: GET user by telegramId ----------
app.get("/api/user/:telegramId", async (req, res) => {
	const connection = await pool.getConnection();
	try {

		const { telegramId } = req.params;

		const [rows] = await connection.query(
			"SELECT id, wallet_address, telegram_id, full_name, role, created_at, intro FROM users WHERE telegram_id = ?",
			[telegramId]
		);

		if (rows.length === 0) {
			return res.status(404).json({ error: "User not found" });
		}

		res.json({ user: rows[0] });
	} catch (error) {
		console.error("❌ Get User Error:", error);
		res.status(500).json({ error: "Failed to fetch user", details: error.message });
	} finally {
		connection.release();
	}
});

// ---------- ROUTE: UPDATE user intro by telegramId ----------
app.put("/api/user/:telegramId/intro", async (req, res) => {
		const connection = await pool.getConnection();
	try {

		const { telegramId } = req.params;
		const { intro } = req.body;

		const [result] = await connection.query(
			"UPDATE users SET intro = ? WHERE telegram_id = ?",
			[intro, telegramId]
		);

		if (result.affectedRows === 0) {
			return res.status(404).json({ error: "User not found" });
		}

		res.json({ success: true, message: "Intro updated" });
	} catch (error) {
		console.error("❌ Update Intro Error:", error);
		res.status(500).json({ error: "Failed to update intro", details: error.message });
	} finally {
		connection.release();
	}
}
);

// ---------- Appraiser auth helpers ----------
const getBearerToken = (req) => {
	const authHeader = req.headers.authorization || "";
	if (!authHeader.startsWith("Bearer ")) return null;
	return authHeader.slice(7);
};

const getDhahabyAdminEmails = () =>
	(process.env.APPRAISER_ADMIN_EMAILS || "")
		.split(",")
		.map((x) => x.trim().toLowerCase())
		.filter(Boolean);

const isDhahabyAdminEmail = (email) => getDhahabyAdminEmails().includes((email || "").toLowerCase());

const parsePagingParams = (req, { defaultLimit = 20, maxLimit = 100 } = {}) => {
	const page = Math.max(Number(req.query.page) || 1, 1);
	const limit = Math.min(Math.max(Number(req.query.page_size || req.query.limit) || defaultLimit, 1), maxLimit);
	return {
		page,
		limit,
		offset: (page - 1) * limit,
	};
};

const toLikePattern = (raw) => {
	const value = String(raw || "").trim();
	if (!value) return "";
	return `%${value.replace(/[%_]/g, "\\$&")}%`;
};

const parseJsonObjectLoose = (value) => {
	if (!value) return {};
	if (typeof value === "object" && !Buffer.isBuffer(value)) return value;
	const text = Buffer.isBuffer(value) ? value.toString("utf8") : String(value);
	try {
		const parsed = JSON.parse(text);
		if (typeof parsed === "string") {
			try {
				const nested = JSON.parse(parsed);
				return typeof nested === "object" && nested ? nested : {};
			} catch {
				return {};
			}
		}
		return typeof parsed === "object" && parsed ? parsed : {};
	} catch {
		return {};
	}
};

const requireDhahabyAdmin = async (req) => {
	const idToken = getBearerToken(req);
	if (!idToken) {
		const error = new Error("Missing bearer token");
		error.status = 401;
		throw error;
	}
	const decodedToken = await verifyFirebaseIdToken(idToken);
	const adminEmail = (decodedToken.email || "").toLowerCase();
	if (!isDhahabyAdminEmail(adminEmail)) {
		const error = new Error("Admin access required");
		error.status = 403;
		throw error;
	}
	return { adminEmail, decodedToken };
};

const resolveAppraiserContext = async (connection, decodedToken) => {
	const firebaseUid = decodedToken.uid;
	const email = (decodedToken.email || "").toLowerCase().trim();

	if (!firebaseUid || !email) {
		throw new Error("Token missing uid/email");
	}

	let user = null;

	const [usersByFirebaseUid] = await connection.query(
		`SELECT au.*, ao.legal_name, ao.display_name, ao.verification_status, ao.status AS organization_status
		 FROM appraiser_users au
		 JOIN appraiser_organizations ao ON ao.id = au.organization_id
		 WHERE au.firebase_uid = ?
		 LIMIT 1`,
		[firebaseUid]
	);

	if (usersByFirebaseUid.length > 0) {
		user = usersByFirebaseUid[0];
	}

	if (!user) {
		const [usersByEmail] = await connection.query(
			`SELECT au.*, ao.legal_name, ao.display_name, ao.verification_status, ao.status AS organization_status
			 FROM appraiser_users au
			 JOIN appraiser_organizations ao ON ao.id = au.organization_id
			 WHERE au.email = ?
			 LIMIT 1`,
			[email]
		);

		if (usersByEmail.length > 0) {
			user = usersByEmail[0];
			if (!user.firebase_uid) {
				await connection.query(
					"UPDATE appraiser_users SET firebase_uid = ?, last_login_at = NOW() WHERE id = ?",
					[firebaseUid, user.id]
				);
				user.firebase_uid = firebaseUid;
			}
		}
	}

	if (!user) {
		return null;
	}

	const [orgRows] = await connection.query(
		"SELECT * FROM appraiser_organizations WHERE id = ? LIMIT 1",
		[user.organization_id]
	);

	if (orgRows.length === 0) return null;

	const [latestSubmissionRows] = await connection.query(
		`SELECT id, submission_type, document_url, review_status, reviewer_notes, reviewed_at, created_at
		 FROM appraiser_verification_submissions
		 WHERE organization_id = ?
		 ORDER BY id DESC
		 LIMIT 1`,
		[user.organization_id]
	);

	return {
		user,
		organization: orgRows[0],
		latestSubmission: latestSubmissionRows[0] || null,
	};
};

const buildAppraiserProfile = (context) => {
	const { user, organization, latestSubmission } = context;
	return {
		id: user.id,
		organization_id: user.organization_id,
		organization_name: organization.display_name || organization.legal_name,
		full_name: user.full_name,
		email: user.email,
		role: user.role,
		status: user.status,
		firebase_uid: user.firebase_uid || null,
		verification_status: organization.verification_status,
		organization_status: organization.status,
		organization: {
			id: organization.id,
			legal_name: organization.legal_name,
			display_name: organization.display_name,
			email: organization.email,
			phone: organization.phone,
			country_code: organization.country_code,
			website_url: organization.website_url,
			registered_license_no: organization.registered_license_no,
			license_authority: organization.license_authority,
			metadata_json: organization.metadata_json,
		},
		latest_verification_submission: latestSubmission,
		is_dhahaby_admin: isDhahabyAdminEmail(user.email),
	};
};

const resolveCustomerUserFromToken = async (connection, decodedToken) => {
	const firebaseUid = String(decodedToken?.uid || "").trim();
	const email = String(decodedToken?.email || "").toLowerCase().trim();

	if (!firebaseUid && !email) return null;

	if (email) {
		const [byEmail] = await connection.query(
			`SELECT id, wallet_address, full_name, email, phone, created_at
			 FROM users
			 WHERE email = ?
			 ORDER BY id DESC
			 LIMIT 1`,
			[email]
		);
		if (byEmail.length > 0) return byEmail[0];
	}

	const walletCandidates = [
		decodedToken?.wallet_address,
		decodedToken?.walletAddress,
		decodedToken?.address,
	];
	const walletAddress = walletCandidates
		.map((x) => String(x || "").trim().toLowerCase())
		.find(Boolean);

	if (walletAddress) {
		const [byWallet] = await connection.query(
			`SELECT id, wallet_address, full_name, email, phone, created_at
			 FROM users
			 WHERE LOWER(wallet_address) = ?
			 LIMIT 1`,
			[walletAddress]
		);
		if (byWallet.length > 0) return byWallet[0];
	}

	return null;
};

const normalizeTransactionStatus = (rawStatus) => {
	const status = String(rawStatus || "").toLowerCase().trim();
	if (["paid", "success", "succeeded", "completed"].includes(status)) return "paid";
	if (["processing", "in_progress", "authorized"].includes(status)) return "processing";
	if (["pending", "created", "requires_payment_method", "requires_action"].includes(status)) return "pending";
	if (["failed", "error", "declined"].includes(status)) return "failed";
	if (["cancelled", "canceled"].includes(status)) return "cancelled";
	if (["refunded", "partial_refund", "partially_refunded"].includes(status)) return "refunded";
	return "pending";
};

const normalizeEmail = (raw) => String(raw || "").trim().toLowerCase();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const OTP_TTL_MINUTES = Math.max(Number(process.env.TRANSACTION_EMAIL_OTP_TTL_MINUTES) || 10, 1);
const OTP_MIN_RESEND_SECONDS = Math.max(Number(process.env.TRANSACTION_EMAIL_OTP_MIN_RESEND_SECONDS) || 60, 15);
const OTP_DAILY_LIMIT = Math.max(Number(process.env.TRANSACTION_EMAIL_OTP_DAILY_LIMIT) || 10, 1);
const OTP_SECRET = process.env.TRANSACTION_EMAIL_OTP_SECRET || process.env.OPENAI_API_KEY || "dhahaby-otp-secret";
const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = String(process.env.SMTP_SECURE || "").toLowerCase() === "true";
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || "no-reply@dhahaby.com";

const createOtpCode = () => String(Math.floor(100000 + Math.random() * 900000));
const hashOtp = (email, code) => sha256(`${normalizeEmail(email)}:${String(code)}:${OTP_SECRET}`);

let otpTransporter = null;
const getOtpTransporter = () => {
	if (otpTransporter) return otpTransporter;
	if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
	otpTransporter = nodemailer.createTransport({
		host: SMTP_HOST,
		port: SMTP_PORT,
		secure: SMTP_SECURE,
		auth: { user: SMTP_USER, pass: SMTP_PASS },
	});
	return otpTransporter;
};

const sendTransactionOtpEmail = async ({ toEmail, otpCode }) => {
	const transporter = getOtpTransporter();
	if (!transporter) {
		const preview = process.env.NODE_ENV !== "production";
		if (preview) {
			console.warn(`[tx-otp] SMTP not configured. OTP for ${toEmail}: ${otpCode}`);
			return { delivered: false, previewOtp: otpCode };
		}
		throw new Error("SMTP is not configured for OTP email delivery.");
	}

	const expiresText = `${OTP_TTL_MINUTES} minute${OTP_TTL_MINUTES > 1 ? "s" : ""}`;
	await transporter.sendMail({
		from: SMTP_FROM,
		to: toEmail,
		subject: "Dhahaby Transactions - Verification Code",
		text: `Your Dhahaby verification code is ${otpCode}. It expires in ${expiresText}. If you did not request this code, ignore this email.`,
		html: `
      <div style="font-family:Arial,sans-serif;color:#191E24;line-height:1.5">
        <h2 style="margin:0 0 12px 0;">Dhahaby Transactions Verification</h2>
        <p style="margin:0 0 10px 0;">Use the code below to view your transactions:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:8px 0 14px 0;">${otpCode}</p>
        <p style="margin:0;color:#5E6A7D;">This code expires in ${expiresText}.</p>
      </div>
    `,
	});
	return { delivered: true, previewOtp: null };
};

const fetchTransactionsByUserId = async (connection, userId, { typeFilter = "", statusFilter = "", limit = 20, offset = 0 } = {}) => {
	const where = ["ct.user_id = ?"];
	const params = [userId];
	if (typeFilter) {
		where.push("ct.transaction_type = ?");
		params.push(typeFilter);
	}
	if (statusFilter) {
		where.push("ct.status = ?");
		params.push(statusFilter);
	}
	const whereClause = `WHERE ${where.join(" AND ")}`;

	const [countRows] = await connection.query(
		`SELECT COUNT(*) AS total FROM customer_transactions ct ${whereClause}`,
		params
	);
	const [rows] = await connection.query(
		`SELECT ct.*,
		        apv.image_url,
		        ab.booking_date,
		        ab.booking_slot
		 FROM customer_transactions ct
		 LEFT JOIN ai_prevaluations apv ON apv.id = ct.prevaluation_id
		 LEFT JOIN appraiser_bookings ab ON ab.id = ct.booking_id
		 ${whereClause}
		 ORDER BY ct.created_at DESC, ct.id DESC
		 LIMIT ? OFFSET ?`,
		[...params, limit, offset]
	);

	return {
		total: Number(countRows[0]?.total || 0),
		rows,
	};
};

const parseJsonObject = (value) => {
	if (!value) return {};
	if (typeof value === "object") return value;
	try {
		return JSON.parse(value);
	} catch {
		return {};
	}
};

const resolveJewellerFromPayload = (appraiserPayload) => {
	const payload = parseJsonObject(appraiserPayload);
	const jeweller = payload?.jeweller || {};
	return {
		jewellerName: jeweller?.name || jeweller?.display_name || payload?.jewellerName || "",
		jewellerAddress: jeweller?.address || "",
		jewellerContact: jeweller?.contact || "",
	};
};

const parseReviewNotesAndDocRef = (internalNotes) => {
	const value = String(internalNotes || "").trim();
	if (!value) {
		return {
			reviewNotes: "",
			reviewDocReference: "",
		};
	}

	const lines = value.split("\n");
	let docRef = "";
	const noteLines = [];

	lines.forEach((line) => {
		const trimmed = line.trim();
		if (/^Doc Ref:/i.test(trimmed)) {
			docRef = trimmed.replace(/^Doc Ref:/i, "").trim();
			return;
		}
		noteLines.push(line);
	});

	return {
		reviewNotes: noteLines.join("\n").trim(),
		reviewDocReference: docRef,
	};
};

const normalizeNftIssuance = (row) => {
	if (!row || !row.nft_issuance_id) return null;
	return {
		id: row.nft_issuance_id,
		status: row.nft_issuance_status,
		chain_key: row.nft_chain_key,
		token_standard: row.nft_token_standard,
		contract_address: row.nft_contract_address,
		token_id: row.nft_token_id,
		tx_hash: row.nft_tx_hash,
		metadata_uri: row.nft_metadata_uri,
		owner_wallet_address: row.nft_owner_wallet_address,
		failure_reason: row.nft_failure_reason,
		minted_at: row.nft_minted_at,
		updated_at: row.nft_updated_at,
		retry_count: row.nft_retry_count ?? 0,
		max_retries: row.nft_max_retries ?? null,
	};
};

// ---------- ROUTE: Appraiser auth sync (Firebase -> MySQL) ----------
app.post("/api/appraiser/auth/sync", async (req, res) => {
	const connection = await pool.getConnection();
	try {
		const idToken = req.body.idToken || getBearerToken(req);

		if (!idToken) {
			return res.status(400).json({ error: "Missing Firebase ID token" });
		}

		let decodedToken;
		try {
			decodedToken = await verifyFirebaseIdToken(idToken);
		} catch (verifyError) {
			return res.status(401).json({ error: "Invalid Firebase token", details: verifyError.message });
		}

		const firebaseUid = decodedToken.uid;
		const email = (decodedToken.email || req.body.email || "").toLowerCase().trim();
		const displayName = (decodedToken.name || req.body.displayName || "").trim();
		const organizationName = (req.body.organizationName || "").trim();

		if (!firebaseUid || !email) {
			return res.status(400).json({ error: "Token missing uid/email" });
		}

		await connection.beginTransaction();

		let context = await resolveAppraiserContext(connection, decodedToken);

		if (!context) {
			let organization = null;
			const [existingOrgs] = await connection.query(
				"SELECT * FROM appraiser_organizations WHERE email = ? LIMIT 1",
				[email]
			);

			if (existingOrgs.length > 0) {
				organization = existingOrgs[0];
			} else {
				const legalName = organizationName || `${displayName || email} Appraisal`;
				const [orgInsert] = await connection.query(
					`INSERT INTO appraiser_organizations
					 (legal_name, display_name, email, status, verification_status)
					 VALUES (?, ?, ?, 'pending', 'not_started')`,
					[legalName, displayName || legalName, email]
				);

				const [orgRows] = await connection.query(
					"SELECT * FROM appraiser_organizations WHERE id = ? LIMIT 1",
					[orgInsert.insertId]
				);
				organization = orgRows[0];
			}

			await connection.query(
				`INSERT INTO appraiser_users
				 (organization_id, full_name, email, role, status, firebase_uid, last_login_at)
				 VALUES (?, ?, ?, 'owner', 'active', ?, NOW())`,
				[organization.id, displayName || email, email, firebaseUid]
			);

			context = await resolveAppraiserContext(connection, decodedToken);
		}

		await connection.query(
			"UPDATE appraiser_users SET last_login_at = NOW() WHERE id = ?",
			[context.user.id]
		);

		await connection.query(
			`INSERT INTO appraiser_audit_logs (organization_id, user_id, action_type, target_type, target_id, payload_json)
			 VALUES (?, ?, 'auth_sync', 'appraiser_user', ?, CAST(? AS JSON))`,
			[
				context.user.organization_id,
				context.user.id,
				String(context.user.id),
				JSON.stringify({ provider: decodedToken.firebase?.sign_in_provider || "password" }),
			]
		);

		await connection.commit();

		return res.json({
			success: true,
			profile: buildAppraiserProfile(context),
		});
	} catch (error) {
		await connection.rollback();
		console.error("❌ Appraiser Auth Sync Error:", error);
		return res.status(500).json({ error: "Failed to sync appraiser auth", details: error.message });
	} finally {
		connection.release();
	}
});

// ---------- ROUTE: Get appraiser profile ----------
app.get("/api/appraiser/profile", async (req, res) => {
	const connection = await pool.getConnection();
	try {
		const idToken = getBearerToken(req);
		if (!idToken) {
			return res.status(401).json({ error: "Missing bearer token" });
		}
		const decodedToken = await verifyFirebaseIdToken(idToken);
		const context = await resolveAppraiserContext(connection, decodedToken);
		if (!context) {
			return res.status(404).json({ error: "Appraiser profile not found. Please sync first." });
		}
		return res.json({ success: true, profile: buildAppraiserProfile(context) });
	} catch (error) {
		console.error("❌ Appraiser Profile Error:", error);
		return res.status(401).json({ error: "Failed to fetch appraiser profile", details: error.message });
	} finally {
		connection.release();
	}
});

// ---------- ROUTE: Update appraiser organization (onboarding form) ----------
app.put("/api/appraiser/organization", async (req, res) => {
	const connection = await pool.getConnection();
	try {
		const idToken = getBearerToken(req);
		if (!idToken) {
			return res.status(401).json({ error: "Missing bearer token" });
		}

		const decodedToken = await verifyFirebaseIdToken(idToken);
		const context = await resolveAppraiserContext(connection, decodedToken);
		if (!context) {
			return res.status(404).json({ error: "Appraiser profile not found. Please sync first." });
		}

		const {
			legal_name,
			display_name,
			phone,
			country_code,
			website_url,
			registered_license_no,
			license_authority,
			metadata_json,
		} = req.body || {};

		if (!legal_name || !registered_license_no || !license_authority) {
			return res.status(400).json({ error: "Missing required fields: legal_name, registered_license_no, license_authority" });
		}

		await connection.query(
			`UPDATE appraiser_organizations
			 SET legal_name = ?, display_name = ?, phone = ?, country_code = ?, website_url = ?, registered_license_no = ?, license_authority = ?, metadata_json = CAST(? AS JSON), updated_at = NOW()
			 WHERE id = ?`,
			[
				legal_name,
				display_name || legal_name,
				phone || null,
				country_code || null,
				website_url || null,
				registered_license_no,
				license_authority,
				JSON.stringify(metadata_json || {}),
				context.organization.id,
			]
		);

		await connection.query(
			`INSERT INTO appraiser_audit_logs (organization_id, user_id, action_type, target_type, target_id, payload_json)
			 VALUES (?, ?, 'organization_update', 'appraiser_organization', ?, CAST(? AS JSON))`,
			[
				context.user.organization_id,
				context.user.id,
				String(context.organization.id),
				JSON.stringify({ legal_name, registered_license_no, license_authority }),
			]
		);

		const refreshed = await resolveAppraiserContext(connection, decodedToken);
		return res.json({ success: true, profile: buildAppraiserProfile(refreshed) });
	} catch (error) {
		console.error("❌ Appraiser Organization Update Error:", error);
		return res.status(500).json({ error: "Failed to update appraiser organization", details: error.message });
	} finally {
		connection.release();
	}
});

// ---------- ROUTE: Submit verification request ----------
app.post("/api/appraiser/verification/submit", async (req, res) => {
	const connection = await pool.getConnection();
	try {
		const idToken = getBearerToken(req);
		if (!idToken) {
			return res.status(401).json({ error: "Missing bearer token" });
		}

		const decodedToken = await verifyFirebaseIdToken(idToken);
		const context = await resolveAppraiserContext(connection, decodedToken);
		if (!context) {
			return res.status(404).json({ error: "Appraiser profile not found. Please sync first." });
		}

		const { submission_type, document_url, metadata_json } = req.body || {};
		if (!document_url) {
			return res.status(400).json({ error: "Missing document_url" });
		}

		await connection.beginTransaction();

		await connection.query(
			`INSERT INTO appraiser_verification_submissions
			 (organization_id, submitted_by_user_id, submission_type, document_url, metadata_json, review_status)
			 VALUES (?, ?, ?, ?, CAST(? AS JSON), 'pending')`,
			[
				context.organization.id,
				context.user.id,
				submission_type || "kyb",
				document_url,
				JSON.stringify(metadata_json || {}),
			]
		);

		await connection.query(
			"UPDATE appraiser_organizations SET verification_status = 'submitted', status = 'pending', updated_at = NOW() WHERE id = ?",
			[context.organization.id]
		);

		await connection.query(
			`INSERT INTO appraiser_audit_logs (organization_id, user_id, action_type, target_type, target_id, payload_json)
			 VALUES (?, ?, 'verification_submit', 'appraiser_organization', ?, CAST(? AS JSON))`,
			[
				context.user.organization_id,
				context.user.id,
				String(context.organization.id),
				JSON.stringify({ submission_type: submission_type || "kyb", document_url }),
			]
		);

		await connection.commit();

		const refreshed = await resolveAppraiserContext(connection, decodedToken);
		return res.json({ success: true, profile: buildAppraiserProfile(refreshed) });
	} catch (error) {
		await connection.rollback();
		console.error("❌ Appraiser Verification Submit Error:", error);
		return res.status(500).json({ error: "Failed to submit verification", details: error.message });
	} finally {
		connection.release();
	}
});

// ---------- ROUTE: Get verification status ----------
app.get("/api/appraiser/verification/status", async (req, res) => {
	const connection = await pool.getConnection();
	try {
		const idToken = getBearerToken(req);
		if (!idToken) {
			return res.status(401).json({ error: "Missing bearer token" });
		}
		const decodedToken = await verifyFirebaseIdToken(idToken);
		const context = await resolveAppraiserContext(connection, decodedToken);
		if (!context) {
			return res.status(404).json({ error: "Appraiser profile not found. Please sync first." });
		}

		return res.json({
			success: true,
			verification_status: context.organization.verification_status,
			organization_status: context.organization.status,
			latest_submission: context.latestSubmission,
		});
	} catch (error) {
		console.error("❌ Appraiser Verification Status Error:", error);
		return res.status(500).json({ error: "Failed to fetch verification status", details: error.message });
	} finally {
		connection.release();
	}
});

// ---------- ROUTE: Admin list verification submissions ----------
app.get("/api/appraiser/admin/verification/submissions", async (req, res) => {
	const connection = await pool.getConnection();
	try {
		const idToken = getBearerToken(req);
		if (!idToken) return res.status(401).json({ error: "Missing bearer token" });
		const decodedToken = await verifyFirebaseIdToken(idToken);
		const adminEmail = (decodedToken.email || "").toLowerCase();
		if (!isDhahabyAdminEmail(adminEmail)) {
			return res.status(403).json({ error: "Admin access required" });
		}

		const status = (req.query.status || "pending").toString().toLowerCase();
		const allowed = new Set(["pending", "approved", "rejected"]);
		const filterStatus = allowed.has(status) ? status : "pending";

		const [rows] = await connection.query(
			`SELECT avs.id, avs.submission_type, avs.document_url, avs.review_status, avs.reviewer_notes, avs.created_at,
			 ao.id AS organization_id, ao.legal_name, ao.display_name, ao.email AS organization_email, ao.verification_status,
			 au.id AS appraiser_user_id, au.full_name, au.email AS appraiser_email
			 FROM appraiser_verification_submissions avs
			 JOIN appraiser_organizations ao ON ao.id = avs.organization_id
			 LEFT JOIN appraiser_users au ON au.id = avs.submitted_by_user_id
			 WHERE avs.review_status = ?
			 ORDER BY avs.id DESC`,
			[filterStatus]
		);

		return res.json({ success: true, submissions: rows });
	} catch (error) {
		console.error("❌ Admin Verification List Error:", error);
		return res.status(500).json({ error: "Failed to fetch verification submissions", details: error.message });
	} finally {
		connection.release();
	}
});

// ---------- ROUTE: Admin review verification submission ----------
app.post("/api/appraiser/admin/verification/submissions/:submissionId/review", async (req, res) => {
	const connection = await pool.getConnection();
	try {
		const idToken = getBearerToken(req);
		if (!idToken) return res.status(401).json({ error: "Missing bearer token" });
		const decodedToken = await verifyFirebaseIdToken(idToken);
		const adminEmail = (decodedToken.email || "").toLowerCase();
		if (!isDhahabyAdminEmail(adminEmail)) {
			return res.status(403).json({ error: "Admin access required" });
		}

		const submissionId = Number(req.params.submissionId);
		const reviewStatus = (req.body.review_status || "").toLowerCase();
		const reviewerNotes = (req.body.reviewer_notes || "").trim();
		if (!submissionId || !["approved", "rejected"].includes(reviewStatus)) {
			return res.status(400).json({ error: "review_status must be approved or rejected" });
		}

		await connection.beginTransaction();

		const [rows] = await connection.query(
			`SELECT id, organization_id, review_status
			 FROM appraiser_verification_submissions
			 WHERE id = ?
			 LIMIT 1`,
			[submissionId]
		);
		if (rows.length === 0) {
			await connection.rollback();
			return res.status(404).json({ error: "Submission not found" });
		}

		const submission = rows[0];
		if (submission.review_status !== "pending") {
			await connection.rollback();
			return res.status(400).json({ error: "Submission already reviewed" });
		}

		await connection.query(
			`UPDATE appraiser_verification_submissions
			 SET review_status = ?, reviewer_notes = ?, reviewed_at = NOW(), reviewed_by_user_id = NULL, updated_at = NOW()
			 WHERE id = ?`,
			[reviewStatus, reviewerNotes || null, submissionId]
		);

		const orgVerificationStatus = reviewStatus === "approved" ? "approved" : "rejected";
		const orgStatus = reviewStatus === "approved" ? "verified" : "rejected";

		await connection.query(
			"UPDATE appraiser_organizations SET verification_status = ?, status = ?, updated_at = NOW() WHERE id = ?",
			[orgVerificationStatus, orgStatus, submission.organization_id]
		);

		await connection.query(
			`INSERT INTO appraiser_audit_logs (organization_id, user_id, action_type, target_type, target_id, payload_json)
			 VALUES (?, NULL, 'verification_review', 'appraiser_verification_submission', ?, CAST(? AS JSON))`,
			[
				submission.organization_id,
				String(submissionId),
				JSON.stringify({ review_status: reviewStatus, reviewer_email: adminEmail, reviewer_notes: reviewerNotes || null }),
			]
		);

		await connection.commit();

		return res.json({ success: true, review_status: reviewStatus, organization_status: orgStatus, verification_status: orgVerificationStatus });
	} catch (error) {
		await connection.rollback();
		console.error("❌ Admin Verification Review Error:", error);
		return res.status(500).json({ error: "Failed to review submission", details: error.message });
	} finally {
		connection.release();
	}
});

// ---------- ROUTE: Admin reviewed-bookings queue ----------
app.get("/api/appraiser/admin/bookings", async (req, res) => {
	const connection = await pool.getConnection();
	try {
		const idToken = getBearerToken(req);
		if (!idToken) return res.status(401).json({ error: "Missing bearer token" });

		const decodedToken = await verifyFirebaseIdToken(idToken);
		const adminEmail = (decodedToken.email || "").toLowerCase();
		if (!isDhahabyAdminEmail(adminEmail)) {
			return res.status(403).json({ error: "Admin access required" });
		}

		const requestedStatus = String(req.query.status || "reviewed").toLowerCase();
		const allowedLifecycleStatuses = new Set(["reviewed", "discarded", "converted"]);
		const lifecycleStatus = allowedLifecycleStatuses.has(requestedStatus) ? requestedStatus : "reviewed";

		const requestedSort = String(req.query.sort || "newest").toLowerCase();
		const sortSql = requestedSort === "oldest" ? "ab.id ASC" : "ab.id DESC";

		const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 250);
		const page = Math.max(Number(req.query.page) || 1, 1);
		const offset = (page - 1) * limit;

			const [rows] = await connection.query(
				`SELECT ab.id, ab.prevaluation_id, ab.booking_status, ab.booking_date, ab.booking_slot,
				        ab.customer_notes, ab.internal_notes, ab.source_channel, ab.completed_at, ab.created_at, ab.updated_at,
				        ao.display_name AS organization_name, ao.legal_name AS organization_legal_name,
				        u.full_name AS customer_full_name, u.email AS customer_email, u.wallet_address AS customer_wallet_address,
				        apv.status AS prevaluation_status,
				        apv.bnb_tx_hash, apv.bnb_address, apv.avax_tx_hash, apv.avax_address,
				        CASE
				        	WHEN apv.avax_tx_hash IS NOT NULL OR apv.avax_address IS NOT NULL THEN 'avax'
				        	WHEN apv.bnb_tx_hash IS NOT NULL OR apv.bnb_address IS NOT NULL THEN 'bnb'
				        	ELSE NULL
				        END AS valuation_chain_key,
				        nft.id AS nft_issuance_id, nft.status AS nft_issuance_status, nft.chain_key AS nft_chain_key,
				        nft.token_standard AS nft_token_standard, nft.contract_address AS nft_contract_address,
				        nft.token_id AS nft_token_id, nft.tx_hash AS nft_tx_hash, nft.metadata_uri AS nft_metadata_uri,
				        nft.owner_wallet_address AS nft_owner_wallet_address, nft.failure_reason AS nft_failure_reason,
				        nft.minted_at AS nft_minted_at, nft.updated_at AS nft_updated_at,
				        nft.retry_count AS nft_retry_count, nft.max_retries AS nft_max_retries,
				        decision_audit.payload_json AS decision_payload_json, decision_audit.created_at AS decision_created_at
				 FROM appraiser_bookings ab
				 JOIN ai_prevaluations apv ON apv.id = ab.prevaluation_id
				 JOIN appraiser_organizations ao ON ao.id = ab.organization_id
				 LEFT JOIN users u ON u.id = apv.user_id
				 LEFT JOIN nft_issuances nft
				   ON nft.id = (
				     SELECT ni2.id
				     FROM nft_issuances ni2
				     WHERE ni2.prevaluation_id = ab.prevaluation_id
				     ORDER BY ni2.id DESC
				     LIMIT 1
				   )
				 LEFT JOIN appraiser_audit_logs decision_audit
				   ON decision_audit.id = (
				     SELECT aal2.id
			     FROM appraiser_audit_logs aal2
			     WHERE aal2.target_type = 'appraiser_booking'
			       AND aal2.target_id = CAST(ab.id AS CHAR)
			       AND aal2.action_type = 'admin_booking_decision'
			     ORDER BY aal2.id DESC
			     LIMIT 1
			   )
			 WHERE apv.status = ?
			 ORDER BY ${sortSql}
			 LIMIT ? OFFSET ?`,
			[lifecycleStatus, limit, offset]
		);

		const bookings = rows.map((row) => {
			const customerNotes = parseJsonObject(row.customer_notes);
			const { reviewNotes, reviewDocReference } = parseReviewNotesAndDocRef(row.internal_notes);
			const decisionPayload = parseJsonObject(row.decision_payload_json);
			return {
				id: row.id,
				prevaluation_id: row.prevaluation_id,
				booking_status: row.booking_status,
				booking_date: row.booking_date,
				booking_slot: row.booking_slot,
				organization_name: row.organization_name || row.organization_legal_name || "",
				customer_name: customerNotes.full_name || row.customer_full_name || "",
				customer_email: customerNotes.email || row.customer_email || "",
				customer_wallet: customerNotes.wallet || row.customer_wallet_address || "",
				prevaluation_status: row.prevaluation_status,
				source_channel: row.source_channel || null,
				valuation_chain_key: row.valuation_chain_key || null,
				review_notes: reviewNotes,
				review_doc_reference: reviewDocReference,
				reviewed_at: row.completed_at || null,
				created_at: row.created_at,
				updated_at: row.updated_at,
					decision_reason: decisionPayload.decision_reason || null,
					decided_at: decisionPayload.decided_at || row.decision_created_at || null,
					decided_by: decisionPayload.reviewer_email || null,
					nft_issuance: normalizeNftIssuance(row),
				};
			});

		return res.json({
			success: true,
			filter_status: lifecycleStatus,
			page,
			limit,
			count: bookings.length,
			bookings,
		});
	} catch (error) {
		console.error("❌ Admin Booking Queue Error:", error);
		return res.status(500).json({ error: "Failed to fetch admin booking queue", details: error.message });
	} finally {
		connection.release();
	}
});

// ---------- ROUTE: Admin booking lifecycle decision ----------
app.post("/api/appraiser/admin/bookings/:bookingId/decision", async (req, res) => {
	const connection = await pool.getConnection();
	let transactionStarted = false;
	try {
		const idToken = getBearerToken(req);
		if (!idToken) return res.status(401).json({ error: "Missing bearer token" });

		const decodedToken = await verifyFirebaseIdToken(idToken);
		const adminEmail = (decodedToken.email || "").toLowerCase();
		if (!isDhahabyAdminEmail(adminEmail)) {
			return res.status(403).json({ error: "Admin access required" });
		}

		const bookingId = Number(req.params.bookingId);
		if (!Number.isInteger(bookingId) || bookingId <= 0) {
			return res.status(400).json({ error: "Invalid bookingId" });
		}

		const prevaluationId = Number(req.body?.prevaluation_id);
		if (!Number.isInteger(prevaluationId) || prevaluationId <= 0) {
			return res.status(400).json({ error: "Invalid prevaluation_id" });
		}

		const decision = String(req.body?.decision || "").toLowerCase();
		if (decision !== "discarded" && decision !== "converted") {
			return res.status(400).json({ error: "decision must be discarded or converted" });
		}

		const decisionReason = String(req.body?.decision_reason || "").trim();
		const decisionNotes = String(req.body?.decision_notes || "").trim();
		const issuanceIntent = req.body?.issuance_intent && typeof req.body.issuance_intent === "object"
			? req.body.issuance_intent
			: null;

		if (decision === "discarded" && !decisionReason) {
			return res.status(400).json({ error: "decision_reason is required for discarded decisions" });
		}

		await connection.beginTransaction();
		transactionStarted = true;

			const [bookingRows] = await connection.query(
				`SELECT ab.id, ab.prevaluation_id, ab.organization_id, apv.status AS prevaluation_status,
				        u.wallet_address AS customer_wallet_address
				 FROM appraiser_bookings ab
				 JOIN ai_prevaluations apv ON apv.id = ab.prevaluation_id
				 LEFT JOIN users u ON u.id = apv.user_id
				 WHERE ab.id = ?
				 LIMIT 1
				 FOR UPDATE`,
				[bookingId]
		);

		if (bookingRows.length === 0) {
			await connection.rollback();
			transactionStarted = false;
			return res.status(404).json({ error: "Booking not found" });
		}

		const booking = bookingRows[0];
		if (Number(booking.prevaluation_id) !== prevaluationId) {
			await connection.rollback();
			transactionStarted = false;
			return res.status(400).json({ error: "Booking/prevaluation mismatch" });
		}

		const currentLifecycle = String(booking.prevaluation_status || "").toLowerCase();
		if (currentLifecycle !== "reviewed") {
			await connection.rollback();
			transactionStarted = false;
			return res.status(409).json({
				error: `Pre-valuation must be reviewed before final decision (current: ${currentLifecycle || "unknown"})`,
			});
		}

		await connection.query(
			`UPDATE ai_prevaluations
			 SET status = ?, updated_at = NOW()
			 WHERE id = ?`,
			[decision, prevaluationId]
		);

			await connection.query(
				`UPDATE appraiser_bookings
				 SET updated_at = NOW()
				 WHERE id = ?`,
				[bookingId]
			);

			let nftIssuanceRecord = null;
			if (decision === "converted") {
				const issuanceOwnerWallet = String(
					issuanceIntent?.owner_wallet_address ||
					booking.customer_wallet_address ||
					""
				).trim();
				if (!issuanceOwnerWallet) {
					await connection.rollback();
					transactionStarted = false;
					return res.status(400).json({
						error: "owner_wallet_address is required for converted decisions",
					});
				}

				const chainKey = String(issuanceIntent?.chain_key || "bnb").trim().toLowerCase() || "bnb";
				const tokenStandard = String(issuanceIntent?.token_standard || "ERC721").trim().toUpperCase() || "ERC721";
				const allowedTokenStandards = new Set(["ERC721", "ERC1155", "SPL", "TON"]);
				if (!allowedTokenStandards.has(tokenStandard)) {
					await connection.rollback();
					transactionStarted = false;
					return res.status(400).json({
						error: "token_standard must be one of ERC721, ERC1155, SPL, TON",
					});
				}
				const contractAddress = issuanceIntent?.contract_address
					? String(issuanceIntent.contract_address).trim()
					: null;
				const metadataUri = issuanceIntent?.metadata_uri
					? String(issuanceIntent.metadata_uri).trim()
					: null;

				const [existingIssuanceRows] = await connection.query(
					`SELECT id, status, chain_key, token_standard, contract_address, token_id, tx_hash,
					        metadata_uri, owner_wallet_address, failure_reason, minted_at, updated_at
					 FROM nft_issuances
					 WHERE prevaluation_id = ?
					 ORDER BY id DESC
					 LIMIT 1
					 FOR UPDATE`,
					[prevaluationId]
				);

					if (existingIssuanceRows.length > 0) {
						const existing = existingIssuanceRows[0];
						const existingStatus = String(existing.status || "").toLowerCase();
						if (existingStatus === "queued" || existingStatus === "processing") {
							nftIssuanceRecord = existing;
						} else if (existingStatus === "minted") {
							await connection.rollback();
							transactionStarted = false;
							return res.status(409).json({
								error: "NFT is already minted for this prevaluation. Re-issuance is blocked to preserve issuance history.",
								existing_issuance_id: existing.id,
								existing_token_id: existing.token_id || null,
								existing_tx_hash: existing.tx_hash || null,
							});
						} else {
							const [insertIssuance] = await connection.query(
								`INSERT INTO nft_issuances
								 (prevaluation_id, appraisal_report_id, organization_id, requested_by_user_id, owner_wallet_address,
								  chain_key, token_standard, contract_address, metadata_uri, status, retry_count, max_retries)
								 VALUES (?, NULL, ?, NULL, ?, ?, ?, ?, ?, 'queued', 0, ?)`,
								[
									prevaluationId,
									booking.organization_id,
									issuanceOwnerWallet,
									chainKey,
									tokenStandard,
									contractAddress,
									metadataUri,
									Math.max(Number(process.env.NFT_ISSUANCE_MAX_RETRIES) || 3, 1),
								]
							);
							nftIssuanceRecord = {
								id: insertIssuance.insertId,
								status: "queued",
								chain_key: chainKey,
								token_standard: tokenStandard,
								contract_address: contractAddress,
								token_id: null,
								tx_hash: null,
								metadata_uri: metadataUri,
								owner_wallet_address: issuanceOwnerWallet,
								failure_reason: null,
								minted_at: null,
							};
						}
					} else {
						const [insertIssuance] = await connection.query(
							`INSERT INTO nft_issuances
							 (prevaluation_id, appraisal_report_id, organization_id, requested_by_user_id, owner_wallet_address,
							  chain_key, token_standard, contract_address, metadata_uri, status, retry_count, max_retries)
							 VALUES (?, NULL, ?, NULL, ?, ?, ?, ?, ?, 'queued', 0, ?)`,
							[
								prevaluationId,
								booking.organization_id,
								issuanceOwnerWallet,
								chainKey,
								tokenStandard,
								contractAddress,
								metadataUri,
								Math.max(Number(process.env.NFT_ISSUANCE_MAX_RETRIES) || 3, 1),
							]
						);
					nftIssuanceRecord = {
						id: insertIssuance.insertId,
						status: "queued",
						chain_key: chainKey,
						token_standard: tokenStandard,
						contract_address: contractAddress,
						token_id: null,
						tx_hash: null,
						metadata_uri: metadataUri,
						owner_wallet_address: issuanceOwnerWallet,
						failure_reason: null,
						minted_at: null,
					};
				}
			}

			const decisionPayload = {
				prevaluation_id: prevaluationId,
			decision,
			decision_reason: decisionReason || null,
			decision_notes: decisionNotes || null,
			issuance_intent: decision === "converted" ? issuanceIntent : null,
			reviewer_email: adminEmail || null,
			decided_at: new Date().toISOString(),
		};

		await connection.query(
			`INSERT INTO appraiser_audit_logs (organization_id, user_id, action_type, target_type, target_id, payload_json)
			 VALUES (?, NULL, 'admin_booking_decision', 'appraiser_booking', ?, CAST(? AS JSON))`,
			[
				booking.organization_id,
				String(bookingId),
				JSON.stringify(decisionPayload),
			]
		);

		await connection.commit();
		transactionStarted = false;

		return res.json({
			success: true,
			booking: {
				id: bookingId,
				prevaluation_id: prevaluationId,
				prevaluation_status: decision,
				updated_at: new Date().toISOString(),
			},
			decision: {
				decision,
				decision_reason: decisionPayload.decision_reason,
					decision_notes: decisionPayload.decision_notes,
					issuance_intent: decisionPayload.issuance_intent,
					decided_by: decisionPayload.reviewer_email,
					decided_at: decisionPayload.decided_at,
				},
				nft_issuance: nftIssuanceRecord
					? {
						id: nftIssuanceRecord.id,
						status: nftIssuanceRecord.status,
						chain_key: nftIssuanceRecord.chain_key,
						token_standard: nftIssuanceRecord.token_standard,
						contract_address: nftIssuanceRecord.contract_address,
						token_id: nftIssuanceRecord.token_id,
						tx_hash: nftIssuanceRecord.tx_hash,
						metadata_uri: nftIssuanceRecord.metadata_uri,
						owner_wallet_address: nftIssuanceRecord.owner_wallet_address,
						failure_reason: nftIssuanceRecord.failure_reason,
						minted_at: nftIssuanceRecord.minted_at,
					}
					: null,
			});
	} catch (error) {
		if (transactionStarted) {
			await connection.rollback();
		}
		console.error("❌ Admin Booking Decision Error:", error);
		return res.status(500).json({ error: "Failed to apply admin booking decision", details: error.message });
	} finally {
		connection.release();
	}
});

// ---------- ROUTE: Admin NFT issuance detail ----------
app.get([
	"/api/appraiser/admin/nft-issuances",
	"/api/appraiser/admin/nft-issuance",
	"/api/appraiser/admin/nft_issuances",
], async (req, res) => {
	const connection = await pool.getConnection();
	try {
		const idToken = getBearerToken(req);
		if (!idToken) return res.status(401).json({ error: "Missing bearer token" });
		const decodedToken = await verifyFirebaseIdToken(idToken);
		const adminEmail = (decodedToken.email || "").toLowerCase();
		if (!isDhahabyAdminEmail(adminEmail)) {
			return res.status(403).json({ error: "Admin access required" });
		}

		const status = String(req.query.status || "").trim().toLowerCase();
		const prevaluationId = Number(req.query.prevaluation_id || 0);
		const where = [];
		const params = [];
		if (status) {
			where.push("ni.status = ?");
			params.push(status);
		}
		if (prevaluationId > 0) {
			where.push("ni.prevaluation_id = ?");
			params.push(prevaluationId);
		}
		const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

			const [rows] = await connection.query(
				`SELECT ni.id AS nft_issuance_id, ni.prevaluation_id, ni.organization_id, ni.owner_wallet_address,
				        ni.chain_key AS nft_chain_key, ni.token_standard AS nft_token_standard,
				        ni.contract_address AS nft_contract_address, ni.token_id AS nft_token_id,
				        ni.tx_hash AS nft_tx_hash, ni.metadata_uri AS nft_metadata_uri,
				        ni.status AS nft_issuance_status, ni.failure_reason AS nft_failure_reason,
				        ni.minted_at AS nft_minted_at, ni.updated_at AS nft_updated_at,
				        ni.retry_count AS nft_retry_count, ni.max_retries AS nft_max_retries,
				        apv.status AS prevaluation_status,
				        latest_booking.booking_id AS booking_id
				 FROM nft_issuances ni
				 LEFT JOIN ai_prevaluations apv ON apv.id = ni.prevaluation_id
				 LEFT JOIN (
				     SELECT prevaluation_id, MAX(id) AS booking_id
				     FROM appraiser_bookings
				     GROUP BY prevaluation_id
				 ) latest_booking ON latest_booking.prevaluation_id = ni.prevaluation_id
				 ${whereSql}
				 ORDER BY ni.id DESC
				 LIMIT 250`,
				params
			);

		return res.json({
			success: true,
			count: rows.length,
			issuances: rows.map((row) => ({
				prevaluation_id: row.prevaluation_id,
				organization_id: row.organization_id,
				booking_id: row.booking_id,
				prevaluation_status: row.prevaluation_status,
				owner_wallet_address: row.owner_wallet_address,
				...normalizeNftIssuance(row),
			})),
		});
	} catch (error) {
		console.error("❌ Admin NFT Issuance List Error:", error);
		return res.status(500).json({ error: "Failed to fetch nft issuances", details: error.message });
	} finally {
		connection.release();
	}
});

// ---------- ROUTE: Admin requeue NFT issuance ----------
app.post([
	"/api/appraiser/admin/nft-issuances/:issuanceId/requeue",
	"/api/appraiser/admin/nft-issuance/:issuanceId/requeue",
	"/api/appraiser/admin/nft_issuances/:issuanceId/requeue",
], async (req, res) => {
	const connection = await pool.getConnection();
	try {
		const idToken = getBearerToken(req);
		if (!idToken) return res.status(401).json({ error: "Missing bearer token" });
		const decodedToken = await verifyFirebaseIdToken(idToken);
		const adminEmail = (decodedToken.email || "").toLowerCase();
		if (!isDhahabyAdminEmail(adminEmail)) {
			return res.status(403).json({ error: "Admin access required" });
		}

		const issuanceId = Number(req.params.issuanceId);
		if (!Number.isInteger(issuanceId) || issuanceId <= 0) {
			return res.status(400).json({ error: "Invalid issuanceId" });
		}

		await connection.beginTransaction();
		const [rows] = await connection.query(
			`SELECT id, status, organization_id, prevaluation_id, retry_count, max_retries
			 FROM nft_issuances
			 WHERE id = ?
			 LIMIT 1
			 FOR UPDATE`,
			[issuanceId]
		);
		if (rows.length === 0) {
			await connection.rollback();
			return res.status(404).json({ error: "Issuance not found" });
		}
		const row = rows[0];
		if (!["failed", "cancelled"].includes(String(row.status || "").toLowerCase())) {
			await connection.rollback();
			return res.status(409).json({ error: "Only failed or cancelled issuances can be requeued" });
		}

		await connection.query(
			`UPDATE nft_issuances
			 SET status = 'queued',
			     failure_reason = NULL,
			     processor_id = NULL,
			     processing_started_at = NULL,
			     updated_at = NOW()
			 WHERE id = ?`,
			[issuanceId]
		);

		await connection.query(
			`INSERT INTO appraiser_audit_logs (organization_id, user_id, action_type, target_type, target_id, payload_json)
			 VALUES (?, NULL, 'nft_issuance_requeue', 'nft_issuance', ?, CAST(? AS JSON))`,
			[
				row.organization_id,
				String(issuanceId),
				JSON.stringify({
					requeued_by: adminEmail || null,
					requeued_at: new Date().toISOString(),
					prevaluation_id: row.prevaluation_id,
				}),
			]
		);
		await connection.commit();
		return res.json({ success: true, issuance_id: issuanceId, status: "queued" });
	} catch (error) {
		try { await connection.rollback(); } catch {}
		console.error("❌ Admin NFT Requeue Error:", error);
		return res.status(500).json({ error: "Failed to requeue issuance", details: error.message });
	} finally {
		connection.release();
	}
});

// ---------- ROUTE: Admin cancel NFT issuance ----------
app.post([
	"/api/appraiser/admin/nft-issuances/:issuanceId/cancel",
	"/api/appraiser/admin/nft-issuance/:issuanceId/cancel",
	"/api/appraiser/admin/nft_issuances/:issuanceId/cancel",
], async (req, res) => {
	const connection = await pool.getConnection();
	try {
		const idToken = getBearerToken(req);
		if (!idToken) return res.status(401).json({ error: "Missing bearer token" });
		const decodedToken = await verifyFirebaseIdToken(idToken);
		const adminEmail = (decodedToken.email || "").toLowerCase();
		if (!isDhahabyAdminEmail(adminEmail)) {
			return res.status(403).json({ error: "Admin access required" });
		}
		const issuanceId = Number(req.params.issuanceId);
		if (!Number.isInteger(issuanceId) || issuanceId <= 0) {
			return res.status(400).json({ error: "Invalid issuanceId" });
		}
		const reason = String(req.body?.reason || "Cancelled by admin").trim();

		await connection.beginTransaction();
		const [rows] = await connection.query(
			`SELECT id, status, organization_id, prevaluation_id
			 FROM nft_issuances
			 WHERE id = ?
			 LIMIT 1
			 FOR UPDATE`,
			[issuanceId]
		);
		if (rows.length === 0) {
			await connection.rollback();
			return res.status(404).json({ error: "Issuance not found" });
		}
		const row = rows[0];
		const current = String(row.status || "").toLowerCase();
		if (current === "minted") {
			await connection.rollback();
			return res.status(409).json({ error: "Minted issuance cannot be cancelled" });
		}

		await connection.query(
			`UPDATE nft_issuances
			 SET status = 'cancelled',
			     failure_reason = ?,
			     processor_id = NULL,
			     processing_started_at = NULL,
			     cancelled_at = NOW(),
			     updated_at = NOW()
			 WHERE id = ?`,
			[reason, issuanceId]
		);
		await connection.query(
			`INSERT INTO appraiser_audit_logs (organization_id, user_id, action_type, target_type, target_id, payload_json)
			 VALUES (?, NULL, 'nft_issuance_cancel', 'nft_issuance', ?, CAST(? AS JSON))`,
			[
				row.organization_id,
				String(issuanceId),
				JSON.stringify({
					cancelled_by: adminEmail || null,
					cancelled_at: new Date().toISOString(),
					reason,
					prevaluation_id: row.prevaluation_id,
				}),
			]
		);
		await connection.commit();
		return res.json({ success: true, issuance_id: issuanceId, status: "cancelled" });
	} catch (error) {
		try { await connection.rollback(); } catch {}
		console.error("❌ Admin NFT Cancel Error:", error);
		return res.status(500).json({ error: "Failed to cancel issuance", details: error.message });
	} finally {
		connection.release();
		}
	});

// ---------- ROUTE: Admin overview - waitlist ----------
app.get("/api/appraiser/admin/overview/waitlist", async (req, res) => {
	const connection = await pool.getConnection();
	try {
		await requireDhahabyAdmin(req);
		const { page, limit, offset } = parsePagingParams(req, { defaultLimit: 20, maxLimit: 200 });
		const qLike = toLikePattern(req.query.q);
		const whereParts = [];
		const whereParams = [];
		if (qLike) {
			whereParts.push("(wl.email LIKE ? ESCAPE '\\\\' OR wl.interest_type LIKE ? ESCAPE '\\\\' OR wl.source LIKE ? ESCAPE '\\\\')");
			whereParams.push(qLike, qLike, qLike);
		}
		const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
		const sortKey = String(req.query.sort_by || "latest_created_at").toLowerCase();
		const sortOrder = String(req.query.sort_order || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
		const sortMap = {
			latest_created_at: "grouped.latest_created_at",
			email: "grouped.email",
			entry_count: "grouped.entry_count",
		};
		const sortColumn = sortMap[sortKey] || sortMap.latest_created_at;

		const [countRows] = await connection.query(
			`SELECT COUNT(*) AS total
			 FROM (
			     SELECT wl.email
			     FROM waitlist wl
			     ${whereSql}
			     GROUP BY wl.email
			 ) grouped_count`,
			whereParams
		);

		const [rows] = await connection.query(
			`SELECT grouped.email, grouped.entry_count, grouped.latest_created_at, grouped.interest_types, grouped.sources,
			        latest.id AS latest_id, latest.interest_type AS latest_interest_type, latest.source AS latest_source,
			        latest.user_id AS latest_user_id, latest.country_code AS latest_country_code, latest.created_at AS latest_entry_created_at
			 FROM (
			     SELECT wl.email, COUNT(*) AS entry_count, MAX(wl.created_at) AS latest_created_at,
			            GROUP_CONCAT(DISTINCT wl.interest_type ORDER BY wl.interest_type SEPARATOR ',') AS interest_types,
			            GROUP_CONCAT(DISTINCT wl.source ORDER BY wl.source SEPARATOR ',') AS sources
			     FROM waitlist wl
			     ${whereSql}
			     GROUP BY wl.email
			 ) grouped
			 LEFT JOIN waitlist latest
			   ON latest.id = (
			     SELECT wl2.id
			     FROM waitlist wl2
			     WHERE wl2.email = grouped.email
			     ORDER BY wl2.created_at DESC, wl2.id DESC
			     LIMIT 1
			   )
			 ORDER BY ${sortColumn} ${sortOrder}
			 LIMIT ? OFFSET ?`,
			[...whereParams, limit, offset]
		);

		return res.json({
			success: true,
			page,
			page_size: limit,
			total: Number(countRows[0]?.total || 0),
			rows: rows.map((row) => ({
				email: row.email,
				entry_count: Number(row.entry_count || 0),
				latest_created_at: row.latest_created_at,
				interest_types: String(row.interest_types || "").split(",").filter(Boolean),
				sources: String(row.sources || "").split(",").filter(Boolean),
				latest_entry: {
					id: row.latest_id,
					interest_type: row.latest_interest_type || null,
					source: row.latest_source || null,
					user_id: row.latest_user_id || null,
					country_code: row.latest_country_code || null,
					created_at: row.latest_entry_created_at || null,
				},
			})),
		});
	} catch (error) {
		const status = error.status || 500;
		console.error("❌ Admin Overview Waitlist Error:", error);
		return res.status(status).json({ error: error.message || "Failed to load waitlist overview" });
	} finally {
		connection.release();
	}
});

// ---------- ROUTE: Admin overview - users ----------
app.get("/api/appraiser/admin/overview/users", async (req, res) => {
	const connection = await pool.getConnection();
	try {
		await requireDhahabyAdmin(req);
		const { page, limit, offset } = parsePagingParams(req, { defaultLimit: 20, maxLimit: 200 });
		const qLike = toLikePattern(req.query.q);
		const requestedType = String(req.query.type || "all").trim().toLowerCase();
		const allowedTypes = new Set(["all", "telegram", "solana", "bnb", "avax"]);
		const typeFilter = allowedTypes.has(requestedType) ? requestedType : "all";

		const whereParts = [];
		const whereParams = [];
		if (qLike) {
			whereParts.push("(u.full_name LIKE ? ESCAPE '\\\\' OR u.email LIKE ? ESCAPE '\\\\' OR u.wallet_address LIKE ? ESCAPE '\\\\' OR u.telegram_id LIKE ? ESCAPE '\\\\')");
			whereParams.push(qLike, qLike, qLike, qLike);
		}
		if (typeFilter === "telegram") {
			whereParts.push("(u.type IS NULL OR u.type = '' OR LOWER(u.type) = 'telegram')");
		} else if (typeFilter === "solana" || typeFilter === "bnb" || typeFilter === "avax") {
			whereParts.push("LOWER(u.type) = ?");
			whereParams.push(typeFilter);
		}
		const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

		const sortKey = String(req.query.sort_by || "created_at").toLowerCase();
		const sortOrder = String(req.query.sort_order || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
		const sortMap = {
			created_at: "u.created_at",
			updated_at: "u.updated_at",
			full_name: "u.full_name",
			telegram_id: "u.telegram_id",
			type: "u.type",
			wallet_address: "u.wallet_address",
		};
		const sortColumn = sortMap[sortKey] || sortMap.created_at;

		const [countRows] = await connection.query(
			`SELECT COUNT(*) AS total
			 FROM users u
			 ${whereSql}`,
			whereParams
		);

		const [summaryRows] = await connection.query(
			`SELECT COUNT(*) AS total,
			        SUM(CASE WHEN (u.type IS NULL OR u.type = '' OR LOWER(u.type) = 'telegram') THEN 1 ELSE 0 END) AS telegram_count,
			        SUM(CASE WHEN LOWER(COALESCE(u.type, '')) = 'solana' THEN 1 ELSE 0 END) AS solana_count,
			        SUM(CASE WHEN LOWER(COALESCE(u.type, '')) = 'bnb' THEN 1 ELSE 0 END) AS bnb_count,
			        SUM(CASE WHEN LOWER(COALESCE(u.type, '')) = 'avax' THEN 1 ELSE 0 END) AS avax_count,
			        SUM(CASE WHEN COALESCE(u.wallet_address, '') <> '' THEN 1 ELSE 0 END) AS with_wallet_count
			 FROM users u
			 ${whereSql}`,
			whereParams
		);

		const [rows] = await connection.query(
			`SELECT u.id, u.wallet_address, u.telegram_id, u.full_name, u.email, u.phone, u.role, u.type, u.created_at, u.updated_at
			 FROM users u
			 ${whereSql}
			 ORDER BY ${sortColumn} ${sortOrder}
			 LIMIT ? OFFSET ?`,
			[...whereParams, limit, offset]
		);

		return res.json({
			success: true,
			page,
			page_size: limit,
			total: Number(countRows[0]?.total || 0),
			summary: {
				total: Number(summaryRows[0]?.total || 0),
				telegram_count: Number(summaryRows[0]?.telegram_count || 0),
				solana_count: Number(summaryRows[0]?.solana_count || 0),
				bnb_count: Number(summaryRows[0]?.bnb_count || 0),
				avax_count: Number(summaryRows[0]?.avax_count || 0),
				with_wallet_count: Number(summaryRows[0]?.with_wallet_count || 0),
			},
			rows,
		});
	} catch (error) {
		const status = error.status || 500;
		console.error("❌ Admin Overview Users Error:", error);
		return res.status(status).json({ error: error.message || "Failed to load users overview" });
	} finally {
		connection.release();
	}
});

// ---------- ROUTE: Admin overview - valuations ----------
app.get("/api/appraiser/admin/overview/valuations", async (req, res) => {
	const connection = await pool.getConnection();
	try {
		await requireDhahabyAdmin(req);
		const { page, limit, offset } = parsePagingParams(req, { defaultLimit: 20, maxLimit: 200 });
		const qLike = toLikePattern(req.query.q);
		const statusFilter = String(req.query.status || "").trim().toLowerCase();
		const allowedStatuses = new Set(["pending", "scheduled", "reviewed", "discarded", "converted"]);

		const whereParts = [];
		const whereParams = [];
		if (qLike) {
			whereParts.push("(u.full_name LIKE ? ESCAPE '\\\\' OR u.wallet_address LIKE ? ESCAPE '\\\\' OR u.telegram_id LIKE ? ESCAPE '\\\\' OR CAST(apv.id AS CHAR) LIKE ? ESCAPE '\\\\')");
			whereParams.push(qLike, qLike, qLike, qLike);
		}
		if (allowedStatuses.has(statusFilter)) {
			whereParts.push("apv.status = ?");
			whereParams.push(statusFilter);
		}
		const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

		const sortKey = String(req.query.sort_by || "latest_created_at").toLowerCase();
		const sortOrder = String(req.query.sort_order || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
		const sortMap = {
			latest_created_at: "latest_created_at",
			valuations_count: "valuations_count",
			avg_confidence: "avg_confidence",
			user_id: "apv.user_id",
		};
		const sortColumn = sortMap[sortKey] || sortMap.latest_created_at;

		const [countRows] = await connection.query(
			`SELECT COUNT(*) AS total
			 FROM (
			     SELECT apv.user_id
			     FROM ai_prevaluations apv
			     JOIN users u ON u.id = apv.user_id
			     ${whereSql}
			     GROUP BY apv.user_id
			 ) grouped_count`,
			whereParams
		);

		const [summaryRows] = await connection.query(
			`SELECT COUNT(*) AS total_valuations,
			        COUNT(DISTINCT apv.user_id) AS total_users,
			        SUM(CASE WHEN apv.status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
			        SUM(CASE WHEN apv.status = 'scheduled' THEN 1 ELSE 0 END) AS scheduled_count,
			        SUM(CASE WHEN apv.status = 'reviewed' THEN 1 ELSE 0 END) AS reviewed_count,
			        SUM(CASE WHEN apv.status = 'discarded' THEN 1 ELSE 0 END) AS discarded_count,
			        SUM(CASE WHEN apv.status = 'converted' THEN 1 ELSE 0 END) AS converted_count
			 FROM ai_prevaluations apv
			 JOIN users u ON u.id = apv.user_id
			 ${whereSql}`,
			whereParams
		);

		const [rows] = await connection.query(
			`SELECT apv.user_id, u.full_name, u.wallet_address, u.telegram_id, u.type,
			        COUNT(*) AS valuations_count,
			        MAX(apv.created_at) AS latest_created_at,
			        MIN(apv.created_at) AS first_created_at,
			        AVG(COALESCE(apv.confidence, 0)) AS avg_confidence,
			        SUM(CASE WHEN apv.status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
			        SUM(CASE WHEN apv.status = 'scheduled' THEN 1 ELSE 0 END) AS scheduled_count,
			        SUM(CASE WHEN apv.status = 'reviewed' THEN 1 ELSE 0 END) AS reviewed_count,
			        SUM(CASE WHEN apv.status = 'discarded' THEN 1 ELSE 0 END) AS discarded_count,
			        SUM(CASE WHEN apv.status = 'converted' THEN 1 ELSE 0 END) AS converted_count
			 FROM ai_prevaluations apv
			 JOIN users u ON u.id = apv.user_id
			 ${whereSql}
			 GROUP BY apv.user_id, u.full_name, u.wallet_address, u.telegram_id, u.type
			 ORDER BY ${sortColumn} ${sortOrder}
			 LIMIT ? OFFSET ?`,
			[...whereParams, limit, offset]
		);

		return res.json({
			success: true,
			page,
			page_size: limit,
			total: Number(countRows[0]?.total || 0),
			summary: {
				total_valuations: Number(summaryRows[0]?.total_valuations || 0),
				total_users: Number(summaryRows[0]?.total_users || 0),
				pending_count: Number(summaryRows[0]?.pending_count || 0),
				scheduled_count: Number(summaryRows[0]?.scheduled_count || 0),
				reviewed_count: Number(summaryRows[0]?.reviewed_count || 0),
				discarded_count: Number(summaryRows[0]?.discarded_count || 0),
				converted_count: Number(summaryRows[0]?.converted_count || 0),
			},
			rows: rows.map((row) => ({
				...row,
				valuations_count: Number(row.valuations_count || 0),
				avg_confidence: Number(row.avg_confidence || 0),
				pending_count: Number(row.pending_count || 0),
				scheduled_count: Number(row.scheduled_count || 0),
				reviewed_count: Number(row.reviewed_count || 0),
				discarded_count: Number(row.discarded_count || 0),
				converted_count: Number(row.converted_count || 0),
			})),
		});
	} catch (error) {
		const status = error.status || 500;
		console.error("❌ Admin Overview Valuations Error:", error);
		return res.status(status).json({ error: error.message || "Failed to load valuations overview" });
	} finally {
		connection.release();
	}
});

// ---------- ROUTE: Admin overview - organizations ----------
app.get("/api/appraiser/admin/overview/organizations", async (req, res) => {
	const connection = await pool.getConnection();
	try {
		await requireDhahabyAdmin(req);
		const { page, limit, offset } = parsePagingParams(req, { defaultLimit: 20, maxLimit: 200 });
		const qLike = toLikePattern(req.query.q);
		const verificationStatus = String(req.query.verification_status || "").trim().toLowerCase();
		const lifecycleStatus = String(req.query.status || "").trim().toLowerCase();
		const allowedVerificationStatuses = new Set(["not_started", "submitted", "in_review", "approved", "rejected"]);
		const allowedStatuses = new Set(["pending", "verified", "rejected", "suspended"]);

		const whereParts = [];
		const whereParams = [];
		if (qLike) {
			whereParts.push("(ao.legal_name LIKE ? ESCAPE '\\\\' OR ao.display_name LIKE ? ESCAPE '\\\\' OR ao.email LIKE ? ESCAPE '\\\\' OR ao.phone LIKE ? ESCAPE '\\\\' OR ao.website_url LIKE ? ESCAPE '\\\\')");
			whereParams.push(qLike, qLike, qLike, qLike, qLike);
		}
		if (allowedVerificationStatuses.has(verificationStatus)) {
			whereParts.push("ao.verification_status = ?");
			whereParams.push(verificationStatus);
		}
		if (allowedStatuses.has(lifecycleStatus)) {
			whereParts.push("ao.status = ?");
			whereParams.push(lifecycleStatus);
		}
		const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

		const sortKey = String(req.query.sort_by || "updated_at").toLowerCase();
		const sortOrder = String(req.query.sort_order || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
		const sortMap = {
			created_at: "ao.created_at",
			updated_at: "ao.updated_at",
			legal_name: "ao.legal_name",
			display_name: "ao.display_name",
			verification_status: "ao.verification_status",
			status: "ao.status",
		};
		const sortColumn = sortMap[sortKey] || sortMap.updated_at;

		const [countRows] = await connection.query(
			`SELECT COUNT(*) AS total
			 FROM appraiser_organizations ao
			 ${whereSql}`,
			whereParams
		);

		const [summaryRows] = await connection.query(
			`SELECT COUNT(*) AS total,
			        SUM(CASE WHEN ao.verification_status = 'approved' THEN 1 ELSE 0 END) AS approved_count,
			        SUM(CASE WHEN ao.verification_status = 'submitted' THEN 1 ELSE 0 END) AS submitted_count,
			        SUM(CASE WHEN ao.verification_status = 'in_review' THEN 1 ELSE 0 END) AS in_review_count,
			        SUM(CASE WHEN ao.verification_status = 'rejected' THEN 1 ELSE 0 END) AS rejected_count
			 FROM appraiser_organizations ao
			 ${whereSql}`,
			whereParams
		);

		const [rows] = await connection.query(
			`SELECT ao.*
			 FROM appraiser_organizations ao
			 ${whereSql}
			 ORDER BY ${sortColumn} ${sortOrder}
			 LIMIT ? OFFSET ?`,
			[...whereParams, limit, offset]
		);

		return res.json({
			success: true,
			page,
			page_size: limit,
			total: Number(countRows[0]?.total || 0),
			summary: {
				total: Number(summaryRows[0]?.total || 0),
				approved_count: Number(summaryRows[0]?.approved_count || 0),
				submitted_count: Number(summaryRows[0]?.submitted_count || 0),
				in_review_count: Number(summaryRows[0]?.in_review_count || 0),
				rejected_count: Number(summaryRows[0]?.rejected_count || 0),
			},
			rows: rows.map((row) => ({
				...row,
				metadata_json: parseJsonObjectLoose(row.metadata_json),
			})),
		});
	} catch (error) {
		const status = error.status || 500;
		console.error("❌ Admin Overview Organizations Error:", error);
		return res.status(status).json({ error: error.message || "Failed to load organizations overview" });
	} finally {
		connection.release();
	}
});

// ---------- ROUTE: Admin overview - NFT issuances ----------
app.get("/api/appraiser/admin/overview/nfts", async (req, res) => {
	const connection = await pool.getConnection();
	try {
		await requireDhahabyAdmin(req);
		const { page, limit, offset } = parsePagingParams(req, { defaultLimit: 20, maxLimit: 200 });
		const qLike = toLikePattern(req.query.q);
		const statusFilter = String(req.query.status || "").trim().toLowerCase();
		const chainKeyFilter = String(req.query.chain_key || "").trim().toLowerCase();
		const organizationId = Number(req.query.organization_id || 0);
		const prevaluationId = Number(req.query.prevaluation_id || 0);
		const allowedStatuses = new Set(["queued", "processing", "minted", "failed", "cancelled"]);

		const whereParts = [];
		const whereParams = [];
		if (qLike) {
			whereParts.push("(ni.tx_hash LIKE ? ESCAPE '\\\\' OR ni.token_id LIKE ? ESCAPE '\\\\' OR ni.contract_address LIKE ? ESCAPE '\\\\' OR ni.owner_wallet_address LIKE ? ESCAPE '\\\\')");
			whereParams.push(qLike, qLike, qLike, qLike);
		}
		if (allowedStatuses.has(statusFilter)) {
			whereParts.push("ni.status = ?");
			whereParams.push(statusFilter);
		}
		if (chainKeyFilter) {
			whereParts.push("LOWER(ni.chain_key) = ?");
			whereParams.push(chainKeyFilter);
		}
		if (organizationId > 0) {
			whereParts.push("ni.organization_id = ?");
			whereParams.push(organizationId);
		}
		if (prevaluationId > 0) {
			whereParts.push("ni.prevaluation_id = ?");
			whereParams.push(prevaluationId);
		}
		const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

		const sortKey = String(req.query.sort_by || "updated_at").toLowerCase();
		const sortOrder = String(req.query.sort_order || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
		const sortMap = {
			id: "ni.id",
			created_at: "ni.created_at",
			updated_at: "ni.updated_at",
			minted_at: "ni.minted_at",
			status: "ni.status",
		};
		const sortColumn = sortMap[sortKey] || sortMap.updated_at;

		const [countRows] = await connection.query(
			`SELECT COUNT(*) AS total
			 FROM nft_issuances ni
			 ${whereSql}`,
			whereParams
		);

		const [summaryRows] = await connection.query(
			`SELECT COUNT(*) AS total,
			        SUM(CASE WHEN ni.status = 'queued' THEN 1 ELSE 0 END) AS queued_count,
			        SUM(CASE WHEN ni.status = 'processing' THEN 1 ELSE 0 END) AS processing_count,
			        SUM(CASE WHEN ni.status = 'minted' THEN 1 ELSE 0 END) AS minted_count,
			        SUM(CASE WHEN ni.status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
			        SUM(CASE WHEN ni.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_count
			 FROM nft_issuances ni
			 ${whereSql}`,
			whereParams
		);

		const [rows] = await connection.query(
			`SELECT ni.*, apv.status AS prevaluation_status, ao.legal_name AS organization_legal_name, ao.display_name AS organization_display_name
			 FROM nft_issuances ni
			 LEFT JOIN ai_prevaluations apv ON apv.id = ni.prevaluation_id
			 LEFT JOIN appraiser_organizations ao ON ao.id = ni.organization_id
			 ${whereSql}
			 ORDER BY ${sortColumn} ${sortOrder}
			 LIMIT ? OFFSET ?`,
			[...whereParams, limit, offset]
		);

		return res.json({
			success: true,
			page,
			page_size: limit,
			total: Number(countRows[0]?.total || 0),
			summary: {
				total: Number(summaryRows[0]?.total || 0),
				queued_count: Number(summaryRows[0]?.queued_count || 0),
				processing_count: Number(summaryRows[0]?.processing_count || 0),
				minted_count: Number(summaryRows[0]?.minted_count || 0),
				failed_count: Number(summaryRows[0]?.failed_count || 0),
				cancelled_count: Number(summaryRows[0]?.cancelled_count || 0),
			},
			rows,
		});
	} catch (error) {
		const status = error.status || 500;
		console.error("❌ Admin Overview NFT Error:", error);
		return res.status(status).json({ error: error.message || "Failed to load nft overview" });
	} finally {
		connection.release();
	}
});

// ---------- ROUTE: Admin generate NFT metadata URI ----------
app.post("/api/appraiser/admin/bookings/:bookingId/issuance-metadata", async (req, res) => {
	const connection = await pool.getConnection();
	try {
		const idToken = getBearerToken(req);
		if (!idToken) return res.status(401).json({ error: "Missing bearer token" });
		const decodedToken = await verifyFirebaseIdToken(idToken);
		const adminEmail = (decodedToken.email || "").toLowerCase();
		if (!isDhahabyAdminEmail(adminEmail)) {
			return res.status(403).json({ error: "Admin access required" });
		}
		const bookingId = Number(req.params.bookingId);
		if (!Number.isInteger(bookingId) || bookingId <= 0) {
			return res.status(400).json({ error: "Invalid bookingId" });
		}
		const [rows] = await connection.query(
			`SELECT ab.id, ab.prevaluation_id, apv.status, apv.ai_result_json, apv.image_url, apv.valuation_hash,
			        apv.report_uri, u.wallet_address, ao.display_name, ao.legal_name, ab.organization_id
			 FROM appraiser_bookings ab
			 JOIN ai_prevaluations apv ON apv.id = ab.prevaluation_id
			 LEFT JOIN users u ON u.id = apv.user_id
			 JOIN appraiser_organizations ao ON ao.id = ab.organization_id
			 WHERE ab.id = ?
			 LIMIT 1`,
			[bookingId]
		);
		if (rows.length === 0) {
			return res.status(404).json({ error: "Booking not found" });
		}
		const row = rows[0];
		const ai = parseJsonObject(row.ai_result_json);
		const metadataDir = "./metadata";
		if (!fs.existsSync(metadataDir)) fs.mkdirSync(metadataDir);
		const metadataFile = `nft-metadata-${row.prevaluation_id}.json`;
		const metadataPath = path.join(metadataDir, metadataFile);
		const metadata = {
			name: `Dhahaby Asset #${row.prevaluation_id}`,
			description: "Dhahaby verified asset NFT",
			image: row.image_url ? `https://dhahaby-api.topy.ai/${row.image_url}` : null,
			external_url: row.report_uri || null,
			attributes: [
				{ trait_type: "Prevaluation ID", value: row.prevaluation_id },
				{ trait_type: "Organization", value: row.display_name || row.legal_name || "Unknown" },
				{ trait_type: "Weight", value: ai?.weight ?? null },
				{ trait_type: "Purity", value: ai?.purity ?? null },
				{ trait_type: "Category", value: ai?.classification?.category ?? null },
				{ trait_type: "Brand", value: ai?.classification?.brand ?? null },
				{ trait_type: "Estimated Value", value: ai?.totalValue ?? null },
				{ trait_type: "Currency", value: ai?.currency ?? null },
				{ trait_type: "Valuation Hash", value: row.valuation_hash || null },
			],
		};
		fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
		const metadataUri = `https://dhahaby-api.topy.ai/metadata/${metadataFile}`;

			await connection.query(
				`UPDATE nft_issuances
				 SET metadata_uri = ?, updated_at = NOW()
				 WHERE id = (
				 	SELECT id FROM (
				 		SELECT ni.id
				 		FROM nft_issuances ni
				 		WHERE ni.prevaluation_id = ?
				 		  AND ni.status IN ('queued', 'processing', 'failed', 'cancelled')
				 		ORDER BY ni.id DESC
				 		LIMIT 1
				 	) scoped
				 )`,
				[metadataUri, row.prevaluation_id]
			);

		await connection.query(
			`INSERT INTO appraiser_audit_logs (organization_id, user_id, action_type, target_type, target_id, payload_json)
			 VALUES (?, NULL, 'nft_metadata_generated', 'appraiser_booking', ?, CAST(? AS JSON))`,
			[
				row.organization_id,
				String(bookingId),
				JSON.stringify({
					generated_by: adminEmail || null,
					generated_at: new Date().toISOString(),
					prevaluation_id: row.prevaluation_id,
					metadata_uri: metadataUri,
				}),
			]
		);

		return res.json({
			success: true,
			booking_id: bookingId,
			prevaluation_id: row.prevaluation_id,
			metadata_uri: metadataUri,
		});
	} catch (error) {
		console.error("❌ Admin Metadata Generation Error:", error);
		return res.status(500).json({ error: "Failed to generate metadata", details: error.message });
	} finally {
		connection.release();
	}
});

// ---------- ROUTE: CLASSIFY GOLD ITEM ----------
app.post("/api/classify", async (req, res) => {
	try {
		const { imageBase64 } = req.body;

		if (!imageBase64) {
			return res.status(400).json({ error: "Missing imageBase64" });
		}

		const prompt = `
You are an expert jewellery assessor and gold item classifier.
From the uploaded image of a gold item, classify it into one of the following categories:
${JSON.stringify(itemCategories, null, 2)}

Rules:
1. Identify if it's a bar, coin, chain, ring, earring, gold jewellery, luxury watch, diamond jewellery, or other.
2. Estimate your confidence (0–1).
3. Use the variance range from the table that best fits.
4. Estimate the weight in grams based on typical sizes for that item type.
5. Based on the image, justify its purity, possibly value in integers [10,14,16,18,20,21,22,24].
6. Try to find the brand/model if it's a luxury watch or branded item. And extra the brand information in reasoning.
7. Try to find the brand/model online to get an estimated brand market value in the default currency USD.
8. If brand/model is found, provide a estimated brand value multiplier (e.g., 1.2x, 1.5x) in reasoning.
9. If brand/model is found, and give a confidence rating (0–1) for the brand valuation.
10. If no brand/model is found, set brand value multiplier to 1x with 0 confidence.
11. Default currency is USD.
12. Return JSON only.
Format:
{
  "category": "one of the categories",
  "confidence": number between 0 and 1,
  "estimatedVariance": {"min": number, "max": number},
  "reasoning": "brief explanation",
  "estimatedWeightGrams": number,
  "estimatedPurity": integer from [10,14,16,18,20,21,22,24],
  "brand": "brand name or 'unknown'",
  "model": "model name or 'unknown'",
  "estimatedBrandMarketValue": number or null,
  "brandValueMultiplier": number (e.g., 1.0, 1.2),
  "brandValuationConfidence": number between 0 and 1,
  "currency": "USD"
}
`;

		const response = await client.chat.completions.create({
			model: "gpt-4o-mini", // multimodal model
			messages: [
				{
					role: "user",
					content: [
						{ type: "text", text: prompt },
						{ type: "image_url", image_url: {url:imageBase64}}
					]
				}
			],
			temperature: 0.2,
			response_format: { type: "json_object" }
		});

		const result = JSON.parse(response.choices[0].message.content);
		console.log("✅ Classification:", result);
		res.json(result);
	} catch (err) {
		console.error("❌ Error:", err);
		res.status(500).json({ error: "Classification failed", details: err.message });
	}
});

// ---------- ROUTE: APPLY FOR LOAN ----------
app.post("/api/loan/apply", upload.single("image"), async (req, res) => {
	const connection = await pool.getConnection();
	try {
		const { walletAddress, telegramId, fullName, valuation } = req.body;
		const file = req.file;

		if (!walletAddress) {
			return res.status(400).json({ error: "Missing walletAddress" });
		}

		if (!file) {
			return res.status(400).json({ error: "Missing uploaded image" });
		}

		// ✅ Step 1: Ensure user exists or create new
		const [existingUser] = await connection.query(
			"SELECT id FROM users WHERE wallet_address = ?",
			[walletAddress]
		);

		let userId;
		if (existingUser.length > 0) {
			userId = existingUser[0].id;
			// check whether to update telegramId or fullName
			if (telegramId || fullName) {
				await connection.query(
					"UPDATE users SET telegram_id = COALESCE(?, telegram_id), full_name = COALESCE(?, full_name) WHERE id = ?",
					[telegramId || null, fullName || null, userId]
				);
			}
		} else {
			const [insertUser] = await connection.query(
				"INSERT INTO users (wallet_address, telegram_id, full_name, role) VALUES (?, ?, ?, 'customer')",
				[walletAddress, telegramId || null, fullName || null]
			);
			userId = insertUser.insertId;
		}

		// ✅ Step 2: Store pre-valuation entry
		const imagePath = path.join("items", file.filename); // relative path for DB

		const [insertPreVal] = await connection.query(
			`INSERT INTO ai_prevaluations (user_id, image_url, ai_result_json, estimated_value, confidence, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
			[userId, imagePath, valuation, null, null]
		);



		// ✅ Step 3: Create valuation on TON chain
		const hashValuation = valuation ? sha256(JSON.stringify(valuation)) : "no_hash";
		let tonAddress = null;
		try {
			tonAddress = await sendCreateValuation({
				id: insertPreVal.insertId, // use DB ID as valuation ID
				user: walletAddress,
				store: process.env.STORE_WALLET_ADDRESS, // your store’s TON wallet
				valuationHash: hashValuation,
			});

			if (tonAddress) {
				await connection.query(
					"UPDATE ai_prevaluations SET ton_address = ? WHERE id = ?",
					[tonAddress, insertPreVal.insertId]
				);
			}
		} catch (err) {
			console.error("⚠️ TON contract call failed:", err);
		}

		// ✅ Step 4: Fetch the full inserted row
		const [rows] = await connection.query(
			`SELECT * FROM ai_prevaluations WHERE id = ?`,
			[insertPreVal.insertId]
		);
		const insertedLoan = rows[0];

		res.json({
			success: true,
			message: "Loan pre-valuation created",
			user_id: userId,
			prevaluation_id: insertPreVal.insertId,
			image_url: imagePath,
			token_address: tonAddress || null,
			loan: insertedLoan, // ✅ include full record
		});
	} catch (error) {
		console.error("❌ Apply for Loan Error:", error);
		res.status(500).json({ error: "Failed to create pre-valuation", details: error.message });
	} finally {
		connection.release();
	}
});


// ---------- ROUTE: APPLY FOR LOAN (opBNB REGISTRY) ----------
app.post("/api/loan/apply-bnb", upload.single("image"), async (req, res) => {
	const connection = await pool.getConnection();
	try {
		const { walletAddress, valuation } = req.body;
		const file = req.file;

		if (!walletAddress) {
			return res.status(400).json({ error: "Missing walletAddress" });
		}
		if (!file) {
			return res.status(400).json({ error: "Missing uploaded image" });
		}
		if (!valuation) {
			return res.status(400).json({ error: "Missing valuation" });
		}

		const valuationObj = typeof valuation === "string" ? JSON.parse(valuation) : valuation;
		const estimatedValue = Number.isFinite(Number(valuationObj?.totalValue))
			? Number(valuationObj.totalValue)
			: null;
		const confidence = Number.isFinite(Number(valuationObj?.classification?.confidence))
			? Number(valuationObj.classification.confidence)
			: null;

		const [existingUser] = await connection.query(
			"SELECT id FROM users WHERE wallet_address = ?",
			[walletAddress]
		);

		let userId;
		if (existingUser.length > 0) {
			userId = existingUser[0].id;
		} else {
			const [insertUser] = await connection.query(
				"INSERT INTO users (wallet_address, type, role) VALUES (?, 'bnb', 'customer')",
				[walletAddress]
			);
			userId = insertUser.insertId;
		}

		const imagePath = path.join("items", file.filename);
		const [insertPreVal] = await connection.query(
			`INSERT INTO ai_prevaluations
				(user_id, image_url, ai_result_json, estimated_value, confidence, status)
			 VALUES (?, ?, ?, ?, ?, 'pending')`,
			[userId, imagePath, JSON.stringify(valuationObj), estimatedValue, confidence]
		);

		const prevaluationId = insertPreVal.insertId;
		const reportUri = `db://ai_prevaluations/${prevaluationId}`;

		let chainResult = null;
		try {
			chainResult = await recordValuationOnOpBnb({
				walletAddress,
				valuationObject: valuationObj,
				reportUri,
			});

			try {
				await connection.query(
					`UPDATE ai_prevaluations
					 SET
					 	bnb_address = ?,
					 	bnb_tx_hash = ?,
					 	bnb_chain_id = ?,
					 	onchain_record_id = ?,
					 	valuation_hash = ?,
					 	report_uri = ?
					 WHERE id = ?`,
					[
						chainResult.contractAddress,
						chainResult.txHash,
						5611,
						chainResult.recordId,
						chainResult.valuationHash,
						chainResult.reportUri,
						prevaluationId,
					]
				);
			} catch (schemaErr) {
				console.warn("⚠️ Extended BNB columns not available yet, saving contract address only:", schemaErr.message);
				await connection.query(
					"UPDATE ai_prevaluations SET bnb_address = ? WHERE id = ?",
					[chainResult.contractAddress, prevaluationId]
				);
			}
		} catch (chainErr) {
			console.error("⚠️ opBNB registry write failed:", chainErr);
			throw chainErr;
		}

		const [rows] = await connection.query(
			"SELECT * FROM ai_prevaluations WHERE id = ?",
			[prevaluationId]
		);

		res.json({
			success: true,
			message: "Loan pre-valuation created (opBNB)",
			user_id: userId,
			prevaluation_id: prevaluationId,
			image_url: imagePath,
			token_address: chainResult?.contractAddress || null,
			tx_hash: chainResult?.txHash || null,
			onchain_record_id: chainResult?.recordId || null,
			valuation_hash: chainResult?.valuationHash || null,
			loan: rows[0],
		});
	} catch (error) {
		console.error("❌ Apply-BNB Error:", error);
		res.status(500).json({
			error: "Failed to create valuation record on opBNB",
			details: error.message,
		});
	} finally {
		connection.release();
	}
});

// ---------- ROUTE: APPLY FOR LOAN (AVAX C-CHAIN REGISTRY) ----------
app.post("/api/loan/apply-avax", upload.single("image"), async (req, res) => {
	const connection = await pool.getConnection();
	try {
		const { walletAddress, valuation } = req.body;
		const file = req.file;

		if (!walletAddress) {
			return res.status(400).json({ error: "Missing walletAddress" });
		}
		if (!file) {
			return res.status(400).json({ error: "Missing uploaded image" });
		}
		if (!valuation) {
			return res.status(400).json({ error: "Missing valuation" });
		}

		const valuationObj = typeof valuation === "string" ? JSON.parse(valuation) : valuation;
		const estimatedValue = Number.isFinite(Number(valuationObj?.totalValue))
			? Number(valuationObj.totalValue)
			: null;
		const confidence = Number.isFinite(Number(valuationObj?.classification?.confidence))
			? Number(valuationObj.classification.confidence)
			: null;

		const [existingUser] = await connection.query(
			"SELECT id FROM users WHERE wallet_address = ?",
			[walletAddress]
		);

		let userId;
		if (existingUser.length > 0) {
			userId = existingUser[0].id;
		} else {
			const [insertUser] = await connection.query(
				"INSERT INTO users (wallet_address, type, role) VALUES (?, 'avax', 'customer')",
				[walletAddress]
			);
			userId = insertUser.insertId;
		}

		const imagePath = path.join("items", file.filename);
		const [insertPreVal] = await connection.query(
			`INSERT INTO ai_prevaluations
				(user_id, image_url, ai_result_json, estimated_value, confidence, status)
			 VALUES (?, ?, ?, ?, ?, 'pending')`,
			[userId, imagePath, JSON.stringify(valuationObj), estimatedValue, confidence]
		);

		const prevaluationId = insertPreVal.insertId;
		const reportUri = `db://ai_prevaluations/${prevaluationId}`;

		let chainResult = null;
		try {
			chainResult = await recordValuationOnAvax({
				walletAddress,
				valuationObject: valuationObj,
				reportUri,
			});

			try {
				await connection.query(
					`UPDATE ai_prevaluations
					 SET
					 	avax_address = ?,
					 	avax_tx_hash = ?,
					 	avax_chain_id = ?,
					 	onchain_record_id = ?,
					 	valuation_hash = ?,
					 	report_uri = ?
					 WHERE id = ?`,
					[
						chainResult.contractAddress,
						chainResult.txHash,
						43113,
						chainResult.recordId,
						chainResult.valuationHash,
						chainResult.reportUri,
						prevaluationId,
					]
				);
			} catch (schemaErr) {
				console.warn("⚠️ Extended AVAX columns not available yet, saving contract address only:", schemaErr.message);
				await connection.query(
					"UPDATE ai_prevaluations SET avax_address = ? WHERE id = ?",
					[chainResult.contractAddress, prevaluationId]
				);
			}
		} catch (chainErr) {
			console.error("⚠️ AVAX C-Chain registry write failed:", chainErr);
			throw chainErr;
		}

		const [rows] = await connection.query(
			"SELECT * FROM ai_prevaluations WHERE id = ?",
			[prevaluationId]
		);

		res.json({
			success: true,
			message: "Loan pre-valuation created (AVAX C-Chain)",
			user_id: userId,
			prevaluation_id: prevaluationId,
			image_url: imagePath,
			token_address: chainResult?.contractAddress || null,
			tx_hash: chainResult?.txHash || null,
			onchain_record_id: chainResult?.recordId || null,
			valuation_hash: chainResult?.valuationHash || null,
			loan: rows[0],
		});
	} catch (error) {
		console.error("❌ Apply-AVAX Error:", error);
		res.status(500).json({
			error: "Failed to create valuation record on AVAX C-Chain",
			details: error.message,
		});
	} finally {
		connection.release();
	}
});

// ---------- ROUTE: Schedule Appraisal ----------
app.post("/api/loan/schedule", async (req, res) => {
	const connection = await pool.getConnection();
	try {
		const { prevaluationId, appraisalData } = req.body;

		if (!prevaluationId || !appraisalData) {
			return res.status(400).json({ error: "Missing prevaluationId or appraisalData" });
		}

		const bookingDate = appraisalData?.date;
		const bookingSlot = appraisalData?.slot;
		const validSlots = ["morning", "afternoon", "evening"];
		if (!bookingDate || !validSlots.includes(bookingSlot)) {
			return res.status(400).json({ error: "Invalid appraisalData. Expected date and slot (morning|afternoon|evening)." });
		}

		await connection.beginTransaction();

		const [prevaluationRows] = await connection.query(
			`SELECT apv.id, apv.user_id, u.wallet_address, u.full_name, u.email, u.phone
			 FROM ai_prevaluations apv
			 JOIN users u ON u.id = apv.user_id
			 WHERE apv.id = ?
			 LIMIT 1`,
			[prevaluationId]
		);

		if (prevaluationRows.length === 0) {
			await connection.rollback();
			return res.status(404).json({ error: "Pre-valuation not found" });
		}

		const jsonData = JSON.stringify(appraisalData);
		const [result] = await connection.query(
			`UPDATE ai_prevaluations
				 SET appraiser = CAST(? AS JSON), status = 'scheduled'
				 WHERE id = ?`,
			[jsonData, prevaluationId]
		);

		if (result.affectedRows === 0) {
			await connection.rollback();
			return res.status(404).json({ error: "Pre-valuation not found" });
		}

		const jewellerIdCandidate = String(appraisalData?.jewellerId || appraisalData?.jeweller?.id || "").trim();
		const jewellerNameCandidate = String(
			appraisalData?.jeweller?.name ||
			appraisalData?.jeweller?.display_name ||
			appraisalData?.jeweller?.legal_name ||
			""
		).trim();
		let organization = null;

		if (/^\d+$/.test(jewellerIdCandidate)) {
			const [orgById] = await connection.query(
				`SELECT id, display_name, legal_name
				 FROM appraiser_organizations
				 WHERE id = ?
				 LIMIT 1`,
				[Number(jewellerIdCandidate)]
			);
			if (orgById.length > 0) {
				organization = orgById[0];
			}
		}

		if (!organization && jewellerNameCandidate) {
			const [orgByName] = await connection.query(
				`SELECT id, display_name, legal_name
				 FROM appraiser_organizations
				 WHERE display_name = ? OR legal_name = ?
				 ORDER BY id DESC
				 LIMIT 1`,
				[jewellerNameCandidate, jewellerNameCandidate]
			);
			if (orgByName.length > 0) {
				organization = orgByName[0];
			}
		}

		let persistedBooking = null;
		let bookingWarning = null;
		if (organization?.id) {
			const customer = prevaluationRows[0];
			const customerNotes = JSON.stringify({
				customer_user_id: customer.user_id,
				customer_wallet_address: customer.wallet_address || null,
				customer_name: customer.full_name || null,
				customer_email: customer.email || null,
				customer_phone: customer.phone || null,
			});

			const [existingBookingRows] = await connection.query(
				`SELECT id
				 FROM appraiser_bookings
				 WHERE prevaluation_id = ? AND organization_id = ?
				 ORDER BY id DESC
				 LIMIT 1
				 FOR UPDATE`,
				[prevaluationId, organization.id]
			);

			if (existingBookingRows.length > 0) {
				const bookingId = existingBookingRows[0].id;
				await connection.query(
					`UPDATE appraiser_bookings
					 SET booking_date = ?,
					     booking_slot = ?,
					     booking_status = 'rescheduled',
					     customer_notes = ?,
					     source_channel = 'web',
					     updated_at = NOW()
					 WHERE id = ?`,
					[bookingDate, bookingSlot, customerNotes, bookingId]
				);
				persistedBooking = {
					id: bookingId,
					organization_id: organization.id,
					booking_date: bookingDate,
					booking_slot: bookingSlot,
					booking_status: "rescheduled",
				};
			} else {
				const [insertBooking] = await connection.query(
					`INSERT INTO appraiser_bookings
					 (prevaluation_id, organization_id, booking_date, booking_slot, booking_status, customer_notes, source_channel)
					 VALUES (?, ?, ?, ?, 'confirmed', ?, 'web')`,
					[prevaluationId, organization.id, bookingDate, bookingSlot, customerNotes]
				);
				persistedBooking = {
					id: insertBooking.insertId,
					organization_id: organization.id,
					booking_date: bookingDate,
					booking_slot: bookingSlot,
					booking_status: "confirmed",
				};
			}
		} else {
			bookingWarning = "Booking was not persisted to appraiser_bookings because no verified organization could be resolved.";
		}

		const paymentReference = String(
			appraisalData?.paymentReference ||
			appraisalData?.payment_ref ||
			appraisalData?.paymentIntentId ||
			""
		).trim();
		const paymentProvider = String(appraisalData?.paymentProvider || "stripe").trim().toLowerCase();
		const paymentStatus = normalizeTransactionStatus(appraisalData?.paymentStatus);
		const paymentAmountRaw = Number(
			appraisalData?.paymentAmount ??
			appraisalData?.feeAmount ??
			appraisalData?.appraisalFee ??
			35
		);
		const paymentAmount = Number.isFinite(paymentAmountRaw) ? Number(paymentAmountRaw.toFixed(2)) : 35;
		const paymentCurrency = String(appraisalData?.paymentCurrency || appraisalData?.currency || "AED").trim().toUpperCase() || "AED";
		const providerSessionId = String(appraisalData?.providerSessionId || appraisalData?.sessionId || "").trim() || null;
		const providerPaymentIntentId = String(appraisalData?.providerPaymentIntentId || appraisalData?.paymentIntentId || "").trim() || null;
		const shouldRecordPaymentTx = paymentReference || paymentStatus !== "pending";

		if (shouldRecordPaymentTx) {
			const customer = prevaluationRows[0];
			const existingTxParams = [customer.user_id, prevaluationId, "appraisal_fee"];
			let existingTxSql = `SELECT id FROM customer_transactions WHERE user_id = ? AND prevaluation_id = ? AND transaction_type = ?`;
			if (paymentReference) {
				existingTxSql += " AND payment_provider = ? AND provider_reference = ? ORDER BY id DESC LIMIT 1 FOR UPDATE";
				existingTxParams.push(paymentProvider, paymentReference);
			} else {
				existingTxSql += " AND provider_reference IS NULL ORDER BY id DESC LIMIT 1 FOR UPDATE";
			}

			const [existingTxRows] = await connection.query(existingTxSql, existingTxParams);
			const txMetadata = {
				booking_id: persistedBooking?.id || null,
				source: "appraisal_schedule",
				raw_payment_status: appraisalData?.paymentStatus || null,
				raw_payload: {
					slot: appraisalData?.slot || null,
					date: appraisalData?.date || null,
					time: appraisalData?.time || null,
				},
			};

			if (existingTxRows.length > 0) {
				await connection.query(
					`UPDATE customer_transactions
					 SET booking_id = ?,
					     status = ?,
					     amount = ?,
					     currency = ?,
					     provider_session_id = ?,
					     provider_payment_intent_id = ?,
					     metadata_json = CAST(? AS JSON),
					     occurred_at = CASE WHEN ? = 'paid' THEN NOW() ELSE occurred_at END,
					     updated_at = NOW()
					 WHERE id = ?`,
					[
						persistedBooking?.id || null,
						paymentStatus,
						paymentAmount,
						paymentCurrency,
						providerSessionId,
						providerPaymentIntentId,
						JSON.stringify(txMetadata),
						paymentStatus,
						existingTxRows[0].id,
					]
				);
			} else {
				await connection.query(
					`INSERT INTO customer_transactions
					 (user_id, prevaluation_id, booking_id, transaction_type, direction, status, amount, currency,
					  payment_provider, provider_reference, provider_session_id, provider_payment_intent_id, metadata_json, source_channel, occurred_at)
					 VALUES (?, ?, ?, 'appraisal_fee', 'debit', ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), 'mobile', ?)`,
					[
						customer.user_id,
						prevaluationId,
						persistedBooking?.id || null,
						paymentStatus,
						paymentAmount,
						paymentCurrency,
						paymentProvider || null,
						paymentReference || null,
						providerSessionId,
						providerPaymentIntentId,
						JSON.stringify(txMetadata),
						paymentStatus === "paid" ? new Date() : null,
					]
				);
			}
		}

		// ✅ Fetch the updated record to return to frontend
		const [rows] = await connection.query(
			`SELECT * FROM ai_prevaluations WHERE id = ?`,
			[prevaluationId]
		);

		const updatedLoan = rows[0];
		await connection.commit();

		res.json({
			success: true,
			message: "Appraisal scheduled",
			loan: updatedLoan,
			booking: persistedBooking,
			booking_warning: bookingWarning,
		});
	} catch (error) {
		await connection.rollback();
		console.error("❌ Schedule Appraisal Error:", error);
		res.status(500).json({ error: "Failed to schedule appraisal", details: error.message });
	} finally {
		connection.release();
	}
}
);

// ---------- ROUTE: Admin upsert customer transaction ----------
app.post("/api/transactions/upsert", async (req, res) => {
	const connection = await pool.getConnection();
	try {
		await requireDhahabyAdmin(req);

		const {
			user_id,
			wallet_address,
			prevaluation_id = null,
			booking_id = null,
			transaction_type = "other",
			direction = "debit",
			status = "pending",
			amount = 0,
			currency = "AED",
			payment_provider = null,
			provider_reference = null,
			provider_session_id = null,
			provider_payment_intent_id = null,
			metadata = {},
			source_channel = "api",
			occurred_at = null,
		} = req.body || {};

		const safeType = String(transaction_type || "other").toLowerCase();
		const safeDirection = String(direction || "debit").toLowerCase();
		const safeStatus = normalizeTransactionStatus(status);
		const safeCurrency = String(currency || "AED").trim().toUpperCase();
		const safeSource = ["web", "mobile", "api", "system"].includes(String(source_channel || "").toLowerCase())
			? String(source_channel).toLowerCase()
			: "api";
		const safeAmount = Number(amount);
		if (!Number.isFinite(safeAmount)) {
			return res.status(400).json({ error: "Invalid amount" });
		}

		const allowedTypes = new Set(["appraisal_fee", "token_transfer", "token_mint", "token_sale", "token_buy", "other"]);
		if (!allowedTypes.has(safeType)) {
			return res.status(400).json({ error: "Invalid transaction_type" });
		}
		if (!["debit", "credit"].includes(safeDirection)) {
			return res.status(400).json({ error: "Invalid direction" });
		}

		let resolvedUserId = Number(user_id);
		if (!Number.isInteger(resolvedUserId) || resolvedUserId <= 0) {
			const wallet = String(wallet_address || "").trim().toLowerCase();
			if (!wallet) {
				return res.status(400).json({ error: "Provide user_id or wallet_address" });
			}
			const [userRows] = await connection.query(
				"SELECT id FROM users WHERE LOWER(wallet_address) = ? LIMIT 1",
				[wallet]
			);
			if (userRows.length === 0) {
				return res.status(404).json({ error: "User not found by wallet_address" });
			}
			resolvedUserId = Number(userRows[0].id);
		}

		const provider = payment_provider ? String(payment_provider).trim().toLowerCase() : null;
		const providerRef = provider_reference ? String(provider_reference).trim() : null;
		const sessionId = provider_session_id ? String(provider_session_id).trim() : null;
		const paymentIntentId = provider_payment_intent_id ? String(provider_payment_intent_id).trim() : null;

		let existingId = null;
		if (provider && providerRef) {
			const [existingRows] = await connection.query(
				`SELECT id
				 FROM customer_transactions
				 WHERE payment_provider = ? AND provider_reference = ?
				 LIMIT 1
				 FOR UPDATE`,
				[provider, providerRef]
			);
			existingId = existingRows[0]?.id || null;
		}

		if (existingId) {
			await connection.query(
				`UPDATE customer_transactions
				 SET user_id = ?,
				     prevaluation_id = ?,
				     booking_id = ?,
				     transaction_type = ?,
				     direction = ?,
				     status = ?,
				     amount = ?,
				     currency = ?,
				     provider_session_id = ?,
				     provider_payment_intent_id = ?,
				     metadata_json = CAST(? AS JSON),
				     source_channel = ?,
				     occurred_at = ?,
				     updated_at = NOW()
				 WHERE id = ?`,
				[
					resolvedUserId,
					prevaluation_id || null,
					booking_id || null,
					safeType,
					safeDirection,
					safeStatus,
					Number(safeAmount.toFixed(2)),
					safeCurrency,
					sessionId,
					paymentIntentId,
					JSON.stringify(metadata || {}),
					safeSource,
					occurred_at || null,
					existingId,
				]
			);
			return res.json({ success: true, id: existingId, updated: true });
		}

		const [insertResult] = await connection.query(
			`INSERT INTO customer_transactions
			 (user_id, prevaluation_id, booking_id, transaction_type, direction, status, amount, currency,
			  payment_provider, provider_reference, provider_session_id, provider_payment_intent_id,
			  metadata_json, source_channel, occurred_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?)`,
			[
				resolvedUserId,
				prevaluation_id || null,
				booking_id || null,
				safeType,
				safeDirection,
				safeStatus,
				Number(safeAmount.toFixed(2)),
				safeCurrency,
				provider,
				providerRef,
				sessionId,
				paymentIntentId,
				JSON.stringify(metadata || {}),
				safeSource,
				occurred_at || null,
			]
		);

		return res.json({ success: true, id: insertResult.insertId, created: true });
	} catch (error) {
		const statusCode = Number(error?.status || 500);
		console.error("❌ Transaction upsert error:", error);
		return res.status(statusCode).json({ error: "Failed to upsert transaction", details: error.message });
	} finally {
		connection.release();
	}
});

// ---------- ROUTE: Request transaction email OTP ----------
app.post("/api/transactions/request-email-otp", async (req, res) => {
	const connection = await pool.getConnection();
	try {
		const email = normalizeEmail(req.body?.email);
		if (!isValidEmail(email)) {
			return res.status(400).json({ error: "Invalid email" });
		}

		const [userRows] = await connection.query(
			"SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1",
			[email]
		);
		if (userRows.length === 0) {
			return res.json({ success: true, message: "If this email exists, a verification code has been sent." });
		}

		const [recentRows] = await connection.query(
			`SELECT id, created_at
			 FROM transaction_email_otps
			 WHERE email = ?
			   AND created_at >= (NOW() - INTERVAL ? SECOND)
			 ORDER BY id DESC
			 LIMIT 1`,
			[email, OTP_MIN_RESEND_SECONDS]
		);
		if (recentRows.length > 0) {
			return res.status(429).json({ error: "Please wait before requesting another code." });
		}

		const [dailyRows] = await connection.query(
			`SELECT COUNT(*) AS count
			 FROM transaction_email_otps
			 WHERE email = ?
			   AND created_at >= (NOW() - INTERVAL 1 DAY)`,
			[email]
		);
		if (Number(dailyRows[0]?.count || 0) >= OTP_DAILY_LIMIT) {
			return res.status(429).json({ error: "Daily OTP request limit reached." });
		}

		const otpCode = createOtpCode();
		const codeHash = hashOtp(email, otpCode);
		const requestIp = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").slice(0, 63) || null;
		const userAgent = String(req.headers["user-agent"] || "").slice(0, 255) || null;

		await connection.query(
			`INSERT INTO transaction_email_otps
			 (email, code_hash, expires_at, max_attempts, request_ip, user_agent)
			 VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), 5, ?, ?)`,
			[email, codeHash, OTP_TTL_MINUTES, requestIp, userAgent]
		);

		const sendResult = await sendTransactionOtpEmail({ toEmail: email, otpCode });
		return res.json({
			success: true,
			message: "Verification code sent.",
			preview_otp: sendResult.previewOtp || undefined,
		});
	} catch (error) {
		console.error("❌ request-email-otp error:", error);
		return res.status(500).json({ error: "Failed to send verification code", details: error.message });
	} finally {
		connection.release();
	}
});

// ---------- ROUTE: Lookup transactions by email + OTP ----------
app.post("/api/transactions/lookup-by-email", async (req, res) => {
	const connection = await pool.getConnection();
	try {
		const email = normalizeEmail(req.body?.email);
		const otp = String(req.body?.otp || "").trim();
		const typeFilter = String(req.body?.type || "").trim().toLowerCase();
		const statusFilter = String(req.body?.status || "").trim().toLowerCase();
		const page = Math.max(Number(req.body?.page) || 1, 1);
		const limit = Math.min(Math.max(Number(req.body?.limit) || 20, 1), 100);
		const offset = (page - 1) * limit;

		if (!isValidEmail(email) || !/^\d{6}$/.test(otp)) {
			return res.status(400).json({ error: "Invalid email or OTP format." });
		}

		await connection.beginTransaction();
		const [otpRows] = await connection.query(
			`SELECT id, code_hash, expires_at, consumed_at, attempts, max_attempts
			 FROM transaction_email_otps
			 WHERE email = ?
			 ORDER BY id DESC
			 LIMIT 1
			 FOR UPDATE`,
			[email]
		);
		if (otpRows.length === 0) {
			await connection.rollback();
			return res.status(401).json({ error: "Invalid or expired code." });
		}
		const otpRow = otpRows[0];
		if (otpRow.consumed_at) {
			await connection.rollback();
			return res.status(401).json({ error: "Code already used. Please request a new one." });
		}
		if (new Date(otpRow.expires_at).getTime() < Date.now()) {
			await connection.rollback();
			return res.status(401).json({ error: "Code expired. Please request a new one." });
		}
		if (Number(otpRow.attempts) >= Number(otpRow.max_attempts || 5)) {
			await connection.rollback();
			return res.status(429).json({ error: "Too many attempts. Please request a new code." });
		}

		const incomingHash = hashOtp(email, otp);
		if (incomingHash !== otpRow.code_hash) {
			await connection.query(
				"UPDATE transaction_email_otps SET attempts = attempts + 1, updated_at = NOW() WHERE id = ?",
				[otpRow.id]
			);
			await connection.commit();
			return res.status(401).json({ error: "Invalid code." });
		}

		await connection.query(
			"UPDATE transaction_email_otps SET consumed_at = NOW(), attempts = attempts + 1, updated_at = NOW() WHERE id = ?",
			[otpRow.id]
		);

		const [users] = await connection.query(
			`SELECT id, wallet_address, full_name, email, phone
			 FROM users
			 WHERE LOWER(email) = ?`,
			[email]
		);
		if (users.length === 0) {
			await connection.commit();
			return res.json({ success: true, page, limit, total: 0, user: { email }, transactions: [] });
		}

		let total = 0;
		const allTransactions = [];
		for (const user of users) {
			// eslint-disable-next-line no-await-in-loop
			const result = await fetchTransactionsByUserId(connection, user.id, { typeFilter, statusFilter, limit: 1000, offset: 0 });
			total += result.total;
			result.rows.forEach((row) => {
				allTransactions.push({
					...row,
					_lookup_user: {
						id: user.id,
						wallet_address: user.wallet_address || null,
						full_name: user.full_name || null,
						email: user.email || null,
						phone: user.phone || null,
					},
				});
			});
		}

		allTransactions.sort((a, b) => {
			const ta = new Date(a.created_at).getTime();
			const tb = new Date(b.created_at).getTime();
			return tb - ta || Number(b.id) - Number(a.id);
		});
		const paged = allTransactions.slice(offset, offset + limit);
		const transactions = paged.map((row) => ({
			id: row.id,
			user_id: row.user_id,
			prevaluation_id: row.prevaluation_id,
			booking_id: row.booking_id,
			transaction_type: row.transaction_type,
			direction: row.direction,
			status: row.status,
			amount: Number(row.amount || 0),
			currency: row.currency,
			payment_provider: row.payment_provider,
			provider_reference: row.provider_reference,
			provider_session_id: row.provider_session_id,
			provider_payment_intent_id: row.provider_payment_intent_id,
			source_channel: row.source_channel,
			occurred_at: row.occurred_at,
			created_at: row.created_at,
			updated_at: row.updated_at,
			image_url: row.image_url || null,
			booking_date: row.booking_date || null,
			booking_slot: row.booking_slot || null,
			metadata: parseJsonObjectLoose(row.metadata_json),
			user: row._lookup_user,
		}));

		await connection.commit();
		return res.json({
			success: true,
			page,
			limit,
			total: allTransactions.length,
			user: { email },
			transactions,
		});
	} catch (error) {
		await connection.rollback();
		console.error("❌ lookup-by-email error:", error);
		return res.status(500).json({ error: "Failed to lookup transactions by email", details: error.message });
	} finally {
		connection.release();
	}
});

// ---------- ROUTE: Customer notifications ----------
app.get("/api/notifications", async (req, res) => {
	const connection = await pool.getConnection();
	try {
		const idToken = getBearerToken(req);
		if (!idToken) {
			return res.status(401).json({ error: "Missing bearer token" });
		}
		const decodedToken = await verifyFirebaseIdToken(idToken);
		const user = await resolveCustomerUserFromToken(connection, decodedToken);
		if (!user?.id) {
			return res.json({ success: true, notifications: [] });
		}

		const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
		const notifications = [];

		notifications.push({
			id: `welcome-${user.id}`,
			title: "Welcome to Dhahaby!",
			message: "Your account has been successfully created. Start exploring our gold loan services today.",
			group: "Recent",
			notification_type: "welcome",
			is_read: false,
			created_at: user.created_at || new Date().toISOString(),
		});

		const [txRows] = await connection.query(
			`SELECT id, transaction_type, status, amount, currency, created_at
			 FROM customer_transactions
			 WHERE user_id = ?
			 ORDER BY created_at DESC
			 LIMIT ?`,
			[user.id, limit]
		);

		txRows.forEach((tx) => {
			const created = new Date(tx.created_at);
			const ageDays = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
			const group = ageDays <= 0 ? "Recent" : ageDays <= 7 ? "7 days" : "Earlier";
			let title = "Transaction Update";
			let message = `Your ${tx.transaction_type} transaction is ${tx.status}.`;

			if (tx.transaction_type === "appraisal_fee" && tx.status === "paid") {
				title = "Appraisal Fee Received";
				message = `Payment of ${tx.currency} ${Number(tx.amount || 0).toFixed(2)} was received successfully.`;
			} else if (tx.transaction_type === "appraisal_fee" && tx.status === "failed") {
				title = "Payment Failed";
				message = `Your appraisal fee payment of ${tx.currency} ${Number(tx.amount || 0).toFixed(2)} failed. Please try again.`;
			}

			notifications.push({
				id: `tx-${tx.id}`,
				title,
				message,
				group,
				notification_type: tx.transaction_type,
				is_read: false,
				created_at: tx.created_at,
			});
		});

		return res.json({
			success: true,
			notifications: notifications.slice(0, limit),
		});
	} catch (error) {
		console.error("❌ Notifications list error:", error);
		return res.status(500).json({ error: "Failed to fetch notifications", details: error.message });
	} finally {
		connection.release();
	}
});

// ---------- ROUTE: Customer transactions ----------
app.get("/api/transactions", async (req, res) => {
	const connection = await pool.getConnection();
	try {
		const typeFilter = String(req.query.type || "").trim().toLowerCase();
		const statusFilter = String(req.query.status || "").trim().toLowerCase();
		const emailFilter = normalizeEmail(req.query.email || "");
		const walletAddressFilter = String(req.query.wallet_address || req.query.walletAddress || "").trim().toLowerCase();
		const explicitUserId = Number(req.query.user_id || req.query.userId);
		const { page, limit, offset } = parsePagingParams(req, { defaultLimit: 20, maxLimit: 100 });

		const resolvedUsers = new Map();
		const ensureUser = (u) => {
			if (!u?.id) return;
			if (!resolvedUsers.has(u.id)) resolvedUsers.set(u.id, u);
		};

		const idToken = getBearerToken(req);
		if (idToken) {
			try {
				const decodedToken = await verifyFirebaseIdToken(idToken);
				const byToken = await resolveCustomerUserFromToken(connection, decodedToken);
				ensureUser(byToken);
			} catch (error) {
				return res.status(401).json({ error: "Invalid bearer token", details: error.message });
			}
		}

		if (Number.isInteger(explicitUserId) && explicitUserId > 0) {
			const [rows] = await connection.query(
				`SELECT id, wallet_address, full_name, email, phone
				 FROM users
				 WHERE id = ?
				 LIMIT 1`,
				[explicitUserId]
			);
			if (rows.length > 0) ensureUser(rows[0]);
		}

		if (walletAddressFilter) {
			const [rows] = await connection.query(
				`SELECT id, wallet_address, full_name, email, phone
				 FROM users
				 WHERE LOWER(wallet_address) = ?
				 LIMIT 1`,
				[walletAddressFilter]
			);
			if (rows.length > 0) ensureUser(rows[0]);
		}

		if (emailFilter && isValidEmail(emailFilter)) {
			const [rows] = await connection.query(
				`SELECT id, wallet_address, full_name, email, phone
				 FROM users
				 WHERE LOWER(email) = ?`,
				[emailFilter]
			);
			rows.forEach((row) => ensureUser(row));
		}

		const userIds = Array.from(resolvedUsers.keys());
		if (userIds.length === 0) {
			return res.status(400).json({ error: "Unable to resolve user. Provide bearer token, user_id, wallet_address, or email." });
		}

		let allRows = [];
		for (const uid of userIds) {
			// eslint-disable-next-line no-await-in-loop
			const result = await fetchTransactionsByUserId(connection, uid, { typeFilter, statusFilter, limit: 1000, offset: 0 });
			allRows = allRows.concat(result.rows);
		}
		allRows.sort((a, b) => {
			const ta = new Date(a.created_at).getTime();
			const tb = new Date(b.created_at).getTime();
			return tb - ta || Number(b.id) - Number(a.id);
		});

		const total = allRows.length;
		const rows = allRows.slice(offset, offset + limit);

		const transactions = rows.map((row) => ({
			id: row.id,
			user_id: row.user_id,
			prevaluation_id: row.prevaluation_id,
			booking_id: row.booking_id,
			transaction_type: row.transaction_type,
			direction: row.direction,
			status: row.status,
			amount: Number(row.amount || 0),
			currency: row.currency,
			payment_provider: row.payment_provider,
			provider_reference: row.provider_reference,
			provider_session_id: row.provider_session_id,
			provider_payment_intent_id: row.provider_payment_intent_id,
			source_channel: row.source_channel,
			occurred_at: row.occurred_at,
			created_at: row.created_at,
			updated_at: row.updated_at,
			image_url: row.image_url || null,
			booking_date: row.booking_date || null,
			booking_slot: row.booking_slot || null,
			metadata: parseJsonObjectLoose(row.metadata_json),
		}));

		return res.json({
			success: true,
			page,
			limit,
			total,
			user: userIds.length === 1
				? {
					id: resolvedUsers.get(userIds[0])?.id || userIds[0],
					wallet_address: resolvedUsers.get(userIds[0])?.wallet_address || null,
					full_name: resolvedUsers.get(userIds[0])?.full_name || null,
					email: resolvedUsers.get(userIds[0])?.email || null,
					phone: resolvedUsers.get(userIds[0])?.phone || null,
				}
				: {
					multi: true,
					users: userIds.map((uid) => ({
						id: resolvedUsers.get(uid)?.id || uid,
						wallet_address: resolvedUsers.get(uid)?.wallet_address || null,
						full_name: resolvedUsers.get(uid)?.full_name || null,
						email: resolvedUsers.get(uid)?.email || null,
						phone: resolvedUsers.get(uid)?.phone || null,
					})),
				},
			transactions,
		});
	} catch (error) {
		console.error("❌ Transactions list error:", error);
		return res.status(500).json({ error: "Failed to fetch transactions", details: error.message });
	} finally {
		connection.release();
	}
});

// ---------- ROUTES: Legal policies CMS ----------
app.get("/api/legal-policies", async (req, res) => {
	const connection = await pool.getConnection();
	try {
		const includeInactive = String(req.query.include_inactive || "").trim() === "1";
		const whereSql = includeInactive ? "" : "WHERE is_active = 1";
		const [rows] = await connection.query(
			`SELECT policy_slug, title, header_title, document_title, effective_date, last_updated_date, display_order, is_active, updated_at
			 FROM legal_policies
			 ${whereSql}
			 ORDER BY display_order ASC, id ASC`
		);
		return res.json({
			success: true,
			policies: rows.map((row) => ({
				policy_slug: row.policy_slug,
				title: row.title,
				header_title: row.header_title || row.title,
				document_title: row.document_title || row.title,
				effective_date: row.effective_date || null,
				last_updated_date: row.last_updated_date || null,
				display_order: Number(row.display_order || 0),
				is_active: Number(row.is_active) === 1,
				updated_at: row.updated_at,
			})),
		});
	} catch (error) {
		console.error("❌ Legal policies list error:", error);
		return res.status(500).json({ error: "Failed to fetch legal policies", details: error.message });
	} finally {
		connection.release();
	}
});

app.get("/api/legal-policies/:slug", async (req, res) => {
	const connection = await pool.getConnection();
	try {
		const slug = String(req.params.slug || "").trim().toLowerCase();
		if (!slug) return res.status(400).json({ error: "Missing policy slug." });
		const includeInactive = String(req.query.include_inactive || "").trim() === "1";
		const [rows] = await connection.query(
			`SELECT policy_slug, title, header_title, document_title, body, effective_date, last_updated_date, display_order, is_active, updated_at
			 FROM legal_policies
			 WHERE policy_slug = ?
			 LIMIT 1`,
			[slug]
		);
		if (!rows.length) return res.status(404).json({ error: "Legal policy not found." });
		const row = rows[0];
		if (!includeInactive && Number(row.is_active) !== 1) return res.status(404).json({ error: "Legal policy not found." });
		return res.json({
			success: true,
			policy: {
				policy_slug: row.policy_slug,
				title: row.title,
				header_title: row.header_title || row.title,
				document_title: row.document_title || row.title,
				body: row.body || "",
				effective_date: row.effective_date || null,
				last_updated_date: row.last_updated_date || null,
				display_order: Number(row.display_order || 0),
				is_active: Number(row.is_active) === 1,
				updated_at: row.updated_at,
			},
		});
	} catch (error) {
		console.error("❌ Legal policy details error:", error);
		return res.status(500).json({ error: "Failed to fetch legal policy", details: error.message });
	} finally {
		connection.release();
	}
});

app.put("/api/legal-policies/:slug", async (req, res) => {
	const connection = await pool.getConnection();
	try {
		const adminKey = String(process.env.LEGAL_POLICIES_ADMIN_KEY || "").trim();
		const suppliedKey = String(req.headers["x-legal-admin-key"] || "").trim();
		if (!adminKey || suppliedKey !== adminKey) {
			return res.status(403).json({ error: "Forbidden" });
		}

		const slug = String(req.params.slug || "").trim().toLowerCase();
		if (!slug) return res.status(400).json({ error: "Missing policy slug." });

		const title = String(req.body?.title || "").trim();
		const headerTitle = String(req.body?.header_title || "").trim();
		const documentTitle = String(req.body?.document_title || "").trim();
		const body = String(req.body?.body || "").trim();
		const effectiveDate = req.body?.effective_date ? String(req.body.effective_date).trim() : null;
		const lastUpdatedDate = req.body?.last_updated_date ? String(req.body.last_updated_date).trim() : null;
		const displayOrder = Number.isFinite(Number(req.body?.display_order)) ? Number(req.body.display_order) : 1000;
		const isActive = req.body?.is_active === false || req.body?.is_active === 0 ? 0 : 1;

		if (!title) return res.status(400).json({ error: "Title is required." });
		if (!body) return res.status(400).json({ error: "Body is required." });

		await connection.query(
			`INSERT INTO legal_policies (
				policy_slug, title, header_title, document_title, body, effective_date, last_updated_date, display_order, is_active
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE
				title = VALUES(title),
				header_title = VALUES(header_title),
				document_title = VALUES(document_title),
				body = VALUES(body),
				effective_date = VALUES(effective_date),
				last_updated_date = VALUES(last_updated_date),
				display_order = VALUES(display_order),
				is_active = VALUES(is_active),
				updated_at = CURRENT_TIMESTAMP`,
			[
				slug,
				title,
				headerTitle || title,
				documentTitle || title,
				body,
				effectiveDate,
				lastUpdatedDate,
				displayOrder,
				isActive,
			]
		);

		const [rows] = await connection.query(
			`SELECT policy_slug, title, header_title, document_title, body, effective_date, last_updated_date, display_order, is_active, updated_at
			 FROM legal_policies
			 WHERE policy_slug = ?
			 LIMIT 1`,
			[slug]
		);
		return res.json({ success: true, policy: rows[0] || null });
	} catch (error) {
		console.error("❌ Legal policy upsert error:", error);
		return res.status(500).json({ error: "Failed to save legal policy", details: error.message });
	} finally {
		connection.release();
	}
});

// ---------- ROUTE: Verified jewellers list ----------
app.get("/api/appraiser/verified-jewellers", async (req, res) => {
	const connection = await pool.getConnection();
	try {
		const [rows] = await connection.query(
			`SELECT id, display_name, legal_name, email, phone, country_code, website_url, metadata_json
			 FROM appraiser_organizations
			 WHERE verification_status = 'approved'
			 ORDER BY display_name ASC`
		);

			const jewellers = rows.map((row) => {
				const metadata = parseJsonObjectLoose(row.metadata_json);
			return {
				id: row.id,
				display_name: row.display_name,
				legal_name: row.legal_name,
				email: row.email,
				phone: row.phone,
				country_code: row.country_code,
				website_url: row.website_url,
				metadata_json: metadata,
			};
		});

		res.json({ success: true, jewellers });
	} catch (error) {
		console.error("❌ Verified Jewellers Error:", error);
		res.status(500).json({ error: "Failed to load verified jewellers", details: error.message });
	} finally {
		connection.release();
	}
});

// ---------- ROUTE: Appraiser bookings (organization scoped) ----------
app.get("/api/appraiser/bookings", async (req, res) => {
	const connection = await pool.getConnection();
	try {
		const idToken = getBearerToken(req);
		if (!idToken) {
			return res.status(401).json({ error: "Missing bearer token" });
		}

		const decodedToken = await verifyFirebaseIdToken(idToken);
		const context = await resolveAppraiserContext(connection, decodedToken);
		if (!context) {
			return res.status(404).json({ error: "Appraiser profile not found. Please sync first." });
		}

		const requestedStatuses = String(req.query.status || "")
			.split(",")
			.map((item) => item.trim())
			.filter(Boolean);
		const allowedStatuses = new Set(["requested", "confirmed", "rescheduled", "completed", "cancelled", "no_show"]);
		const statusFilter = requestedStatuses.filter((status) => allowedStatuses.has(status));
		const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 250);

		const whereStatusSql = statusFilter.length
			? ` AND ab.booking_status IN (${statusFilter.map(() => "?").join(",")})`
			: "";

			const [rows] = await connection.query(
				`SELECT ab.id, ab.prevaluation_id, ab.organization_id, ab.booking_date, ab.booking_slot, ab.booking_status,
				        ab.customer_notes, ab.internal_notes, ab.source_channel, ab.created_at, ab.updated_at,
				        apv.status AS prevaluation_status, apv.appraiser, apv.estimated_value, apv.confidence,
				        apv.bnb_tx_hash, apv.bnb_address, apv.avax_tx_hash, apv.avax_address,
				        CASE
				        	WHEN apv.avax_tx_hash IS NOT NULL OR apv.avax_address IS NOT NULL THEN 'avax'
				        	WHEN apv.bnb_tx_hash IS NOT NULL OR apv.bnb_address IS NOT NULL THEN 'bnb'
				        	ELSE NULL
				        END AS valuation_chain_key,
				        u.id AS customer_user_id, u.wallet_address AS customer_wallet_address, u.full_name AS customer_full_name,
				        u.email AS customer_email, u.phone AS customer_phone,
				        ao.display_name AS organization_name, ao.legal_name AS organization_legal_name,
				        nft.id AS nft_issuance_id, nft.status AS nft_issuance_status, nft.chain_key AS nft_chain_key,
				        nft.token_standard AS nft_token_standard, nft.contract_address AS nft_contract_address,
				        nft.token_id AS nft_token_id, nft.tx_hash AS nft_tx_hash, nft.metadata_uri AS nft_metadata_uri,
				        nft.owner_wallet_address AS nft_owner_wallet_address, nft.failure_reason AS nft_failure_reason,
				        nft.minted_at AS nft_minted_at, nft.updated_at AS nft_updated_at,
				        nft.retry_count AS nft_retry_count, nft.max_retries AS nft_max_retries
				 FROM appraiser_bookings ab
				 JOIN ai_prevaluations apv ON apv.id = ab.prevaluation_id
				 LEFT JOIN users u ON u.id = apv.user_id
				 JOIN appraiser_organizations ao ON ao.id = ab.organization_id
				 LEFT JOIN nft_issuances nft
				   ON nft.id = (
				     SELECT ni2.id
				     FROM nft_issuances ni2
				     WHERE ni2.prevaluation_id = ab.prevaluation_id
				     ORDER BY ni2.id DESC
				     LIMIT 1
				   )
				 WHERE ab.organization_id = ?${whereStatusSql}
				 ORDER BY ab.id DESC
				 LIMIT ?`,
				[context.user.organization_id, ...statusFilter, limit]
		);

		const bookings = rows.map((row) => {
			const customerNotes = parseJsonObject(row.customer_notes);
			const jeweller = resolveJewellerFromPayload(row.appraiser);
				return {
					...row,
					customer_notes: customerNotes,
					jeweller_name: jeweller.jewellerName || row.organization_name || row.organization_legal_name || "",
					jeweller_address: jeweller.jewellerAddress || "",
					jeweller_contact: jeweller.jewellerContact || "",
					nft_issuance: normalizeNftIssuance(row),
				};
			});

		return res.json({
			success: true,
			bookings,
			organization_id: context.user.organization_id,
		});
	} catch (error) {
		console.error("❌ Appraiser Bookings Error:", error);
		return res.status(500).json({ error: "Failed to fetch appraiser bookings", details: error.message });
	} finally {
		connection.release();
	}
});

// ---------- ROUTE: Mark booking as reviewed (organization scoped) ----------
app.post("/api/appraiser/bookings/:bookingId/review", async (req, res) => {
	const connection = await pool.getConnection();
	let transactionStarted = false;
	try {
		const idToken = getBearerToken(req);
		if (!idToken) {
			return res.status(401).json({ error: "Missing bearer token" });
		}

		const decodedToken = await verifyFirebaseIdToken(idToken);
		const context = await resolveAppraiserContext(connection, decodedToken);
		if (!context) {
			return res.status(404).json({ error: "Appraiser profile not found. Please sync first." });
		}

		const bookingId = Number(req.params.bookingId);
		if (!Number.isInteger(bookingId) || bookingId <= 0) {
			return res.status(400).json({ error: "Invalid bookingId" });
		}

		const requestedPrevaluationId = Number(req.body?.prevaluation_id);
		if (req.body?.prevaluation_id !== undefined && (!Number.isInteger(requestedPrevaluationId) || requestedPrevaluationId <= 0)) {
			return res.status(400).json({ error: "Invalid prevaluation_id" });
		}

		const reviewNotes = String(req.body?.review_notes || "").trim();
		const reviewDocReference = req.body?.review_doc_reference ? String(req.body.review_doc_reference).trim() : "";
		if (!reviewNotes) {
			return res.status(400).json({ error: "review_notes is required" });
		}

		await connection.beginTransaction();
		transactionStarted = true;

		const [bookingRows] = await connection.query(
			`SELECT id, prevaluation_id, organization_id, booking_status
			 FROM appraiser_bookings
			 WHERE id = ? AND organization_id = ?
			 LIMIT 1
			 FOR UPDATE`,
			[bookingId, context.user.organization_id]
		);

		if (bookingRows.length === 0) {
			await connection.rollback();
			transactionStarted = false;
			return res.status(404).json({ error: "Booking not found for your organization" });
		}

		const booking = bookingRows[0];
		if (requestedPrevaluationId && booking.prevaluation_id !== requestedPrevaluationId) {
			await connection.rollback();
			transactionStarted = false;
			return res.status(400).json({ error: "Booking/prevaluation mismatch" });
		}

		const [prevaluationRows] = await connection.query(
			`SELECT id, status
			 FROM ai_prevaluations
			 WHERE id = ?
			 LIMIT 1
			 FOR UPDATE`,
			[booking.prevaluation_id]
		);

		if (prevaluationRows.length === 0) {
			await connection.rollback();
			transactionStarted = false;
			return res.status(404).json({ error: "Pre-valuation not found" });
		}

		const currentPrevaluationStatus = String(prevaluationRows[0].status || "").toLowerCase();
		if (currentPrevaluationStatus === "discarded" || currentPrevaluationStatus === "converted") {
			await connection.rollback();
			transactionStarted = false;
			return res.status(409).json({
				error: `Pre-valuation is already finalized as '${currentPrevaluationStatus}'`,
			});
		}

		const internalNotesPayload = reviewDocReference
			? `${reviewNotes}\n\nDoc Ref: ${reviewDocReference}`
			: reviewNotes;

		await connection.query(
			`UPDATE appraiser_bookings
			 SET booking_status = 'completed',
			     internal_notes = ?,
			     completed_at = NOW(),
			     updated_at = NOW()
			 WHERE id = ?`,
			[internalNotesPayload, bookingId]
		);

		await connection.query(
			`UPDATE ai_prevaluations
			 SET status = 'reviewed'
			 WHERE id = ?`,
			[booking.prevaluation_id]
		);

		await connection.commit();
		transactionStarted = false;
		return res.json({
			success: true,
			booking_id: bookingId,
			prevaluation_id: booking.prevaluation_id,
			booking_status: "completed",
			prevaluation_status: "reviewed",
		});
	} catch (error) {
		if (transactionStarted) {
			await connection.rollback();
		}
		console.error("❌ Appraiser Booking Review Error:", error);
		return res.status(500).json({ error: "Failed to mark booking as reviewed", details: error.message });
	} finally {
		connection.release();
	}
});

// ---------- ROUTE: Discard booking asset (organization scoped) ----------
app.post("/api/appraiser/bookings/:bookingId/discard", async (req, res) => {
	const connection = await pool.getConnection();
	let transactionStarted = false;
	try {
		const idToken = getBearerToken(req);
		if (!idToken) {
			return res.status(401).json({ error: "Missing bearer token" });
		}

		const decodedToken = await verifyFirebaseIdToken(idToken);
		const context = await resolveAppraiserContext(connection, decodedToken);
		if (!context) {
			return res.status(404).json({ error: "Appraiser profile not found. Please sync first." });
		}

		const bookingId = Number(req.params.bookingId);
		if (!Number.isInteger(bookingId) || bookingId <= 0) {
			return res.status(400).json({ error: "Invalid bookingId" });
		}

		const requestedPrevaluationId = Number(req.body?.prevaluation_id);
		if (req.body?.prevaluation_id !== undefined && (!Number.isInteger(requestedPrevaluationId) || requestedPrevaluationId <= 0)) {
			return res.status(400).json({ error: "Invalid prevaluation_id" });
		}

		const discardReason = String(req.body?.discard_reason || "").trim();
		const discardDocReference = req.body?.discard_doc_reference ? String(req.body.discard_doc_reference).trim() : "";
		if (!discardReason) {
			return res.status(400).json({ error: "discard_reason is required" });
		}

		await connection.beginTransaction();
		transactionStarted = true;

		const [bookingRows] = await connection.query(
			`SELECT id, prevaluation_id, organization_id
			 FROM appraiser_bookings
			 WHERE id = ? AND organization_id = ?
			 LIMIT 1
			 FOR UPDATE`,
			[bookingId, context.user.organization_id]
		);

		if (bookingRows.length === 0) {
			await connection.rollback();
			transactionStarted = false;
			return res.status(404).json({ error: "Booking not found for your organization" });
		}

		const booking = bookingRows[0];
		if (requestedPrevaluationId && booking.prevaluation_id !== requestedPrevaluationId) {
			await connection.rollback();
			transactionStarted = false;
			return res.status(400).json({ error: "Booking/prevaluation mismatch" });
		}

		const [prevaluationRows] = await connection.query(
			`SELECT id, status
			 FROM ai_prevaluations
			 WHERE id = ?
			 LIMIT 1
			 FOR UPDATE`,
			[booking.prevaluation_id]
		);

		if (prevaluationRows.length === 0) {
			await connection.rollback();
			transactionStarted = false;
			return res.status(404).json({ error: "Pre-valuation not found" });
		}

		const currentPrevaluationStatus = String(prevaluationRows[0].status || "").toLowerCase();
		if (currentPrevaluationStatus === "discarded" || currentPrevaluationStatus === "converted") {
			await connection.rollback();
			transactionStarted = false;
			return res.status(409).json({
				error: `Pre-valuation is already finalized as '${currentPrevaluationStatus}'`,
			});
		}

		const internalNotesPayload = discardDocReference
			? `Discard Reason: ${discardReason}\n\nDoc Ref: ${discardDocReference}`
			: `Discard Reason: ${discardReason}`;

		await connection.query(
			`UPDATE appraiser_bookings
			 SET booking_status = 'cancelled',
			     internal_notes = ?,
			     cancelled_at = NOW(),
			     updated_at = NOW()
			 WHERE id = ?`,
			[internalNotesPayload, bookingId]
		);

		await connection.query(
			`UPDATE ai_prevaluations
			 SET status = 'discarded'
			 WHERE id = ?`,
			[booking.prevaluation_id]
		);

		await connection.commit();
		transactionStarted = false;
		return res.json({
			success: true,
			booking_id: bookingId,
			prevaluation_id: booking.prevaluation_id,
			booking_status: "cancelled",
			prevaluation_status: "discarded",
		});
	} catch (error) {
		if (transactionStarted) {
			await connection.rollback();
		}
		console.error("❌ Appraiser Booking Discard Error:", error);
		return res.status(500).json({ error: "Failed to discard booking", details: error.message });
	} finally {
		connection.release();
	}
});

// ---------- ROUTE: GET ALL PRE-VALUATIONS for WALLET ----------
app.get("/api/prevaluations/:walletAddress", async (req, res) => {
	try {
		const { walletAddress } = req.params;

			const [rows] = await pool.query(
				`SELECT apv.id, apv.image_url, apv.ai_result_json, apv.estimated_value, apv.confidence, apv.status, apv.created_at, apv.ton_address, apv.sol_address, apv.bnb_address, apv.bnb_tx_hash, apv.bnb_chain_id, apv.avax_address, apv.avax_tx_hash, apv.avax_chain_id, apv.onchain_record_id, apv.valuation_hash, apv.report_uri, apv.appraiser,
				        nft.id AS nft_issuance_id, nft.status AS nft_issuance_status, nft.chain_key AS nft_chain_key,
				        nft.token_standard AS nft_token_standard, nft.contract_address AS nft_contract_address,
				        nft.token_id AS nft_token_id, nft.tx_hash AS nft_tx_hash, nft.metadata_uri AS nft_metadata_uri,
				        nft.owner_wallet_address AS nft_owner_wallet_address, nft.failure_reason AS nft_failure_reason,
				        nft.minted_at AS nft_minted_at, nft.updated_at AS nft_updated_at,
				        nft.retry_count AS nft_retry_count, nft.max_retries AS nft_max_retries
				 FROM ai_prevaluations apv
				 JOIN users u ON apv.user_id = u.id
				 LEFT JOIN nft_issuances nft
				   ON nft.id = (
				     SELECT ni2.id
				     FROM nft_issuances ni2
				     WHERE ni2.prevaluation_id = apv.id
				     ORDER BY ni2.id DESC
				     LIMIT 1
				   )
				 WHERE u.wallet_address = ?
				 ORDER BY apv.created_at DESC`,
				[walletAddress]
			);

			res.json({
				prevaluations: rows.map((row) => ({
					...row,
					nft_issuance: normalizeNftIssuance(row),
				})),
			});
	} catch (error) {
		console.error("❌ Get Pre-Valuations Error:", error);
		res.status(500).json({ error: "Failed to fetch pre-valuations", details: error.message });
	}
});

// ---------- ROUTE: REMOVE PRE-VALUATION by ID ----------
app.delete("/api/prevaluation/:id", async (req, res) => {
	try {
		const { id } = req.params;

		// First, get the image URL to delete the file
		const [rows] = await pool.query(
			"SELECT image_url FROM ai_prevaluations WHERE id = ?",
			[id]
		);

		if (rows.length === 0) {
			return res.status(404).json({ error: "Pre-valuation not found" });
		}

		const imageUrl = rows[0].image_url;

		// Delete the pre-valuation record
		await pool.query(
			"DELETE FROM ai_prevaluations WHERE id = ?",
			[id]
		);

		// Delete the image file
		const imagePath = path.join(".", imageUrl);
		if (fs.existsSync(imagePath)) {
			fs.unlinkSync(imagePath);
		}

		res.json({ success: true, message: "Pre-valuation deleted" });
	} catch (error) {
		console.error("❌ Delete Pre-Valuation Error:", error);
		res.status(500).json({ error: "Failed to delete pre-valuation", details: error.message });
	}
});

// ---------- ROUTE: Add user to Waitlist ----------
app.post("/api/waitlist/add", async (req, res) => {
	const connection = await pool.getConnection();
	try {
		const { email, interest_type, source, user_id, country_code } = req.body;

		// ✅ Basic Validation
		if (!email || !interest_type) {
			return res.status(400).json({ error: "Missing email or interest_type" });
		}

		// ✅ Default Source
		const src = source || "telegram";

		// ✅ Insert or update if exists
		const [result] = await connection.query(
			`INSERT INTO waitlist (email, interest_type, source, user_id, country_code)
			 VALUES (?, ?, ?, ?, ?)
			 ON DUPLICATE KEY UPDATE
			 updated_at = CURRENT_TIMESTAMP`,
			[email, interest_type, src, user_id || null, country_code || null]
		);

		res.json({
			success: true,
			message: "User added to waitlist",
			email,
			interest_type,
			source: src,
			result,
		});
	} catch (error) {
		console.error("❌ Add Waitlist Error:", error);
		res.status(500).json({ error: "Failed to add to waitlist", details: error.message });
	} finally {
		connection.release();
	}
});

// ---------- ROUTE: Track User Events ----------
app.post("/api/track", async (req, res) => {
	const connection = await pool.getConnection();
	try {
		const { user_id, wallet_address, event_name, event_data, source } = req.body;

		if (!event_name) {
			return res.status(400).json({ error: "Missing event_name" });
		}

		await connection.query(
			`INSERT INTO user_events (user_id, wallet_address, event_name, event_data, source)
			 VALUES (?, ?, ?, CAST(? AS JSON), ?)`,
			[
				user_id || null,
				wallet_address || null,
				event_name,
				JSON.stringify(event_data || {}),
				source || "telegram",
			]
		);

		res.json({ success: true, message: "Event tracked" });
	} catch (error) {
		console.error("❌ Track Event Error:", error);
		res.status(500).json({ error: "Failed to track event", details: error.message });
	} finally {
		connection.release();
	}
});

// ---------- ROUTE: APPLY FOR LOAN (SOLANA VERSION - PURE SOLANA) ----------
app.post("/api/loan/apply-solana", upload.single("image"), async (req, res) => {
	const connection = await pool.getConnection();

	try {
		const { walletAddress, valuation } = req.body;
		const file = req.file;

		if (!walletAddress) {
			return res.status(400).json({ error: "Missing walletAddress" });
		}
		if (!file) {
			return res.status(400).json({ error: "Missing uploaded image" });
		}

		// ----------------------------------
		// 1. Ensure user exists
		// ----------------------------------
		const [existingUser] = await connection.query(
			"SELECT id FROM users WHERE wallet_address = ?",
			[walletAddress]
		);

		let userId;
		if (existingUser.length > 0) {
			userId = existingUser[0].id;
		} else {
			const [insertUser] = await connection.query(
				"INSERT INTO users (wallet_address, type, role) VALUES (?, 'solana', 'customer')",
				[walletAddress]
			);
			userId = insertUser.insertId;
		}

		// ----------------------------------
		// 2. Store pre-valuation in DB
		// ----------------------------------
		const imagePath = path.join("items", file.filename);
		const imageUrl = `https://dhahaby-api.topy.ai/${imagePath}`;

		const [insertPreVal] = await connection.query(
			`INSERT INTO ai_prevaluations 
                (user_id, image_url, ai_result_json, estimated_value, confidence, status)
             VALUES (?, ?, ?, ?, ?, 'pending')`,
			[userId, imagePath, valuation, null, null]
		);

		const valuationObj = JSON.parse(valuation);

		// ----------------------------------
		// 3. Create local METADATA JSON
		// ----------------------------------
		const metadataDir = "./metadata";
		if (!fs.existsSync(metadataDir)) fs.mkdirSync(metadataDir);

		const metadata = {
			name: `Dhahaby Gold Asset #${insertPreVal.insertId}`,
			symbol: "DHA",
			description: "Digitised gold jewellery asset on Solana",
			image: imageUrl,
			attributes: [
				{ trait_type: "Weight", value: valuationObj.weight },
				{ trait_type: "Purity", value: valuationObj.purity },
				{ trait_type: "Estimated Value", value: valuationObj.totalValue },
				{ trait_type: "Currency", value: valuationObj.currency },
			]
		};

		const metadataFile = `metadata-${insertPreVal.insertId}.json`;
		const metadataPath = path.join(metadataDir, metadataFile);
		fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

		const metadataUri = `https://dhahaby-api.topy.ai/metadata/${metadataFile}`;

		// ----------------------------------
		// 4. MINT NFT (PURE SOLANA)
		// ----------------------------------

// ----------------------------------
// 4. SIMPLE PURE SOLANA NFT MINT
// ----------------------------------
		let nftMintAddress = null;

		try {
			const connectionSol = new Connection("https://api.devnet.solana.com", "confirmed");

			// server wallet
			const payer = Keypair.fromSecretKey(
				new Uint8Array(JSON.parse(process.env.MINT_SECRET_KEY))
			);

			// 1) Create mint (0 decimals)
			const mint = await createMint(
				connectionSol,
				payer,
				payer.publicKey,
				null,
				0
			);

			console.log("✅ Created mint:", mint);

			// 2) Create ATA for user
			const owner = new PublicKey(walletAddress);
			const userTokenAccount = await getOrCreateAssociatedTokenAccount(
				connectionSol,
				payer,
				mint,
				owner
			);
			console.log("✅ User token account:", userTokenAccount.address);
			// 3) Mint 1 token to the user
			await mintTo(
				connectionSol,
				payer,
				mint,
				userTokenAccount.address,
				payer,
				1
			);

			nftMintAddress = mint.toBase58();
			console.log("✅ Minted NFT to user:", nftMintAddress);

			await connection.query(
				"UPDATE ai_prevaluations SET sol_address = ? WHERE id = ?",
				[nftMintAddress, insertPreVal.insertId]
			);

		} catch (err) {
			console.error("❌ SPL Mint Error:", err);
		}


		// ----------------------------------
		// 5. Return result
		// ----------------------------------
		const [rows] = await connection.query(
			"SELECT * FROM ai_prevaluations WHERE id = ?",
			[insertPreVal.insertId]
		);

		res.json({
			success: true,
			message: "Loan pre-valuation & NFT created (Solana)",
			user_id: userId,
			prevaluation_id: insertPreVal.insertId,
			image_url: imagePath,
			token_address: nftMintAddress,
			loan: rows[0],
		});

	} catch (error) {
		console.error("❌ Apply-Solana Error:", error);
		res.status(500).json({
			error: "Failed to mint NFT on Solana",
			details: error.message,
		});
	} finally {
		connection.release();
	}
});



// ---------- ROUTE: GET GOLD PRICE (IG) WITH CURRENCY CONVERSION ----------
app.get("/api/XAU/:currency", async (req, res) => {
	const targetCurrency = String(req.params.currency || "").toUpperCase();
	const nowMs = Date.now();
	const cached = igGoldCache.get(targetCurrency);
	const allowedCurrencies = ["USD", "AED", "GBP", "EUR", "INR"];
	try {
		if (cached && isValidGoldPayload(cached.payload) && nowMs - cached.fetchedAt < IG_CACHE_TTL_MS) {
			return res.json(cached.payload);
		}

		const epic = IG_GOLD_EPIC;
		if (!epic) {
			return res.status(400).json({
				error: "Missing IG epic",
				details: "Set IG_GOLD_EPIC in the server .env",
			});
		}

		const data = await fetchIgMarket(epic);
		const snapshot = data.snapshot || {};
		const priceLadder = Array.isArray(snapshot.priceLadder) ? snapshot.priceLadder : [];
			let rawBid = toNumberOrNull(snapshot.bid ?? priceLadder[0]?.bid ?? null);
			let rawOffer = toNumberOrNull(snapshot.offer ?? priceLadder[0]?.ask ?? priceLadder[0]?.offer ?? null);
			const rawHigh = toNumberOrNull(snapshot.high ?? null);
			const rawLow = toNumberOrNull(snapshot.low ?? null);
			const rawNetChange = toNumberOrNull(snapshot.netChange ?? null);
			const rawPctChange = toNumberOrNull(snapshot.percentageChange ?? null);
		const instrument = data.instrument || {};
		const currencies = Array.isArray(instrument.currencies) ? instrument.currencies : [];
			if (!allowedCurrencies.includes(targetCurrency)) {
				return res.status(400).json({
					error: "Unsupported currency",
				details: `Supported: ${allowedCurrencies.join(", ")}`,
			});
		}

			const rawOpen = toNumberOrNull(snapshot.open ?? snapshot.openPrice ?? null);
			const rawClose = toNumberOrNull(snapshot.close ?? snapshot.closePrice ?? snapshot.last ?? null);
			// IG can return one-sided/empty quotes off-market; derive a usable reference price.
			if (rawBid === null && rawOffer === null && rawHigh !== null && rawLow !== null) {
				rawBid = rawLow;
				rawOffer = rawHigh;
			}
			if (rawBid === null && rawOffer !== null) rawBid = rawOffer;
			if (rawOffer === null && rawBid !== null) rawOffer = rawBid;

			const rawReferencePrice =
				(rawBid !== null && rawOffer !== null)
					? (rawBid + rawOffer) / 2
					: (rawHigh !== null && rawLow !== null)
						? (rawHigh + rawLow) / 2
						: rawClose ?? rawOpen ?? rawHigh ?? rawLow ?? rawBid ?? rawOffer;
			if (rawReferencePrice === null) {
				throw new Error(`IG market snapshot missing usable price fields for epic ${epic}`);
			}

		const usdBid = rawBid;
		const usdOffer = rawOffer;
		const usdHigh = rawHigh;
		const usdLow = rawLow;
		const usdNetChange = rawNetChange;
		const usdPctChange = rawPctChange;

			let bid = usdBid;
			let offer = usdOffer;
			let referencePrice = rawReferencePrice;
			let high = usdHigh;
			let low = usdLow;
			let netChange = usdNetChange;
			let pctChange = usdPctChange;
		let fxEpic = null;
		if (targetCurrency === "USD") {
			bid = usdBid;
			offer = usdOffer;
			} else if (targetCurrency === "AED") {
				const usdAedRate = 3.67;
				bid = usdBid * usdAedRate;
				offer = usdOffer * usdAedRate;
				referencePrice = referencePrice * usdAedRate;
				high = usdHigh === null ? null : usdHigh * usdAedRate;
				low = usdLow === null ? null : usdLow * usdAedRate;
				netChange = usdNetChange === null ? null : usdNetChange * usdAedRate;
			} else if (targetCurrency === "INR") {
				const fx = await getUsdInrRate();
				bid = usdBid * fx.bid;
				offer = usdOffer * fx.offer;
				referencePrice = referencePrice * ((fx.bid + fx.offer) / 2);
				high = usdHigh === null ? null : usdHigh * fx.bid;
				low = usdLow === null ? null : usdLow * fx.bid;
				netChange = usdNetChange === null ? null : usdNetChange * fx.bid;
				fxEpic = fx.epic;
		} else {
			const targetInfo = currencies.find(
				(currency) => String(currency.code || "").toUpperCase() === targetCurrency
			);
			const usdInfo = currencies.find(
				(currency) => String(currency.code || "").toUpperCase() === "USD"
			);
				const targetBaseRate = toNumberOrNull(targetInfo?.baseExchangeRate);
				const usdBaseRate = toNumberOrNull(usdInfo?.baseExchangeRate);
				if (!targetInfo || toNumberOrNull(targetInfo.exchangeRate) === null) {
					return res.status(400).json({
						error: "Unsupported currency for this market",
						details: `IG does not provide ${targetCurrency} in currencies list for epic ${epic}`,
					});
				}
				if (!usdInfo || usdBaseRate === null) {
					return res.status(400).json({
						error: "USD conversion unavailable for this market",
						details: `IG does not provide USD baseExchangeRate for epic ${epic}`,
					});
				}
				if (targetBaseRate === null) {
					return res.status(400).json({
						error: "Unsupported currency for this market",
						details: `IG does not provide baseExchangeRate for ${targetCurrency} on epic ${epic}`,
					});
				}

				const ratio = targetBaseRate / usdBaseRate;
				bid = usdBid * ratio;
				offer = usdOffer * ratio;
				referencePrice = referencePrice * ratio;
				high = usdHigh === null ? null : usdHigh * ratio;
				low = usdLow === null ? null : usdLow * ratio;
				netChange = usdNetChange === null ? null : usdNetChange * ratio;
			}

			const price =
				bid !== null && offer !== null ? (Number(bid) + Number(offer)) / 2 : referencePrice;
		const gramsPerOunce = 31.1034768;
		const pricePerGram24k = price === null ? null : price / gramsPerOunce;
		const pricePerGram = (karat) =>
			pricePerGram24k === null ? null : pricePerGram24k * (karat / 24);
		const nowTs = Math.floor(Date.now() / 1000);

		const payload = {
			timestamp: nowTs,
			metal: "XAU",
			currency: targetCurrency,
			exchange: "IG.COM",
			symbol: epic,
			prev_close_price: null,
			open_price: null,
			low_price: low,
			high_price: high,
			open_time: null,
			price,
			ch: netChange,
				chp: pctChange,
				ask: offer,
				bid,
				has_live_bid_offer: bid !== null && offer !== null,
				price_gram_24k: pricePerGram24k,
			price_gram_22k: pricePerGram(22),
			price_gram_21k: pricePerGram(21),
			price_gram_20k: pricePerGram(20),
			price_gram_18k: pricePerGram(18),
			price_gram_16k: pricePerGram(16),
			price_gram_14k: pricePerGram(14),
			price_gram_10k: pricePerGram(10),
		};

			let removedFallbackCache = false;
			for (const [currency, entry] of igGoldCache.entries()) {
				if (entry?.source === "goldapi") {
					igGoldCache.delete(currency);
					removedFallbackCache = true;
				}
			}
			if (removedFallbackCache) {
				persistIgGoldCacheToDisk();
			}
			upsertGoldCacheEntry(targetCurrency, payload, "ig");
			persistIgGoldCacheToDisk();
			res.json(payload);
	} catch (error) {
		console.error("❌ IG Gold Price Error:", error);
		if (cached && isValidGoldPayload(cached.payload) && nowMs - cached.fetchedAt < IG_STALE_CACHE_MAX_AGE_MS) {
			const staleAgeSeconds = Math.floor((nowMs - cached.fetchedAt) / 1000);
			return res.json({
				...cached.payload,
				stale: true,
				stale_age_seconds: staleAgeSeconds,
				stale_reason: "Live IG quote unavailable; serving last cached quote.",
			});
		}
		try {
			const fallbackResults = await Promise.allSettled(
				allowedCurrencies.map(async (currency) => {
					const payload = await fetchGoldApiCurrency(currency);
					upsertGoldCacheEntry(currency, payload, "goldapi");
					return { currency, payload };
				})
			);
			persistIgGoldCacheToDisk();
			const fallbackEntry = igGoldCache.get(targetCurrency);
			if (fallbackEntry && isValidGoldPayload(fallbackEntry.payload)) {
				return res.json({
					...fallbackEntry.payload,
					stale: true,
					stale_reason: "IG unavailable; served from goldapi fallback cache.",
				});
			}
			const fallbackError = fallbackResults
				.filter((result) => result.status === "rejected")
				.map((result) => result.reason?.message || String(result.reason))
				.join(" | ");
			return res.status(502).json({
				error: "Failed to fetch gold price from IG and goldapi fallback",
				details: fallbackError || error.message,
			});
		} catch (fallbackErr) {
			return res.status(502).json({
				error: "Failed to fetch IG gold price",
				details: `${error.message} | fallback: ${fallbackErr.message}`,
			});
		}
	}
});

// ---------- HEALTH CHECK ----------
app.get("/", (req, res) => {
	res.send("Dhahaby AI API is running ✅");
});

// ---------- DATABASE HEALTH CHECK ----------
app.get("/api/db-health", async (req, res) => {
	try {
		const [rows] = await pool.query("SELECT NOW() AS time");
		res.json({ connected: true, time: rows[0].time });
	} catch (error) {
		console.error("DB connection failed:", error);
		res.status(500).json({ connected: false, error: error.message });
	}
});

app.listen(port, () => console.log(`🚀 Dhahaby API running on port ${port}`));
