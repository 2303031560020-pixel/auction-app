const prisma = require("../prisma/client");

/**
 * Checks if a new listing looks fraudulent.
 * Returns { isFlagged: boolean, reason: string | null }
 *
 * Rules checked:
 * 1. Abnormally high price for category
 * 2. Too many listings by same seller in short time
 * 3. Duplicate title from same seller
 * 4. Suspicious keywords in title
 */

const MAX_PRICES = {
  Books:       1500,
  Electronics: 50000,
  Clothing:    3000,
  Hostel:      8000,
  Sports:      5000,
};

const SUSPICIOUS_KEYWORDS = [
  "iphone 15 pro max", "macbook pro m3", "rolex", "gold", "diamond",
  "guaranteed", "original sealed", "brand new imported", "win prize",
];

async function checkFraud({ title, price, category, sellerId }) {
  try {
    // Rule 1: Price too high for category
    const maxPrice = MAX_PRICES[category];
    if (maxPrice && price > maxPrice) {
      return {
        isFlagged: true,
        reason: `Price ₹${price} seems unusually high for ${category} (typical max: ₹${maxPrice}). Please verify.`,
      };
    }

    // Rule 2: Too many listings in last 24 hours (max 5)
    const recentListings = await prisma.item.count({
      where: {
        sellerId,
        createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    if (recentListings >= 5) {
      return {
        isFlagged: true,
        reason: "Too many listings in 24 hours. Looks like spam activity.",
      };
    }

    // Rule 3: Duplicate title from same seller
    const duplicate = await prisma.item.findFirst({
      where: {
        sellerId,
        title: { equals: title, mode: "insensitive" },
        status: "ACTIVE",
      },
    });
    if (duplicate) {
      return {
        isFlagged: true,
        reason: "You already have an active listing with this exact title.",
      };
    }

    // Rule 4: Suspicious keywords
    const titleLower = title.toLowerCase();
    const foundKeyword = SUSPICIOUS_KEYWORDS.find((kw) => titleLower.includes(kw));
    if (foundKeyword) {
      return {
        isFlagged: true,
        reason: `Listing flagged for review: contains suspicious keyword "${foundKeyword}". Our team will verify.`,
      };
    }

    return { isFlagged: false, reason: null };
  } catch (err) {
    console.error("Fraud check error:", err.message);
    return { isFlagged: false, reason: null }; // Don't block listing if check fails
  }
}

module.exports = { checkFraud };
