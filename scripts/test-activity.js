// Quick test script to insert a sample activity event
// Usage: node scripts/test-activity.js

const prisma = require('../lib/prismaClient');

async function testActivity() {
  try {
    // First, get an existing market ID (or use a specific one)
    const market = await prisma.market.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!market) {
      console.error('❌ No markets found. Create a market first.');
      process.exit(1);
    }

    console.log(`✅ Using market ID: ${market.marketId}`);

    // Insert a test activity event
    const activityEvent = await prisma.activityEvent.create({
      data: {
        marketId: market.marketId,
        userAddress: '0x1234567890123456789012345678901234567890', // Test address
        eventType: 'ORDER_FILLED',
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        blockNumber: BigInt(12345678),
        blockTime: new Date(),
        description: 'Test trade activity',
        metadata: {
          // These fields are used by the frontend
          action: 'bought', // or 'sold'
          side: 'Yes', // or 'No', 'Up', 'Down'
          priceCents: 64, // Price in cents (64 = 64¢)
          notionalUsd: 1.5, // Total trade value in USD
          txUrl: 'https://basescan.org/tx/0xabcdef...', // Optional: custom transaction URL
          avatarGradient: 'from-[#FF9900] to-[#FF5E00]', // Optional: custom gradient
          timestampLabel: 'now', // or '2m ago', '1h ago', etc.
        },
      },
    });

    console.log('✅ Activity event created:', {
      id: activityEvent.id.toString(),
      marketId: activityEvent.marketId.toString(),
      eventType: activityEvent.eventType,
      userAddress: activityEvent.userAddress,
    });

    console.log('\n📋 What gets saved in activity_events:');
    console.log('  - marketId: The market this activity relates to (required)');
    console.log('  - userAddress: Wallet address of the user (optional)');
    console.log('  - eventType: One of:');
    console.log('      MARKET_CREATED, ORDER_PLACED, ORDER_FILLED,');
    console.log('      POSITION_UPDATED, MARKET_RESOLVED, LIQUIDITY_ADDED, LIQUIDITY_REMOVED');
    console.log('  - txHash: Transaction hash (optional)');
    console.log('  - blockNumber: Block number (optional)');
    console.log('  - blockTime: Block timestamp (optional)');
    console.log('  - description: Text description (optional)');
    console.log('  - metadata: JSON object with UI data:');
    console.log('      - action: "bought" or "sold"');
    console.log('      - side: "Yes", "No", "Up", "Down"');
    console.log('      - priceCents: Price in cents (64 = 64¢)');
    console.log('      - notionalUsd: Trade value in USD');
    console.log('      - txUrl: Link to transaction (optional)');
    console.log('      - avatarGradient: Tailwind gradient class (optional)');
    console.log('      - timestampLabel: Display text like "now", "2m ago" (optional)');

    console.log('\n🌐 Now check your activity page - it should show this event!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'P2003') {
      console.error('   This usually means the marketId does not exist.');
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testActivity();

