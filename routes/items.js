const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { z } = require("zod");
const prisma = require("../prisma/client");
const { authenticate } = require("../middleware/auth");
const { checkFraud } = require("../ai/fraud");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const itemSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().optional(),
  category: z.enum(["Books", "Electronics", "Clothing", "Hostel", "Sports"]),
  startingPrice: z.number().positive().max(100000),
  minBidStep: z.number().positive().optional(),
  endTime: z.string().datetime(),
});

// ── GET /api/items ─────────────────────────────
// Get all active items with optional filters
router.get("/", async (req, res) => {
  try {
    const { category, search, page = 1, limit = 12 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      status: "ACTIVE",
      endTime: { gt: new Date() },
      ...(category && { category }),
      ...(search && { title: { contains: search, mode: "insensitive" } }),
    };

    const [items, total] = await Promise.all([
      prisma.item.findMany({
        where,
        include: {
          seller: { select: { id: true, name: true, email: true } },
          _count: { select: { bids: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.item.count({ where }),
    ]);

    res.json({ items, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch items" });
  }
});

// ── GET /api/items/:id ─────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const item = await prisma.item.findUnique({
      where: { id: req.params.id },
      include: {
        seller: { select: { id: true, name: true, email: true } },
        bids: {
          include: { bidder: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        _count: { select: { bids: true } },
      },
    });
    if (!item) return res.status(404).json({ error: "Item not found" });
    res.json({ item });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch item" });
  }
});

// ── POST /api/items ────────────────────────────
// Create a new auction listing
router.post("/", authenticate, upload.single("image"), async (req, res) => {
  try {
    const body = { ...req.body, startingPrice: parseFloat(req.body.startingPrice) };
    const data = itemSchema.parse(body);

    // Upload image to Cloudinary
    let imageUrl = null;
    if (req.file) {
      const b64 = req.file.buffer.toString("base64");
      const dataUri = `data:${req.file.mimetype};base64,${b64}`;
      const result = await cloudinary.uploader.upload(dataUri, { folder: "bidx-auction" });
      imageUrl = result.secure_url;
    }

    // AI fraud check before listing
    const fraudResult = await checkFraud({
      title: data.title,
      price: data.startingPrice,
      category: data.category,
      sellerId: req.user.id,
    });

    const item = await prisma.item.create({
      data: {
        ...data,
        startingPrice: data.startingPrice,
        currentPrice: data.startingPrice,
        minBidStep: data.minBidStep || 10,
        endTime: new Date(data.endTime),
        imageUrl,
        sellerId: req.user.id,
        isFlagged: fraudResult.isFlagged,
        flagReason: fraudResult.reason || null,
      },
    });

    res.status(201).json({
      message: "Auction created successfully!",
      item,
      fraudWarning: fraudResult.isFlagged ? fraudResult.reason : null,
    });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
    console.error(err);
    res.status(500).json({ error: "Failed to create listing" });
  }
});

// ── DELETE /api/items/:id ──────────────────────
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const item = await prisma.item.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ error: "Item not found" });
    if (item.sellerId !== req.user.id) return res.status(403).json({ error: "Not your listing" });
    if (item.bids && item._count?.bids > 0) return res.status(400).json({ error: "Cannot delete an item that has bids" });

    await prisma.item.update({ where: { id: req.params.id }, data: { status: "CANCELLED" } });
    res.json({ message: "Listing cancelled" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete item" });
  }
});

// ── POST /api/items/:id/report ─────────────────
router.post("/:id/report", authenticate, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: "Reason required" });

    await prisma.report.create({
      data: { itemId: req.params.id, userId: req.user.id, reason },
    });
    res.json({ message: "Item reported. Our team will review it." });
  } catch (err) {
    res.status(500).json({ error: "Failed to report item" });
  }
});

module.exports = router;
