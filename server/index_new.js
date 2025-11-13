/**
 * Dhahaby API Server
 * -------------------
 * Provides backend endpoints for user management, gold classification,
 * AI-driven valuation, and loan workflows integrated with TON blockchain.
 */

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import multer from "multer";
import sha256 from "sha256";
import OpenAI from "openai";
import pool from "./components/db.js";
import { itemCategories } from "./itemCategories.js";
import { sendCreateValuation } from "./components/tonClient.js";

// ---------- Environment Setup ----------
dotenv.config();
const app = express();
const port = process.env.PORT || 3002;

// ---------- Middleware ----------
app.use(cors({ origin: "*" }));
app.use(bodyParser.json({ limit: "10mb" }));
app.use("/items", express.static("items"));

// ---------- AI Client ----------
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------- File Upload Config ----------
const UPLOAD_DIR = "./items";
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const storage = multer.diskStorage({
	destination: (_, __, cb) => cb(null, UPLOAD_DIR),
	filename: (_, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage });

// ---------- Helper: Async Error Wrapper ----------
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------- ROUTES ----------

/**
 * @route POST /api/user/create
 * @desc Create a new user by Telegram ID
 */
app.post("/api/user/create", asyncHandler(async (req, res) => {
	const { telegramId, fullName } = req.body;
	const [user] = await pool.query("SELECT id FROM users WHERE telegram_id = ?", [telegramId]);

	if (user.length > 0) return res.status(400).json({ error: "User already exists" });

	const [result] = await pool.query(
		"INSERT INTO users (telegram_id, full_name, role) VALUES (?, ?, 'customer')",
		[telegramId, fullName]
	);
	res.json({ success: true, user_id: result.insertId });
}));

/**
 * @route GET /api/user/:telegramId
 * @desc Fetch user details by Telegram ID
 */
app.get("/api/user/:telegramId", asyncHandler(async (req, res) => {
	const { telegramId } = req.params;
	const [rows] = await pool.query(
		"SELECT id, wallet_address, telegram_id, full_name, role, created_at, intro FROM users WHERE telegram_id = ?",
		[telegramId]
	);
	if (rows.length === 0) return res.status(404).json({ error: "User not found" });
	res.json({ user: rows[0] });
}));

/**
 * @route PUT /api/user/:telegramId/intro
 * @desc Update user intro field
 */
app.put("/api/user/:telegramId/intro", asyncHandler(async (req, res) => {
	const { telegramId } = req.params;
	const { intro } = req.body;

	const [result] = await pool.query("UPDATE users SET intro = ? WHERE telegram_id = ?", [intro, telegramId]);
	if (result.affectedRows === 0) return res.status(404).json({ error: "User not found" });

	res.json({ success: true, message: "Intro updated" });
}));

/**
 * @route POST /api/classify
 * @desc Classify uploaded gold item image using OpenAI Vision
 */
app.post("/api/classify", asyncHandler(async (req, res) => {
	const { imageBase64 } = req.body;
	if (!imageBase64) return res.status(400).json({ error: "Missing imageBase64" });

	const prompt = `
You are an expert jewellery assessor and gold item classifier.
Classify the item image into one of: ${JSON.stringify(itemCategories, null, 2)}.
Return JSON format only.`;

	const response = await openai.chat.completions.create({
		model: "gpt-4o-mini",
		messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: imageBase64 } }] }],
		temperature: 0.2,
		response_format: { type: "json_object" }
	});

	const result = JSON.parse(response.choices[0].message.content);
	res.json(result);
}));

/**
 * @route POST /api/loan/apply
 * @desc Apply for a gold-backed loan (uploads image + valuation)
 */
