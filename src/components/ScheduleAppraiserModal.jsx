import React, { useState, useEffect } from "react";

export default function ScheduleAppraiserModal({ open, onClose, selectedLoan, setSelectedLoan,showScheduledInfo,setShowScheduledInfo, onScheduled, setActiveTab }) {
	const [appraiserData, setAppraiserData] = useState({
		appraiser: "dhakan",
		date: "",
		slot: "morning",
	});
	const [showConfirmCancel, setShowConfirmCancel] = useState(false);

	const jewellers = {
		dhakan: {
			name: "Dhakan Jewellers Dubai - Ithra Branch",
			address: "New Gold Souk Extension, 9 - Shop 4 & 5 Hind Plaza, Dubai, United Arab Emirates",
			contact: "+971 4 123 4567",
			mapsUrl: "https://www.google.com/maps?q=Dhakan+Jewellers+Dubai+-+Ithra+Branch",
		},
		ajanta: {
			name: "Ajanta Jewellers, Abu Dhabi",
			address: "Hamdan Street, Opposite Liwa Centre, Abu Dhabi, United Arab Emirates",
			contact: "+971 2 234 5678",
			mapsUrl: "https://www.google.com/maps?q=Ajanta+Jewellers,+Abu+Dhabi",
		},
		olympic: {
			name: "Olympic Jewellers, Sharjah",
			address: "Rolla Street, Near Rolla Mall, Sharjah, United Arab Emirates",
			contact: "+971 6 345 6789",
			mapsUrl: "https://www.google.com/maps?q=Olympic+Jewellers,+Sharjah",
		},
	};

	const timeSlots = {
		morning: "Morning (9 AM - 12 PM)",
		afternoon: "Afternoon (12 PM - 4 PM)",
		evening: "Evening (4 PM - 9 PM)",
	}

	useEffect(() => {
		// Set tomorrow as default date
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		const formatted = tomorrow.toISOString().split("T")[0];
		setAppraiserData((prev) => ({ ...prev, date: formatted }));
	}, []);

	const handleSchedule = async () => {
		if (!selectedLoan) return;

		try {
			const res = await fetch(`https://dhahaby-api.topy.ai/api/loan/schedule`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					prevaluationId: selectedLoan.id,
					appraisalData: appraiserData,
				}),
			});

			const data = await res.json();

			if (data.success) {
				console.log("✅ Scheduled Successfully:", data);
				// Update selected loan with appraisal data
				const updatedLoan = {
					...selectedLoan,
					appraiser: appraiserData,
					status: "scheduled",
				};
				setSelectedLoan(updatedLoan);
				setShowConfirmCancel(false);
				setShowScheduledInfo(true);
				onScheduled && onScheduled(updatedLoan);
			} else {
				alert("❌ Failed to schedule: " + (data.error || "Unknown error"));
			}
		} catch (err) {
			console.error("❌ Schedule Error:", err);
			alert("Error scheduling appraisal: " + err.message);
		}
	};

	if (!open) return null;

	return (
		<>
		<div
			className="fixed inset-0 z-50 flex flex-col bg-gray-50 overflow-y-auto"
		>
			<div
				className="flex-1 p-6 overflow-y-auto"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="flex justify-between items-center mb-6">
					<h2 className="text-lg font-semibold">Schedule Appraisal</h2>
					<button
						onClick={onClose}
						className="w-7 h-7 flex items-center justify-center rounded-full text-white text-sm font-bold hover:bg-red-600"
						style={{ backgroundColor: "#E4A824" }}
					>
						✕
					</button>
				</div>

				{/* Form */}
				<div className="space-y-4">
					<div>
						<label className="block text-sm font-medium mb-2">Select Appraiser</label>
						<select
							className="w-full border border-gray-300 rounded-lg p-2.5"
							value={appraiserData.appraiser}
							onChange={(e) =>
								setAppraiserData({ ...appraiserData, appraiser: e.target.value })
							}
						>
							<option value="dhakan">Dhakan Jewellers Dubai - Ithra Branch</option>
							<option value="ajanta">Ajanta Jewellers, Abu Dhabi</option>
							<option value="olympic">Olympic Jewellers, Sharjah</option>
						</select>
					</div>

					<div>
						<label className="block text-sm font-medium mb-2">Select Date</label>
						<input
							type="date"
							className="w-full border border-gray-300 rounded-lg p-2.5"
							value={appraiserData.date}
							min={appraiserData.date}
							onChange={(e) =>
								setAppraiserData({ ...appraiserData, date: e.target.value })
							}
						/>
					</div>

					<div>
						<label className="block text-sm font-medium mb-2">Select Time Slot</label>
						<select
							className="w-full border border-gray-300 rounded-lg p-2.5"
							value={appraiserData.slot}
							onChange={(e) =>
								setAppraiserData({ ...appraiserData, slot: e.target.value })
							}
						>
							<option value="morning">Morning (10:00 AM – 12:00 PM)</option>
							<option value="afternoon">Afternoon (1:00 PM – 3:00 PM)</option>
							<option value="evening">Evening (4:00 PM – 6:00 PM)</option>
						</select>
					</div>
				</div>
			</div>

			{/* Footer Button */}
			<div className="p-4">
				<button
					onClick={() => setShowConfirmCancel(true)}
					className="w-full py-3 text-white font-semibold rounded-full"
					style={{ backgroundColor: "#E4A824", borderRadius: "45px" }}
				>
					Proceed
				</button>
			</div>
		</div>
			{/* Fee Note Modal */}
			{showConfirmCancel && selectedLoan && (
				<div
					className="fixed inset-0 z-[60] flex items-center justify-center bg-opacity-90 backdrop-blur-sm"
					onClick={() => setShowConfirmCancel(false)}
				>
					<div
						className="bg-white rounded-2xl p-6 w-11/12 max-w-xs text-center shadow-2xl shadow-gray-300 transition-all duration-300"
						onClick={(e) => e.stopPropagation()}
					>
						{/* Title */}
						<h2 className="text-base font-semibold text-gray-900 mb-3">
							Fee Note
						</h2>
						<hr className="mb-4"/>
						{/* Message */}
						<p className="text-sm text-gray-600 mb-1 leading-relaxed">
							You will be charged <strong>AED 200</strong>
						</p>
						<p className="text-sm text-gray-600 mb-6 leading-relaxed">
							(non-refundable) for appraisal.
						</p>

						{/* Continue Button */}
						<button
							onClick={async () => {
								await handleSchedule();
							}}
							className="w-full py-2.5 text-white font-medium rounded-full mb-3 transition-transform hover:scale-[1.02]"
							style={{
								backgroundColor: "#E4A824",
								borderRadius: "45px"
							}}
						>
							Continue
						</button>

						{/* Cancel Button */}
						<button
							onClick={() => setShowConfirmCancel(false)}
							className="w-full text-sm font-medium text-gray-500 hover:text-gray-700"
							style={{
								borderRadius: "45px",
								color: "#E4A824"
							}}
						>
							Cancel
						</button>
					</div>
				</div>
			)}

			{/* Scheduled Info Modal */}
			{showScheduledInfo && selectedLoan && (
				<div
					className="fixed inset-0 z-[70] flex items-center justify-center bg-white bg-opacity-90 backdrop-blur-sm"
					onClick={() =>
					{
						setShowScheduledInfo(false)
						setActiveTab("assets")
						onClose()
					}}
				>
					<div
						className="bg-white p-6 w-full text-center shadow-2xl shadow-gray-300 flex flex-col justify-between transition-all duration-300"
						style={{ minHeight: "100vh" }}
						onClick={(e) => e.stopPropagation()}
					>
						{/* Header */}
						<div>
							<h2 className="text-lg font-semibold text-gray-900 mb-4 mt-6">
								Appraisal Confirmed
							</h2>

							{/* Animated GIF */}
							<div className="flex justify-center mb-6">
								<img
									src="/scheduled.gif"
									alt="Appraisal Scheduled"
									className="w-45 h-45 object-cover"
								/>
							</div>

							{/* Appointment Details */}
							<div className="text-sm text-gray-800 space-y-2 leading-relaxed">
								<p>
									{selectedLoan.appraiser?.date
										? new Date(selectedLoan.appraiser.date).toLocaleDateString("en-GB", {
											year: "numeric",
											month: "long",
											day: "numeric",
											weekday: "long",
										})
										: "Date not available"}
								</p>
								<p>
									{timeSlots[selectedLoan.appraiser?.slot] || "Time slot not available"}
								</p>
								<p className="font-medium">
									{jewellers[selectedLoan.appraiser?.appraiser || "dhakan"]?.name || "Appraiser not available"}
								</p>
								<p className="text-xs text-gray-600">
									{jewellers[selectedLoan.appraiser?.appraiser || "dhakan"]?.address || "Address not available"}
								</p>
							</div>

							{/* Google Maps Link */}
							{/* Google Maps Link */}
							<div className="mt-4">
								{jewellers[selectedLoan.appraiser?.appraiser || "dhakan"]?.address && (
									<a
										href={`https://www.google.com/maps?q=${encodeURIComponent(
											jewellers[selectedLoan.appraiser?.appraiser || "dhakan"].address
										)}`}
										target="_blank"
										rel="noopener noreferrer"
										className="text-blue-600 text-sm underline hover:text-blue-800"
									>
										Click here to open Google Maps
									</a>
								)}
							</div>

							{/* Note Section */}
							<div className="bg-yellow-50 text-gray-800 text-sm rounded-xl px-4 py-3 mt-5">
								<p>
									<strong>Note:</strong>
									<br/>
									Bring your item and ID to complete verification.
								</p>
							</div>
						</div>

						{/* Footer Button */}
						<div className="mt-8">
							<button
								onClick={() => {
									setShowScheduledInfo(false);
									setActiveTab("assets");
									onClose();
								}}
								className="w-full py-3 text-white font-semibold rounded-full"
								style={{
									backgroundColor: "#E4A824",
									borderRadius: "45px",
								}}
							>
								Home
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
