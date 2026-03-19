const express = require("express");
const prisma = require("../prisma/client");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// ── POST /api/bids/:itemId ─────────────────────
// Place a bid on an item
router.post("/:itemId", authenticate, async (req, res) => {
  try {
    const { amount } = req.body;
    const bidAmount = parseFloat(amount);

    if (!bidAmount || isNaN(bidAmount)) {
      return res.status(400).json({ error: "Valid bid amount required" });
    }

    // Fetch item with lock (use transaction)
    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.item.findUnique({ where: { id: req.params.itemId } });

      if (!item) throw new Error("Item not found");
      if (item.status !== "ACTIVE") throw new Error("This auction has ended");
      if (new Date() > item.endTime) throw new Error("Auction time has expired");
      if (item.sellerId === req.user.id) throw new Error("You cannot bid on your own item");
      if (bidAmount < item.currentPrice + item.minBidStep) {
        throw new Error(`Minimum bid is ₹${item.currentPrice + item.minBidStep}`);
      }

      // Check for rapid bidding (fraud detection)
      const recentBids = await tx.bid.count({
        where: {
          bidderId: req.user.id,
          itemId: req.params.itemId,
          createdAt: { gt: new Date(Date.now() - 60 * 1000) }, // last 1 min
        },
      });
      if (recentBids >= 5) throw new Error("Too many bids in a short time. Slow down!");

      // Create bid and update item price
      const bid = await tx.bid.create({
        data: { amount: bidAmount, itemId: req.params.itemId, bidderId: req.user.id },
        include: { bidder: { select: { id: true, name: true } } },
      });

      await tx.item.update({
        where: { id: req.params.itemId },
        data: { currentPrice: bidAmount },
      });

      return { bid, newPrice: bidAmount };
    });

    // Emit real-time update via Socket.io
    const io = req.app.get("io");
    if (io) {
      io.to(`item-${req.params.itemId}`).emit("new-bid", {
        bid: result.bid,
        newPrice: result.newPrice,
        itemId: req.params.itemId,
      });
    }

    res.status(201).json({
      message: "Bid placed successfully!",
      bid: result.bid,
      newPrice: result.newPrice,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── GET /api/bids/:itemId ──────────────────────
// Get bid history for an item
router.get("/:itemId", async (req, res) => {
  try {
    const bids = await prisma.bid.findMany({
      where: { itemId: req.params.itemId },
      include: { bidder: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    res.json({ bids });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch bids" });
  }
});

// ── GET /api/bids/my/bids ──────────────────────
// Get current user's all bids
router.get("/my/bids", authenticate, async (req, res) => {
  try {
    const bids = await prisma.bid.findMany({
      where: { bidderId: req.user.id },
      include: { item: { select: { id: true, title: true, currentPrice: true, status: true, imageUrl: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ bids });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch your bids" });
  }
});

module.exports = router;
