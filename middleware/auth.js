const jwt = require("jsonwebtoken");
const prisma = require("../prisma/client");

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided. Please login first." });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, name: true, email: true, isBanned: true },
    });

    if (!user) return res.status(401).json({ error: "User not found" });
    if (user.isBanned) return res.status(403).json({ error: "Your account has been suspended" });

    req.user = user;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") return res.status(401).json({ error: "Session expired. Please login again." });
    return res.status(401).json({ error: "Invalid token" });
  }
};

module.exports = { authenticate };
