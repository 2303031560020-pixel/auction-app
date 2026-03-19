const express = require("express");
const multer = require("multer");
const { authenticate } = require("../middleware/auth");
const { recognizeImage } = require("../ai/imageRecognition");
const { suggestPrice } = require("../ai/priceAI");
const { chatbot } = require("../ai/chatbot");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── POST /api/ai/recognize ─────────────────────
// Upload image → AI returns title, category, condition, suggested price
router.post("/recognize", authenticate, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Image required" });

    const result = await recognizeImage(req.file.buffer, req.file.mimetype);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("Image recognition error:", err);
    res.status(500).json({ error: "AI recognition failed. Try again." });
  }
});

// ── POST /api/ai/price ─────────────────────────
// Get AI price suggestion for a category + condition
router.post("/price", authenticate, async (req, res) => {
  try {
    const { title, category, condition } = req.body;
    if (!category) return res.status(400).json({ error: "Category required" });

    const suggestion = await suggestPrice({ title, category, condition });
    res.json({ success: true, ...suggestion });
  } catch (err) {
    res.status(500).json({ error: "Price suggestion failed" });
  }
});

// ── POST /api/ai/chat ──────────────────────────
// Chatbot - answer student questions about auctions
router.post("/chat", async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ error: "Message required" });

    const reply = await chatbot(message, history);
    res.json({ success: true, reply });
  } catch (err) {
    res.status(500).json({ error: "Chatbot failed. Try again." });
  }
});

module.exports = router;
