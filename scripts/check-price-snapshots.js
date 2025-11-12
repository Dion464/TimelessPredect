import prisma from '../lib/prismaClient.js';

async function checkPriceSnapshots() {
  try {
    console.log('📊 Checking price snapshots for market 1...');
    
    const snapshots = await prisma.priceSnapshot.findMany({
      where: {
        marketId: BigInt(1)
      },
      orderBy: {
        intervalStart: 'desc'
      },
      take: 10
    });
    
    console.log(`\nFound ${snapshots.length} snapshots:\n`);
    
    snapshots.forEach((s, i) => {
      console.log(`${i + 1}. ${s.intervalStart.toISOString()}`);
      console.log(`   YES: ${(s.yesPriceBps / 100).toFixed(2)}¢ (${s.yesPriceBps} bps)`);
      console.log(`   NO:  ${(s.noPriceBps / 100).toFixed(2)}¢ (${s.noPriceBps} bps)`);
      console.log(`   Updated: ${s.updatedAt.toISOString()}\n`);
    });
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkPriceSnapshots();

