import React, { useState } from "react";

export default function ComingSoonModal({ open, onClose, popupType, userid }) {
	const [email, setEmail] = useState("");
	const [joined, setJoined] = useState(false);

	if (!open) return null;

	const modalContent = {
		loan: {
			title: "Coming Soon",
			message:
				"We’re almost ready to unlock gold-backed loans through our licensed partners. Leave your email below to get early access when offers go live.",
			thankYou:
				"You’re on the list! We’ll notify you as soon as gold-backed loan offers become available.",
			image: "/being_rich.svg",
		},
		credit: {
			title: "Gold-Backed Credit Coming Soon",
			message:
				"Our gold-backed Mastercard is launching soon. Be first to apply and get exclusive early-access updates.",
			thankYou:
				"Thanks for joining! You’ll be first in line when our gold-backed card opens for applications.",
			image: "/card.svg",
		},
		sell: {
			title: "Instant Cash Feature Coming Soon",
			message:
				"We’re finalising instant liquidation and cash-out options. Enter your email to get notified as soon as they launch.",
			thankYou:
				"Got it! We’ll notify you when instant cash and liquidation options go live.",
			image: "/money_safe.svg",
		},
	};

	const { title, message, thankYou } = modalContent[popupType] || modalContent.loan;

	const handleJoin = async () => {
		if (!email.trim()) {
			alert("Please enter your email.");
			return;
		}

		try {
			// Prepare payload
			const payload = {
				email,
				interest_type: popupType,         // loan | credit | sell
				source: "telegram",               // current source
				user_id: userid,
				country_code: ""                // optional — static or detect dynamically later
			};

			const res = await fetch("https://dhahaby-api.topy.ai/api/waitlist/add", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			const data = await res.json();

			if (data.success) {
				console.log("✅ Added to waitlist:", data);
				setJoined(true);
			} else {
				console.warn("⚠️ Waitlist error:", data.error);
				setJoined(true);
			}
		} catch (err) {
			console.error("❌ Waitlist Request Error:", err);
			setJoined(true);
		}
	};

	return (
		<div
			className="fixed inset-0 z-[60] flex items-center justify-center bg-opacity-90 backdrop-blur-sm"
			onClick={onClose}
		>
			<div
				className="bg-white rounded-2xl p-6 w-11/12 max-w-xs text-center shadow-2xl shadow-gray-300 transition-all duration-300"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Title */}
				<h2 className="text-base font-semibold text-gray-900 mb-3">{title}</h2>
				<hr className="mb-4" />

				{!joined ? (
					<>
						{/* Message */}
						<p className="text-sm text-gray-600 mb-4 leading-relaxed">{message}</p>

						{/* Label */}
						<label
							htmlFor="email"
							className="block text-left text-sm font-medium text-gray-700 mb-1"
						>
							Email
						</label>
						{/* Input */}
						<input
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="Enter your email address"
							className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#E4A824] outline-none mb-4"
						/>

						{/* Join Button */}
						<button
							onClick={handleJoin}
							className="w-full py-2.5 text-white font-medium rounded-full mb-3 transition-transform hover:scale-[1.02]"
							style={{
								backgroundColor: "#E4A824",
								borderRadius: "45px",
							}}
						>
							Join Waitlist
						</button>

						{/* Cancel Button */}
						<button
							onClick={onClose}
							className="w-full text-sm font-medium text-gray-500 hover:text-gray-700"
							style={{
								borderRadius: "45px",
								color: "#E4A824",
							}}
						>
							Cancel
						</button>
					</>
				) : (
					<>
						{/* Thank You Message */}
						<p className="text-sm text-gray-700 leading-relaxed">{thankYou}</p>
						{/* Image SVG from image like "/xxx.svg" */}
						<img
							src={modalContent[popupType]?.image || "/being_rich.svg"}
							alt="Thank You"
							className="w-60 h-60 mx-auto mb-4"
						/>

						{/* Continue Button */}
						<button
							onClick={
								() => {
									setJoined(false);
									onClose();
								}
							}
							className="w-full py-2.5 text-white font-medium rounded-full transition-transform hover:scale-[1.02]"
							style={{
								backgroundColor: "#E4A824",
								borderRadius: "45px",
							}}
						>
							Continue
						</button>
					</>
				)}
			</div>
		</div>
	);
}