app.post("/api/loan/apply", upload.single("image"), asyncHandler(async (req, res) => {
	const { walletAddress, telegramId, fullName, valuation } = req.body;
	const file = req.file;
	if (!walletAddress) return res.status(400).json({ error: "Missing walletAddress" });
	if (!file) return res.status(400).json({ error: "Missing uploaded image" });

	const conn = await pool.getConnection();
	try {
		// Ensure user exists or create
		const [user] = await conn.query("SELECT id FROM users WHERE wallet_address = ?", [walletAddress]);
		let userId = user.length ? user[0].id : (await conn.query(
			"INSERT INTO users (wallet_address, telegram_id, full_name, role) VALUES (?, ?, ?, 'customer')",
			[walletAddress, telegramId, fullName]
		))[0].insertId;

		// Store pre-valuation
		const imagePath = path.join("items", file.filename);
		const [insert] = await conn.query(
			"INSERT INTO ai_prevaluations (user_id, image_url, ai_result_json, estimated_value, confidence, status) VALUES (?, ?, ?, ?, ?, 'pending')",
			[userId, imagePath, valuation, null, null]
		);

		// Send valuation to TON blockchain
		const hashVal = valuation ? sha256(JSON.stringify(valuation)) : "no_hash";
		let tonAddress = null;
		try {
			tonAddress = await sendCreateValuation({
				id: insert.insertId,
				user: walletAddress,
				store: process.env.STORE_WALLET_ADDRESS,
				valuationHash: hashVal,
			});
			if (tonAddress)
				await conn.query("UPDATE ai_prevaluations SET ton_address = ? WHERE id = ?", [tonAddress, insert.insertId]);
		} catch (err) {
			console.warn("⚠️ TON contract call failed:", err);
		}

		const [rows] = await conn.query("SELECT * FROM ai_prevaluations WHERE id = ?", [insert.insertId]);
		res.json({ success: true, prevaluation: rows[0], ton_address: tonAddress });
	} finally {
		conn.release();
	}
}));

/**
 * @route POST /api/loan/schedule
 * @desc Schedule an appraisal session
 */
app.post("/api/loan/schedule", asyncHandler(async (req, res) => {
	const { prevaluationId, appraisalData } = req.body;
	if (!prevaluationId || !appraisalData)
		return res.status(400).json({ error: "Missing prevaluationId or appraisalData" });

	await pool.query(
		"UPDATE ai_prevaluations SET appraiser = CAST(? AS JSON), status = 'scheduled' WHERE id = ?",
		[JSON.stringify(appraisalData), prevaluationId]
	);
	const [rows] = await pool.query("SELECT * FROM ai_prevaluations WHERE id = ?", [prevaluationId]);
	res.json({ success: true, loan: rows[0] });
}));

/**
 * @route POST /api/waitlist/add
 * @desc Add user to early access waitlist
 */
app.post("/api/waitlist/add", asyncHandler(async (req, res) => {
	const { email, interest_type, source = "telegram", user_id, country_code } = req.body;
	if (!email || !interest_type) return res.status(400).json({ error: "Missing email or interest_type" });

	await pool.query(
		`INSERT INTO waitlist (email, interest_type, source, user_id, country_code)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
		[email, interest_type, source, user_id || null, country_code || null]
	);
	res.json({ success: true, message: "User added to waitlist" });
}));

/**
 * @route POST /api/track
 * @desc Track frontend user events (usage analytics)
 */
app.post("/api/track", asyncHandler(async (req, res) => {
	const { user_id, wallet_address, event_name, event_data, source = "telegram" } = req.body;
	if (!event_name) return res.status(400).json({ error: "Missing event_name" });

	await pool.query(
		`INSERT INTO user_events (user_id, wallet_address, event_name, event_data, source)
     VALUES (?, ?, ?, CAST(? AS JSON), ?)`,
		[user_id, wallet_address, event_name, JSON.stringify(event_data || {}), source]
	);
	res.json({ success: true, message: "Event tracked" });
}));

/**
 * @route GET /
 * @desc API Health Check
 */
app.get("/", (_, res) => res.send("Dhahaby AI API is running ✅"));

/**
 * @route GET /api/db-health
 * @desc Database Connection Health Check
 */
app.get("/api/db-health", asyncHandler(async (_, res) => {
	const [rows] = await pool.query("SELECT NOW() AS time");
	res.json({ connected: true, time: rows[0].time });
}));

// ---------- Global Error Handler ----------
app.use((err, req, res, _next) => {
	console.error("❌ Server Error:", err);
	res.status(500).json({ error: err.message || "Internal Server Error" });
});

// ---------- Start Server ----------
app.listen(port, () => console.log(`🚀 Dhahaby API running on port ${port}`));
