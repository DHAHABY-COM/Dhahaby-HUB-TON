export async function trackEvent(event_name, event_data = {}) {
	try {
		const user_id = window?.Telegram?.WebApp?.initDataUnsafe?.user?.id || null;
		const source = "telegram";

		await fetch("https://dhahaby-api.topy.ai/api/track", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ event_name, event_data, source, user_id }),
		});
	} catch (err) {
		console.error("⚠️ Event tracking failed:", err);
	}
}
