const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create sample users
  const password = await bcrypt.hash("password123", 12);

  const user1 = await prisma.user.upsert({
    where: { email: "rahul@paruluniversity.ac.in" },
    update: {},
    create: { name: "Rahul Sharma", email: "rahul@paruluniversity.ac.in", password },
  });

  const user2 = await prisma.user.upsert({
    where: { email: "priya@paruluniversity.ac.in" },
    update: {},
    create: { name: "Priya Patel", email: "priya@paruluniversity.ac.in", password },
  });

  // Create sample items
  const items = [
    {
      title: "Engineering Mathematics Vol.2",
      description: "B.K.Pal edition 2022. Minor highlights. Perfect for 3rd sem.",
      category: "Books",
      startingPrice: 200,
      currentPrice: 320,
      endTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
      sellerId: user1.id,
      aiSuggestion: "Similar textbooks sell for ₹280–₹420. Competitive price!",
    },
    {
      title: "Dell Inspiron 15 Laptop",
      description: "Core i5, 8GB RAM, 512GB SSD. Minor scratch on lid. Charger included.",
      category: "Electronics",
      startingPrice: 15000,
      currentPrice: 18500,
      endTime: new Date(Date.now() + 45 * 60 * 1000), // 45 mins
      sellerId: user2.id,
      aiSuggestion: "Laptops with this spec go for ₹15k–₹22k. Expect price to rise!",
    },
    {
      title: "boAt Rockerz 450 Headphones",
      description: "Used 6 months. Works perfectly. Original box included.",
      category: "Electronics",
      startingPrice: 700,
      currentPrice: 850,
      endTime: new Date(Date.now() + 27 * 60 * 60 * 1000), // 27 hours
      sellerId: user1.id,
      aiSuggestion: "Strong resale demand. Expect competitive bidding in final hours.",
    },
    {
      title: "Parul University Hoodie (L)",
      description: "Official PU merchandise. Worn twice. Very good condition.",
      category: "Clothing",
      startingPrice: 300,
      currentPrice: 350,
      endTime: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours
      sellerId: user2.id,
      aiSuggestion: "University merchandise holds great resale value. Could fetch ₹400+.",
    },
  ];

  for (const item of items) {
    const created = await prisma.item.create({ data: item });

    // Add some sample bids
    await prisma.bid.createMany({
      data: [
        { amount: created.currentPrice - 50, itemId: created.id, bidderId: user2.id },
        { amount: created.currentPrice, itemId: created.id, bidderId: user1.id },
      ],
      skipDuplicates: true,
    });
  }

  console.log("✅ Database seeded successfully!");
  console.log("   Test accounts:");
  console.log("   Email: rahul@paruluniversity.ac.in  |  Password: password123");
  console.log("   Email: priya@paruluniversity.ac.in  |  Password: password123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
