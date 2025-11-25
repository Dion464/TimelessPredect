const { PrismaClient } = require('@prisma/client');

// Load DATABASE_URL from .env file manually
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  lines.forEach(line => {
    const match = line.match(/^DATABASE_URL=(.+)$/);
    if (match) {
      process.env.DATABASE_URL = match[1].trim().replace(/^["']|["']$/g, '');
    }
  });
}

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in .env file');
  process.exit(1);
}

const prisma = new PrismaClient();

async function clearDatabase() {
  try {
    console.log('🗑️  Starting database cleanup...\n');

    // Delete in order to respect foreign key constraints
    console.log('Deleting price snapshots...');
    const priceSnapshots = await prisma.priceSnapshot.deleteMany({});
    console.log(`✅ Deleted ${priceSnapshots.count} price snapshots`);

    console.log('Deleting notifications...');
    const notifications = await prisma.notification.deleteMany({});
    console.log(`✅ Deleted ${notifications.count} notifications`);

    console.log('Deleting pending markets...');
    const pendingMarkets = await prisma.pendingMarket.deleteMany({});
    console.log(`✅ Deleted ${pendingMarkets.count} pending markets`);

    console.log('Deleting order fills...');
    const orderFills = await prisma.orderFill.deleteMany({});
    console.log(`✅ Deleted ${orderFills.count} order fills`);

    console.log('Deleting orders...');
    const orders = await prisma.order.deleteMany({});
    console.log(`✅ Deleted ${orders.count} orders`);

    console.log('Deleting positions...');
    const positions = await prisma.position.deleteMany({});
    console.log(`✅ Deleted ${positions.count} positions`);

    console.log('Deleting trades...');
    const trades = await prisma.trade.deleteMany({});
    console.log(`✅ Deleted ${trades.count} trades`);

    console.log('Deleting markets...');
    const markets = await prisma.market.deleteMany({});
    console.log(`✅ Deleted ${markets.count} markets`);

    console.log('\n✨ Database cleared successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Markets: ${markets.count}`);
    console.log(`   - Trades: ${trades.count}`);
    console.log(`   - Positions: ${positions.count}`);
    console.log(`   - Orders: ${orders.count}`);
    console.log(`   - Order Fills: ${orderFills.count}`);
    console.log(`   - Pending Markets: ${pendingMarkets.count}`);
    console.log(`   - Notifications: ${notifications.count}`);
    console.log(`   - Price Snapshots: ${priceSnapshots.count}`);
    console.log('\n🎉 Ready for fresh data!');

  } catch (error) {
    console.error('❌ Error clearing database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

clearDatabase();

