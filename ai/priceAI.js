const { GoogleGenerativeAI } = require("@google/generative-ai");
const prisma = require("../prisma/client");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Rule-based price ranges (fallback if AI is unavailable)
const BASE_RANGES = {
  Books:       { min: 50,   max: 800 },
  Electronics: { min: 500,  max: 30000 },
  Clothing:    { min: 100,  max: 1000 },
  Hostel:      { min: 100,  max: 3000 },
  Sports:      { min: 100,  max: 2000 },
};

const CONDITION_MULTIPLIER = {
  Excellent: 1.0,
  Good:      0.75,
  Fair:      0.5,
  Poor:      0.3,
};

/**
 * Returns price suggestion combining:
 * 1. Historical data from DB (similar sold items)
 * 2. Gemini AI analysis
 * 3. Rule-based fallback
 */
async function suggestPrice({ title, category, condition = "Good" }) {
  try {
    // Step 1: Get historical data from DB
    const recentSales = await prisma.item.findMany({
      where: { category, status: "ENDED" },
      select: { currentPrice: true, title: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    let historyContext = "";
    if (recentSales.length > 0) {
      const prices = recentSales.map((i) => i.currentPrice);
      const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
      historyContext = `Recent sales in ${category} on this platform averaged ₹${Math.round(avg)}.`;
    }

    // Step 2: Ask Gemini for a suggestion
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `You are a pricing AI for a student marketplace in India (Parul University).
Item: "${title || "Unspecified"}"
Category: ${category}
Condition: ${condition}
${historyContext}

Suggest a fair price range for a student selling this used item.
Respond ONLY with valid JSON:
{"min": <number>, "max": <number>, "tip": "<one short tip for the seller, max 100 chars>"}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim().replace(/```json|```/g, "");
    const parsed = JSON.parse(text);

    return {
      suggestedMin: parsed.min,
      suggestedMax: parsed.max,
      tip: parsed.tip,
      basedOn: recentSales.length > 0 ? "AI + recent sales data" : "AI analysis",
    };
  } catch (err) {
    console.error("Price AI error:", err.message);

    // Fallback: rule-based calculation
    const range = BASE_RANGES[category] || { min: 100, max: 1000 };
    const multiplier = CONDITION_MULTIPLIER[condition] || 0.75;
    return {
      suggestedMin: Math.round(range.min * multiplier),
      suggestedMax: Math.round(range.max * multiplier),
      tip: `${condition} ${category} typically sell for this range on campus.`,
      basedOn: "rule-based estimate",
    };
  }
}

module.exports = { suggestPrice };
