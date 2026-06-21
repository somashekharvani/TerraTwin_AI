const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'file:./dev.db',
    },
  },
});

async function main() {
  // Hash the demo password
  const passwordHash = await bcrypt.hash('demo123', 10);

  // Clean existing database records
  await prisma.tokenTransaction.deleteMany();
  await prisma.carbonEntry.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.user.deleteMany();

  // Create demo user
  const user = await prisma.user.create({
    data: {
      id: 'cmqn7tjnj0000h6759cg993i1',
      email: 'demo@terratwin.ai',
      name: 'Eco Explorer',
      passwordHash,
      monthlyGoal: 600,
      walletAddress: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
    },
  });

  console.log(`Created demo user: ${user.email}`);

  // Create monthly goal
  await prisma.goal.create({
    data: {
      userId: user.id,
      monthlyTarget: 600,
      targetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
    },
  });

  // Seed 30 days of carbon entries
  const entriesData = [];
  const now = new Date();
  for (let i = 0; i < 30; i++) {
    const date = new Date();
    date.setDate(now.getDate() - i);

    // Add electricity entry (energy category)
    const elecKwh = 8.5 + Math.random() * 6;
    entriesData.push({
      userId: user.id,
      category: 'energy',
      type: 'electricity',
      value: elecKwh,
      unit: 'kWh',
      carbonEmitted: Number((elecKwh * 0.233).toFixed(3)),
      source: 'iot',
      automatic: true,
      createdAt: date,
    });

    // Add transport entry (car or bus)
    const isCar = Math.random() > 0.5;
    const distance = 5 + Math.random() * 20;
    entriesData.push({
      userId: user.id,
      category: 'transport',
      type: isCar ? 'car' : 'bus',
      value: distance,
      unit: 'km',
      carbonEmitted: Number((distance * (isCar ? 0.21 : 0.11)).toFixed(3)),
      source: isCar ? 'manual' : 'geolocation',
      automatic: !isCar,
      createdAt: date,
    });

    // Add food entry (beef, chicken, vegetables)
    const foodType = Math.random() > 0.6 ? 'beef' : Math.random() > 0.3 ? 'chicken' : 'vegetables';
    const factor = foodType === 'beef' ? 27.0 : foodType === 'chicken' ? 6.9 : 2.0;
    const weight = 0.2 + Math.random() * 0.8;
    entriesData.push({
      userId: user.id,
      category: 'food',
      type: foodType,
      value: weight,
      unit: 'kg',
      carbonEmitted: Number((weight * factor).toFixed(3)),
      source: 'food_camera',
      automatic: true,
      createdAt: date,
    });
  }

  // Create entries
  for (const entry of entriesData) {
    await prisma.carbonEntry.create({ data: entry });
  }

  console.log(`Seeded ${entriesData.length} carbon entries.`);

  // Create token transactions
  const transactions = [
    {
      userId: user.id,
      action: 'walked_instead_of_car',
      amountECO: 50,
      transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    },
    {
      userId: user.id,
      action: 'carpool',
      amountECO: 100,
      transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef12345678',
    },
    {
      userId: user.id,
      action: 'monthly_goal',
      amountECO: 500,
      transactionHash: '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
    },
  ];

  for (const tx of transactions) {
    await prisma.tokenTransaction.create({ data: tx });
  }

  console.log(`Seeded ${transactions.length} token transactions.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
