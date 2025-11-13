import React, {useState, useRef, useEffect} from 'react'
import {useTonAddress, useTonConnectUI} from "@tonconnect/ui-react";
import WebApp from '@twa-dev/sdk';
import { Buffer } from 'buffer';
import {Address, beginCell, toNano} from "ton-core";
import ScheduleAppraiserModal from "./ScheduleAppraiserModal.jsx";

export default function UploadSection({setActiveTab}) {
	const [image, setImage] = useState(null)
	const [imageBase64, setImageBase64] = useState(null)
	const [showModal, setShowModal] = useState(false)
	const [weight, setWeight] = useState('')
	const [purity, setPurity] = useState('24')
	const [currency, setCurrency] = useState('USD')
	const [valuation, setValuation] = useState(null)
	const [loading, setLoading] = useState(false)
	const userAddress = useTonAddress();
	const [tc] = useTonConnectUI();
	const [showVerify, setShowVerify] = useState(null); // track which loan's verify is shown
	const [selectedLoan, setSelectedLoan] = useState(null); // for verification modal
	const [showScheduledInfo, setShowScheduledInfo] = useState(null); // Show scheduled info modal

	// Detect wallet connection and auto-continue if pending
	useEffect(() => {
		if (userAddress && applyingLoan === false && showSuccessModal === false) {
			// If user just connected after clicking "Create Token"
			if (localStorage.getItem("pendingCreateToken") === "true") {
				console.log("✅ Wallet connected — continuing token creation...");
				localStorage.removeItem("pendingCreateToken");
				applyLoan(); // resume automatically
			}
		}
	}, [userAddress]);

	const weightRef = useRef(null);
	const [applyingLoan, setApplyingLoan] = useState(false);
	const [showSuccessModal, setShowSuccessModal] = useState(false);
	const [createdToken, setCreatedToken] = useState("");

	const handleImageUpload = (e) => {
		const file = e.target.files[0];
		if (file) {
			// For preview
			setImage(URL.createObjectURL(file));

			// For base64 conversion
			const reader = new FileReader();
			reader.onloadend = () => {
				setImageBase64(reader.result);
				console.log(
					'✅ Image Base64 set: ' + reader.result.substring(0, 50) + '...'
				);
			};
			reader.readAsDataURL(file); // 👈 this actually starts the read
		}
	};


	const onEstimate = async () => {
		if (!weight) {
			alert('Please enter weight before valuation.')
			return
		}
		if (!image) {
			alert('Please upload an image before valuation.')
			return
		}

		setLoading(true)
		setValuation(null)

		try {
			const res = await fetch(`https://dhahaby-api.topy.ai/api/XAU/${currency}`)
			const data = await res.json()
			console.log('✅ Fetched Gold Prices:', data)
			const purityKey = `price_gram_${purity}k`
			const pricePerGram = data[purityKey] || data.price_gram_24k
			const total = pricePerGram * Number(weight)

			const classification = await classfyGoldItem()
			setValuation({
				weight,
				purity,
				pricePerGram,
				totalValue: total,
				currency: data.currency,
				classification
			})
			console.log('Valuation Data:', {
				pricePerGram,
				totalValue: total,
				currency: data.currency,
				classification
			})
		} catch (err) {
			console.error(err)
			alert('Error fetching gold price.')
		} finally {
			setLoading(false)
		}
	}

	const purityOptions = [
		{ label: '24K', value: '24' },
		{ label: '22K', value: '22' },
		{ label: '21K', value: '21' },
		{ label: '20K', value: '20' },
		{ label: '18K', value: '18' },
		{ label: '16K', value: '16' },
		{ label: '14K', value: '14' },
		{ label: '10K', value: '10' },
	]

	const currencyOptions = ['USD', 'AED', 'GBP', 'EUR', 'INR']

	const classfyGoldItem = async () => {
		if (!image) {
			alert('Please upload an image first.')
			return
		}
		if (!imageBase64) {
			alert('Image is not ready yet. Please try again.')
			return
		}

		try {
			const response = await fetch("https://dhahaby-api.topy.ai/api/classify", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ imageBase64 })
			});
			const result = await response.json();
			console.log("✅ Server Classification:", result);
			return result;
		} catch (err) {
			console.error('Classification Error:', err)
			alert('Error classifying gold item.')
			return null
		}
	}

	const refreshValuation = async () => {
		if (!valuation) {
			alert('No existing valuation to refresh.')
			return
		}
		if (!valuation?.classification) {
			const classification = await classfyGoldItem()
			setValuation({
				...valuation,
				classification
			})
		}
		setLoading(true)
		try {
			const res = await fetch(`https://dhahaby-api.topy.ai/api/XAU/${valuation.currency}`)
			const data = await res.json()
			const purityKey = `price_gram_${valuation.classification.estimatedPurity}k`
			const pricePerGram = data[purityKey] || data.price_gram_24k
			const total = pricePerGram * Number(valuation.classification.estimatedWeightGrams)

			setValuation({
				...valuation,
				pricePerGram,
				totalValue: total,
			})
			console.log('✅ Valuation refreshed:', {
				...valuation,
				pricePerGram,
				totalValue: total,
			})
		} catch (err) {
			console.error(err)
			alert('Error refreshing gold price.')
		} finally {
			setLoading(false)
		}
	}

	const applyLoan = async () => {
		try {
			if (!imageBase64) {
				alert("Please upload an image first.");
				return;
			}

			if (!userAddress) {
				alert("Please connect your TON wallet first.");
				return;
			}

			setApplyingLoan(true); // ✅ show loading modal

			// Convert base64 back to file Blob for upload
			const blob = await fetch(imageBase64).then((r) => r.blob());
			const fileExt = blob.type.split("/")[1] || "jpg";
			const file = new File([blob], `item.${fileExt}`, { type: blob.type });

			// Create form data
			const formData = new FormData();
			formData.append("walletAddress", userAddress);
			formData.append("telegramId", WebApp?.initDataUnsafe?.user?.id || "");
			formData.append("fullName", WebApp?.initDataUnsafe?.user?.first_name || "Unknown");
			formData.append("valuation", JSON.stringify(valuation));
			formData.append("image", file);

			// Send to backend API
			const res = await fetch("https://dhahaby-api.topy.ai/api/loan/apply", {
				method: "POST",
				body: formData,
			});

			const data = await res.json();

			if (data.success) {
				console.log("✅ Loan Application Created:", data);
				setSelectedLoan(data.loan);
				setCreatedToken(data?.token_address || "");
				setShowSuccessModal(true);
				// setImage(null);
				// setImageBase64(null);
				// setValuation(null);
				// setWeight("");
			} else {
				console.error("❌ Loan Application Error:", data);
				alert("Failed to apply for loan: " + (data.error || "Unknown error"));
			}
		} catch (err) {
			console.error("❌ Apply Loan Exception:", err);
			alert("Error applying for loan: " + err.message);
		} finally {
			setApplyingLoan(false); // ✅ hide loading modal
		}
	};

	return (
		<>
			{/* Card */}
			<div className="w-full max-w-md mb-6">
				{applyingLoan && (
					<div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-50">
						<div className="flex flex-col items-center justify-center">
							{/* Gold Spinner */}
							<svg
								className="animate-spin h-10 w-10 text-[#E4A824] mb-4"
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
							>
								<circle
									className="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									strokeWidth="4"
								></circle>
								<path
									className="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16 8 8 0 01-8-8z"
								></path>
							</svg>

							{/* Text */}
							<h3 className="text-lg font-semibold text-[#0B0A0A]">Creating Token</h3>
							<p className="text-sm text-gray-600 mt-1 text-center px-6">
								Please wait a few seconds while we finalise your digital gold asset.
							</p>

							{/* Decorative footer line */}
							<div className="mt-6 w-24 border-t-2 border-[#E4A824] opacity-70"></div>
							<p className="text-xs text-gray-400 mt-2">Powered by Dhahaby AI</p>
						</div>
					</div>
				)}

				{showSuccessModal && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-opacity-90 backdrop-blur-sm p-4">
						<div
							className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center relative"
							onClick={(e) => e.stopPropagation()}
						>
							{/* Header */}
							<h2 className="text-lg font-semibold text-gray-800 mb-2">Token Status</h2>
							<div className="border-t border-gray-200 mb-4"></div>

							{/* Body */}
							<p className="text-sm text-gray-700 mb-2">
								Wallet connected. Token being created.
							</p>
							<p className="text-xs font-mono text-gray-500 break-all mb-5">
								{createdToken}
							</p>

							{/* Continue Button */}
							<button
								onClick={() => {
									setShowSuccessModal(false);
								}}
								className="w-full py-3 bg-[#E4A824] hover:bg-[#d3a31f] text-white font-semibold rounded-full transition-all"
								style={{
									backgroundColor: '#E4A824',
									borderRadius: '45px',
								}}
							>
								Continue
							</button>
						</div>
					</div>
				)}


				<div className="flex flex-col items-start mx-auto space-y-2">
					{/* LEFT — Image Preview */}
						{image ? (
							<div className="relative w-full rounded-xl">
								<label className="text-[16px] text-black">Uploaded Image</label>
								<img
									src={image}
									alt="Jewellery Preview"
									className="object-cover w-full h-full rounded-xl cursor-pointer transition-transform hover:scale-105"
									onClick={() => setShowModal(true)}
								/>

								{/* Floating action icons (bottom-right corner) */}
								<div className="absolute bottom-3 right-3 flex items-center space-x-2">
									{/* Re-upload icon */}
									<label
										htmlFor="file"
										className="flex items-center justify-center w-9 h-9 rounded-full bg-[#E4A824] cursor-pointer hover:bg-[#f3c93b] transition"
										title="Upload New Image"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											fill="none"
											viewBox="0 0 24 24"
											strokeWidth={1.8}
											stroke="white"
											className="w-5 h-5"
										>
											<path stroke-linecap="round" stroke-linejoin="round"
											      d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/>


										</svg>
										<input
											id="file"
											type="file"
											accept="image/*"
											onChange={handleImageUpload}
											className="hidden"
										/>
									</label>

									{/* Delete icon */}
									<label
										className="flex items-center justify-center w-9 h-9 rounded-full bg-red-400 cursor-pointer hover:bg-red-500 transition"
										onClick={() => {
											setImage(null);
											setImageBase64(null);
											setValuation(null);
										}}
										title="Remove Image"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											fill="none"
											viewBox="0 0 24 24"
											strokeWidth={1.8}
											stroke="white"
											className="w-5 h-5"
										>
												<path stroke-linecap="round" stroke-linejoin="round"
												      d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/>
											</svg>
									</label>



								</div>
							</div>
							) : (
							<div className="flex flex-col space-y-2 w-full">
							<label className="text-[16px] text-black">Upload Image</label>
							<label
							htmlFor="file"
							className="flex items-center gap-3 border border-dashed border-[#E4A824] rounded-xl p-3 cursor-pointer hover:bg-[#fff8e1] transition"
							>
							<div className="flex items-center justify-center bg-[#FAFAFA] rounded-full w-[50px] h-[50px]">
							<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							strokeWidth={1.8}
					stroke="#E4A824"
											className="w-7 h-7"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 10.5L12 6m0 0L7.5 10.5M12 6v12"
											/>
										</svg>
									</div>
									<div className="flex flex-col justify-center">
										<p className="text-[16px] leading-[19px] text-black">Upload Image</p>
										<p className="text-[12px] leading-[14px] text-[#484A4D]">Jpg, png, or jpeg</p>
									</div>
									<input
										id="file"
										type="file"
										accept="image/*"
										onChange={handleImageUpload}
										className="hidden"
									/>
								</label>
							</div>
						)}

					{/* RIGHT — Form Fields */}
					<div className="flex flex-col space-y-2 w-full mt-2">
						<div className="flex flex-col gap-3">
							{/* Weight field */}
							<div className="relative">
								<label className="text-[16px] text-black">Approx. Weight in Grams</label>
								<input
									ref={weightRef}
									type="number"
									id="weight"
									placeholder="Enter weight in grams"
									value={weight}
									onFocus={() => {
										// 👇 Smooth scroll to top when field gets focus
										setTimeout(() => {
											weightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
										}, 200);
									}}
									onChange={(e) => setWeight(e.target.value)}
									className="peer w-full p-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-yellow-500 outline-none placeholder-transparent"
								/>
								<span className="text-[14px] text-black/60">Prefer manual? You can fill in the fields yourself</span>

							</div>

							{/* Purity Dropdown */}
							<div className="flex flex-col space-y-2">

								<label className="text-[16px] text-[#0B0A0A]">Purity</label>
								<select
									id="purity"
									value={purity}
									onChange={(e) => setPurity(e.target.value)}
									className="w-full bg-[#FAFAFA] border border-[#DCDCDC] rounded-lg p-3 text-[16px] text-[#0B0A0A] focus:ring-2 focus:ring-[#E4A824] outline-none"
								>
									{purityOptions.map((p) => (
										<option key={p.value} value={p.value}>
											{p.label}
										</option>
									))}
								</select>
							</div>

							{/* Currency Dropdown */}

							<div className="flex flex-col space-y-2">
								<label className="text-[16px] text-[#0B0A0A]">
									Currency
								</label>
								<select
									id="currency"
									value={currency}
									onChange={(e) => setCurrency(e.target.value)}
									className="w-full bg-[#FAFAFA] border border-[#DCDCDC] rounded-lg p-3 text-[16px] text-[#0B0A0A] focus:ring-2 focus:ring-[#E4A824] outline-none"
								>
									{currencyOptions.map((c) => (
										<option key={c} value={c}>{c}</option>
									))}
								</select>

							</div>
						</div>
					</div>
				</div>

				{/* Valuation Result */}
				{valuation && (
					<div className="mt-6 w-full max-w-md mx-auto">
						<div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 text-center w-full mx-auto">

							{/* Estimated Value */}
							<h4 className="text-sm text-gray-500 mb-1">Estimated Value</h4>
							<p className="text-3xl font-bold text-[#E4A824] tracking-wide">
								{valuation.currency} {valuation.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
							</p>

							{/* Value Range */}
							<p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
								Range: {(
								valuation.totalValue *
								(1 - valuation.classification.estimatedVariance.min)
							).toLocaleString(undefined, { maximumFractionDigits: 0 })} –{" "}
								{(
									valuation.totalValue *
									(1 + valuation.classification.estimatedVariance.max)
								).toLocaleString(undefined, { maximumFractionDigits: 0 })}{" "}
								{valuation.currency}
							</p>

							{/* Confidence Bar */}
							<div className="mt-5 w-full text-left">
								<div className="flex justify-between items-center mb-1">
									<span className="text-sm font-medium text-gray-800">Confidence</span>
									<span className="text-sm font-semibold text-gray-800">
            {(valuation.classification.confidence * 100).toFixed(0)}%
          </span>
								</div>
								<div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
									<div
										className="h-full rounded-full"
										style={{
											width: `${valuation.classification.confidence * 100}%`,
											backgroundColor: '#E4A824',
										}}
									></div>
								</div>
							</div>

							{/* Reasoning Text */}
							<p className="text-sm text-gray-600 dark:text-gray-300 mt-4 leading-snug">
								{valuation.classification.reasoning}
							</p>
						</div>
					</div>
				)}

				{/* Estimate Button  */}
				<div className="mt-4 flex justify-center">
					<div className="w-full max-w-md">
						{!valuation ? (
							<button
								onClick={onEstimate}
								disabled={loading}
								className="w-full py-3 px-4 font-semibold rounded-full shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
								style={{
									color: 'white',
									backgroundColor: '#E4A824',
								}}
							>
								{loading ? '🔍 Estimating...' : 'Estimate Value'}
							</button>
						) : (
							!selectedLoan ? (
							<button
								onClick={async () => {
									if (!userAddress) {
										// 👇 Show wallet connection popup
										localStorage.setItem("pendingCreateToken", "true"); // mark pending
										await tc.openModal();
										return;
									}
									await applyLoan();
								}}
								className="w-full py-3 px-4 font-semibold rounded-full shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
								style={{
									color: 'white',
									backgroundColor: '#E4A824',
								}}
							>
								Create Token
							</button>
						): (
							<button
								onClick={() => {
									setShowVerify(true);
								}}
								className="w-full py-3 px-4 font-semibold rounded-full shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
								style={{
									color: 'white',
									backgroundColor: '#E4A824',
								}}
							>
								Get Jeweller Verification
							</button>
							)
						)}
						<div className="w-full max-w-md text-xs text-gray-400 dark:text-gray-500 text-center mt-2">
							<p>Powered by Dhahaby @{new Date().getFullYear()} on TON Blockchain</p>
						</div>
					</div>
				</div>
			</div>

			{/* Externalized modal */}
			<ScheduleAppraiserModal
				open={showVerify || showScheduledInfo}
				onClose={() => setShowVerify(false)}
				selectedLoan={selectedLoan}
				setSelectedLoan={setSelectedLoan}
				showScheduledInfo={showScheduledInfo}
				setShowScheduledInfo={setShowScheduledInfo}
				onScheduled={(data) => {
					console.log("✅ Scheduled:", data);
				}}
				setActiveTab={setActiveTab}
			/>

			{/* MODAL PREVIEW */}
			{showModal && (
				<div
					className="fixed inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50"
					onClick={() => setShowModal(false)}
				>
					<div className="relative bg-white dark:bg-gray-800 p-2 rounded-lg shadow-2xl shadow-gray-300 max-w-md w-full">
						<img
							src={image}
							alt="Preview"
							className="w-full h-auto rounded-md"
						/>
						<button
							onClick={() => setShowModal(false)}
							className="absolute top-2 right-2 bg-black bg-opacity-90 text-white rounded-full px-2 py-1 text-xs hover:bg-opacity-80"
						>
							✕
						</button>
					</div>
				</div>
			)}
		</>
	)
}
