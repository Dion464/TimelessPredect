#!/usr/bin/env node

/**
 * Seed price history data via API endpoint
 * This works regardless of database setup
 */

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001';

async function seedPriceHistory(marketId, hoursBack = 24) {
  console.log(`🌱 Seeding price history for market ${marketId}...`);
  console.log(`📊 Generating ${hoursBack} hours of realistic price data...`);
  
  const now = Date.now();
  const snapshots = [];
  
  // Generate price data with realistic movement
  let currentYesPrice = 5000; // Start at 50%
  
  // Create more data points for smoother lines - every 2 minutes
  const totalPoints = hoursBack * 30; // 30 points per hour (every 2 minutes)
  
  console.log(`📈 Creating ${totalPoints} price snapshots...`);
  
  for (let i = totalPoints; i >= 0; i--) {
    const timestamp = new Date(now - (i * 2 * 60 * 1000)); // Every 2 minutes
    
    // Add realistic price movement with some volatility
    // Prices can move ±100 basis points per update
    const change = Math.floor(Math.random() * 200) - 100;
    currentYesPrice = Math.max(500, Math.min(9500, currentYesPrice + change)); // Keep between 5% and 95%
    
    // Add some trend moments (30% chance of following previous direction)
    if (Math.random() < 0.3) {
      const trendChange = change > 0 ? Math.floor(Math.random() * 50) : -Math.floor(Math.random() * 50);
      currentYesPrice = Math.max(500, Math.min(9500, currentYesPrice + trendChange));
    }
    
    const currentNoPrice = 10000 - currentYesPrice;
    
    snapshots.push({
      marketId: marketId.toString(),
      yesPriceBps: Math.round(currentYesPrice),
      noPriceBps: Math.round(currentNoPrice),
      timestamp: timestamp.toISOString()
    });
  }
  
  console.log(`🚀 Uploading ${snapshots.length} snapshots to API...`);
  
  let successCount = 0;
  let errorCount = 0;
  
  // Upload in batches to avoid overwhelming the API
  const batchSize = 10;
  for (let i = 0; i < snapshots.length; i += batchSize) {
    const batch = snapshots.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (snapshot) => {
      try {
        const response = await fetch(`${API_BASE}/api/record-price`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(snapshot)
        });
        
        if (response.ok) {
          successCount++;
        } else {
          errorCount++;
          const error = await response.text();
          if (errorCount <= 3) { // Only show first 3 errors
            console.log(`⚠️  Error uploading snapshot: ${error}`);
          }
        }
      } catch (error) {
        errorCount++;
        if (errorCount <= 3) {
          console.log(`⚠️  Network error: ${error.message}`);
        }
      }
    }));
    
    // Progress indicator
    const progress = Math.round((i / snapshots.length) * 100);
    process.stdout.write(`\r📊 Progress: ${progress}% (${successCount} success, ${errorCount} errors)`);
    
    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`\n✅ Seeding complete!`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
  
  if (successCount > 0) {
    console.log(`\n🎉 Price history data seeded successfully!`);
    console.log(`   Now refresh your browser to see the chart with historical data.`);
  } else {
    console.log(`\n❌ Failed to seed data. Make sure the API server is running at ${API_BASE}`);
  }
}

async function main() {
  const marketId = process.argv[2] || '1';
  const hoursBack = parseInt(process.argv[3]) || 24;
  
  console.log('='.repeat(60));
  console.log('📊 PRICE HISTORY SEEDING TOOL');
  console.log('='.repeat(60));
  console.log(`Market ID: ${marketId}`);
  console.log(`Hours back: ${hoursBack}`);
  console.log(`API Base: ${API_BASE}`);
  console.log('='.repeat(60));
  console.log('');
  
  // Check if API is available
  try {
    const response = await fetch(`${API_BASE}/api/record-price`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        marketId: marketId.toString(),
        yesPriceBps: 5000,
        noPriceBps: 5000
      })
    });
    
    if (!response.ok && response.status !== 400) { // 400 is okay (validation)
      throw new Error(`API returned status ${response.status}`);
    }
    
    console.log('✅ API server is reachable');
    console.log('');
  } catch (error) {
    console.log(`❌ Cannot reach API server at ${API_BASE}`);
    console.log(`   Error: ${error.message}`);
    console.log('');
    console.log('💡 Make sure the API server is running:');
    console.log('   cd /Users/zs/Desktop/tmlspredict/TimelessPredect');
    console.log('   node api-server.js');
    console.log('');
    process.exit(1);
  }
  
  await seedPriceHistory(marketId, hoursBack);
}

main()
  .catch((e) => {
    console.error('\n❌ Seeding failed:', e.message);
    process.exit(1);
  });

