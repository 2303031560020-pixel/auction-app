const express = require("express");
const prisma = require("../prisma/client");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// ── GET /api/users/profile ─────────────────────
router.get("/profile", authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, name: true, email: true, avatar: true, createdAt: true,
        items: {
          select: { id: true, title: true, currentPrice: true, status: true, imageUrl: true, endTime: true, _count: { select: { bids: true } } },
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { items: true, bids: true } },
      },
    });

    // Calculate total earned (from ended auctions)
    const earned = await prisma.item.aggregate({
      where: { sellerId: req.user.id, status: "ENDED" },
      _sum: { currentPrice: true },
    });

    res.json({ user: { ...user, totalEarned: earned._sum.currentPrice || 0 } });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// ── GET /api/users/:id/listings ────────────────
router.get("/:id/listings", async (req, res) => {
  try {
    const items = await prisma.item.findMany({
      where: { sellerId: req.params.id, status: "ACTIVE" },
      include: { _count: { select: { bids: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch listings" });
  }
});

module.exports = router;
