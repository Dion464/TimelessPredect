const path = require('path');
const { PrismaClient } = require('@prisma/client');

// Use the correct prisma schema path
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'file:./prisma/dev.db'
    }
  }
});

async function seedPriceHistory(marketId, hoursBack = 24) {
  console.log(`🌱 Seeding price history for market ${marketId}...`);
  
  const now = new Date();
  const snapshots = [];
  
  // Generate price data with realistic movement
  let currentYesPrice = 5000; // Start at 50%
  let currentNoPrice = 5000;  // Start at 50%
  
  // Generate snapshots going back in time
  for (let i = hoursBack * 12; i >= 0; i--) { // Every 5 minutes
    const timestamp = new Date(now.getTime() - (i * 5 * 60 * 1000));
    
    // Add some random price movement (±50 basis points)
    const change = Math.floor(Math.random() * 100) - 50;
    currentYesPrice = Math.max(1000, Math.min(9000, currentYesPrice + change));
    currentNoPrice = 10000 - currentYesPrice;
    
    snapshots.push({
      marketId: BigInt(marketId),
      yesPriceBps: Math.round(currentYesPrice),
      noPriceBps: Math.round(currentNoPrice),
      timestamp: timestamp
    });
  }
  
  // Insert all snapshots
  console.log(`📊 Inserting ${snapshots.length} price snapshots...`);
  
  for (const snapshot of snapshots) {
    await prisma.priceSnapshot.create({
      data: snapshot
    });
  }
  
  console.log(`✅ Successfully seeded ${snapshots.length} price snapshots for market ${marketId}`);
}

async function main() {
  const marketId = process.argv[2] || '1';
  const hoursBack = parseInt(process.argv[3]) || 24;
  
  console.log(`Market ID: ${marketId}`);
  console.log(`Hours back: ${hoursBack}`);
  
  await seedPriceHistory(marketId, hoursBack);
}

main()
  .catch((e) => {
    console.error('Error seeding price history:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

