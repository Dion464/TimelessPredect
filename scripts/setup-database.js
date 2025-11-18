#!/usr/bin/env node

/**
 * Setup database - Create price_snapshots table
 * Run: node scripts/setup-database.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function setupDatabase() {
  console.log('🗄️  Setting up database...\n');

  try {
    // Check if table already exists
    console.log('📋 Checking if price_snapshots table exists...');
    
    const tableCheck = await prisma.$queryRaw`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'price_snapshots'
    `;
    
    const tableExists = tableCheck[0].count > 0;
    
    if (tableExists) {
      console.log('✅ Table already exists!');
      
      // Check how many records
      const recordCount = await prisma.priceSnapshot.count();
      console.log(`📊 Found ${recordCount} existing price snapshots\n`);
      
      if (recordCount === 0) {
        console.log('💡 Tip: The table is empty. Prices will be recorded automatically when:');
        console.log('   1. You visit a market page');
        console.log('   2. Prices change on the blockchain');
        console.log('   3. Trades are executed\n');
      }
      
      return;
    }

    console.log('⚠️  Table does not exist. Creating...\n');

    // Create the table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "price_snapshots" (
          "id" BIGSERIAL PRIMARY KEY,
          "market_id" BIGINT NOT NULL,
          "yes_price_bps" INTEGER NOT NULL,
          "no_price_bps" INTEGER NOT NULL,
          "block_number" BIGINT,
          "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;

    console.log('✅ Created price_snapshots table');

    // Create index
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "price_snapshots_market_timestamp_idx" 
      ON "price_snapshots"("market_id", "timestamp")
    `;

    console.log('✅ Created indexes');
    console.log('\n🎉 Database setup complete!\n');
    console.log('📝 Next steps:');
    console.log('   1. Start the API server: node api-server.js');
    console.log('   2. Visit a market page');
    console.log('   3. Prices will be recorded automatically\n');

  } catch (error) {
    console.error('❌ Error setting up database:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Check DATABASE_URL in .env file');
    console.error('   2. Ensure database is accessible');
    console.error('   3. Verify PostgreSQL permissions\n');
    process.exit(1);
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('🚀 DATABASE SETUP TOOL');
  console.log('='.repeat(60));
  console.log('');

  await setupDatabase();
}

main()
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

