import prisma from '../lib/prismaClient.js';

async function clearPriceSnapshots() {
  try {
    console.log('🗑️  Clearing all price snapshots from database...');
    
    const deleted = await prisma.priceSnapshot.deleteMany({});
    
    console.log(`✅ Deleted ${deleted.count} price snapshots`);
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error clearing price snapshots:', error);
    process.exit(1);
  }
}

clearPriceSnapshots();

