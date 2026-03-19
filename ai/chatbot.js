const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `You are BidX Assistant, a helpful AI chatbot for a student auction marketplace at Parul University, India.

You help students with:
- How to place bids and win auctions
- How to list and sell items
- Understanding pricing and categories
- Payment and pickup advice (payments are done in person on campus)
- Reporting suspicious listings
- General marketplace rules

Rules you must follow:
- Keep responses short and friendly (2-3 sentences max)
- Always be encouraging and helpful
- If asked about payments, say it's done in person on campus for safety
- Only @paruluniversity.ac.in emails can use BidX
- If asked something unrelated to the marketplace, politely redirect

Do NOT make up policies that don't exist. Be honest if you don't know something.`;

/**
 * Chat with Gemini AI
 * history: array of {role: "user"|"model", parts: [{text: "..."}]}
 */
async function chatbot(message, history = []) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Build chat with history
    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
        { role: "model", parts: [{ text: "Got it! I'm BidX Assistant, ready to help Parul University students with all their auction needs. 🎓" }] },
        ...history,
      ],
      generationConfig: { maxOutputTokens: 200, temperature: 0.7 },
    });

    const result = await chat.sendMessage(message);
    return result.response.text();
  } catch (err) {
    console.error("Chatbot error:", err.message);
    // Fallback hardcoded responses
    const msg = message.toLowerCase();
    if (msg.includes("bid")) return "To place a bid, click on any item and enter an amount higher than the current price. Hit 'Bid Now' and you're in! 🎯";
    if (msg.includes("sell") || msg.includes("list")) return "Go to the Sell page, upload a photo (AI will fill in details!), set a starting price, and publish. Easy! 🚀";
    if (msg.includes("pay")) return "Payments are handled in person on campus after winning. Contact the seller via the chat feature to arrange pickup. 💰";
    return "I'm having trouble connecting to AI right now. Please try asking about bidding, selling, or pricing! 😊";
  }
}

module.exports = { chatbot };
