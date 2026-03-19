const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const prisma = require("../prisma/client");

const router = express.Router();
const ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN || "paruluniversity.ac.in";

// ── Validation schemas ─────────────────────────
const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email").refine(
    (email) => email.endsWith(`@${ALLOWED_DOMAIN}`),
    { message: `Only @${ALLOWED_DOMAIN} emails are allowed` }
  ),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password required"),
});

// ── POST /api/auth/register ────────────────────
router.post("/register", async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) return res.status(400).json({ error: "Email already registered" });

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: { name: data.name, email: data.email, password: hashedPassword },
      select: { id: true, name: true, email: true, createdAt: true },
    });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({ message: "Account created successfully!", user, token });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
    res.status(500).json({ error: "Registration failed. Try again." });
  }
});

// ── POST /api/auth/login ───────────────────────
router.post("/login", async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) return res.status(400).json({ error: "Invalid email or password" });
    if (user.isBanned) return res.status(403).json({ error: "Your account has been suspended" });

    const validPassword = await bcrypt.compare(data.password, user.password);
    if (!validPassword) return res.status(400).json({ error: "Invalid email or password" });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({
      message: "Login successful!",
      user: { id: user.id, name: user.name, email: user.email },
      token,
    });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
    res.status(500).json({ error: "Login failed. Try again." });
  }
});

// ── GET /api/auth/me ───────────────────────────
router.get("/me", require("../middleware/auth").authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, email: true, avatar: true, createdAt: true,
      _count: { select: { items: true, bids: true } } },
  });
  res.json({ user });
});

module.exports = router;
