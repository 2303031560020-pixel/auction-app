const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const CATEGORIES = ["Books", "Electronics", "Clothing", "Hostel", "Sports"];

/**
 * Takes an image buffer and returns:
 * - title: suggested item title
 * - category: one of the 5 categories
 * - condition: Excellent / Good / Fair / Poor
 * - suggestedPrice: { min, max } in INR
 * - description: short auto-generated description
 */
async function recognizeImage(imageBuffer, mimeType) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const imagePart = {
      inlineData: {
        data: imageBuffer.toString("base64"),
        mimeType: mimeType,
      },
    };

    const prompt = `You are an AI assistant for a student marketplace at Parul University, India.
Analyze this image and respond with ONLY a valid JSON object (no markdown, no explanation):
{
  "title": "short item title (max 60 chars)",
  "category": "one of: Books, Electronics, Clothing, Hostel, Sports",
  "condition": "one of: Excellent, Good, Fair, Poor",
  "suggestedPriceMin": <number in INR>,
  "suggestedPriceMax": <number in INR>,
  "description": "1-2 sentence description mentioning condition and any visible features"
}

Base price on Indian student marketplace values. Books: 50-800, Electronics: 200-30000, Clothing: 100-1000, Hostel items: 100-3000, Sports: 100-2000.`;

    const result = await model.generateContent([prompt, imagePart]);
    const text = result.response.text().trim();

    // Parse JSON response
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    // Validate category
    if (!CATEGORIES.includes(parsed.category)) parsed.category = "Books";

    return {
      title: parsed.title || "Unlisted Item",
      category: parsed.category,
      condition: parsed.condition || "Good",
      suggestedPriceMin: parsed.suggestedPriceMin || 100,
      suggestedPriceMax: parsed.suggestedPriceMax || 500,
      description: parsed.description || "",
    };
  } catch (err) {
    console.error("Gemini recognition error:", err.message);
    // Fallback response if AI fails
    return {
      title: "Item for Sale",
      category: "Books",
      condition: "Good",
      suggestedPriceMin: 100,
      suggestedPriceMax: 500,
      description: "AI recognition unavailable. Please fill details manually.",
    };
  }
}

module.exports = { recognizeImage };
