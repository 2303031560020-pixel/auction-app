/**
 * Socket.io handlers for real-time bidding
 *
 * Events:
 * Client → Server:
 *   join-item (itemId)       — join a specific auction room
 *   leave-item (itemId)      — leave an auction room
 *
 * Server → Client:
 *   new-bid { bid, newPrice, itemId }  — broadcast when a new bid is placed
 *   auction-ended { itemId, winner }   — broadcast when auction time ends
 *   user-count { itemId, count }       — how many users watching this item
 */

function setupSocketHandlers(io) {
  // Track viewers per item
  const itemViewers = new Map();

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // User joins an auction room
    socket.on("join-item", (itemId) => {
      socket.join(`item-${itemId}`);

      // Track viewer count
      const count = (itemViewers.get(itemId) || 0) + 1;
      itemViewers.set(itemId, count);

      // Tell everyone in room how many are watching
      io.to(`item-${itemId}`).emit("user-count", { itemId, count });
    });

    // User leaves an auction room
    socket.on("leave-item", (itemId) => {
      socket.leave(`item-${itemId}`);
      const count = Math.max((itemViewers.get(itemId) || 1) - 1, 0);
      itemViewers.set(itemId, count);
      io.to(`item-${itemId}`).emit("user-count", { itemId, count });
    });

    // Clean up on disconnect
    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  // Check for expired auctions every minute and notify
  setInterval(async () => {
    try {
      const prisma = require("./prisma/client");
      const expired = await prisma.item.findMany({
        where: { status: "ACTIVE", endTime: { lt: new Date() } },
        include: {
          bids: { orderBy: { amount: "desc" }, take: 1, include: { bidder: { select: { name: true } } } },
        },
      });

      for (const item of expired) {
        await prisma.item.update({ where: { id: item.id }, data: { status: "ENDED" } });
        const winner = item.bids[0]?.bidder?.name || "No winner";
        io.to(`item-${item.id}`).emit("auction-ended", {
          itemId: item.id,
          winner,
          finalPrice: item.currentPrice,
        });
      }
    } catch (err) {
      console.error("Auction expiry check error:", err.message);
    }
  }, 60 * 1000); // every 60 seconds
}

module.exports = { setupSocketHandlers };
