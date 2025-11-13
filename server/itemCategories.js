export const itemCategories = [
	{
		type: "Gold Bar",
		recognition: "Rectangular, uniform",
		confidence: 0.95,
		variance: { min: 0.02, max: 0.02 },
		notes: "Machine-made, predictable density"
	},
	{
		type: "Coin / Medal",
		recognition: "Circular, flat",
		confidence: 0.9,
		variance: { min: 0.03, max: 0.04 },
		notes: "Possible wear or design relief"
	},
	{
		type: "Chain / Bracelet",
		recognition: "Thin, complex",
		confidence: 0.85,
		variance: { min: 0.05, max: 0.07 },
		notes: "Shape irregularity affects density"
	},
	{
		type: "Ring / Pendant / Earring",
		recognition: "Small, gemstone setting",
		confidence: 0.8,
		variance: { min: 0.08, max: 0.12 },
		notes: "Non-gold parts, hollow areas"
	},
	{
		type: "Mixed / Unknown Jewellery",
		recognition: "Low confidence",
		confidence: 0.0,
		variance: { min: 0.15, max: 0.2 },
		notes: "Treated as rough estimate"
	}
]
