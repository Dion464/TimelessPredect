import { ethers } from 'ethers';
import prisma from '../lib/prismaClient.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get current prices from chain and store them in DB
async function seedCurrentPrices() {
  try {
    console.log('🌱 Seeding current prices from blockchain to database...');
    
    // Connect to local hardhat node
    const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
    
    // Get contract addresses and ABI from deployment
    let predictionMarketAddress;
    let predictionMarketABI;
    
    // Try to load from deployment file
    try {
      const deploymentFile = path.join(__dirname, '../contracts/deployments/eth-1337.json');
      if (fs.existsSync(deploymentFile)) {
        const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
        predictionMarketAddress = deployment.predictionMarket || deployment.ETHPredictionMarket;
      }
    } catch (err) {
      console.log('Could not load deployment file, using hardcoded address');
    }
    
    // Fallback to hardcoded address from console logs
    if (!predictionMarketAddress) {
      predictionMarketAddress = '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707'; // From console logs
    }
    
    // Load ABI
    const artifactsPath = path.join(__dirname, '../contracts/artifacts/contracts');
    const predictionMarketArtifact = fs.readFileSync(
      path.join(artifactsPath, 'ETHPredictionMarket.sol/ETHPredictionMarket.json'),
      'utf8'
    );
    predictionMarketABI = JSON.parse(predictionMarketArtifact).abi;
    
    const predictionMarket = new ethers.Contract(predictionMarketAddress, predictionMarketABI, provider);
    
    // Get active markets
    const activeMarketIds = await predictionMarket.getActiveMarkets();
    
    console.log(`Found ${activeMarketIds.length} active markets`);
    
    const now = new Date();
    const intervalStart = new Date(now);
    intervalStart.setMinutes(0, 0, 0); // Round to start of hour
    
    for (const marketId of activeMarketIds) {
      try {
        // Get current prices from chain
        const yesPriceBps = await predictionMarket.getCurrentPrice(marketId, true);
        const noPriceBps = await predictionMarket.getCurrentPrice(marketId, false);
        
        const yesPriceBpsNum = parseFloat(yesPriceBps.toString());
        const noPriceBpsNum = parseFloat(noPriceBps.toString());
        
        console.log(`Market ${marketId.toString()}: YES=${yesPriceBpsNum/100}¢, NO=${noPriceBpsNum/100}¢`);
        
        // Store in database
        await prisma.priceSnapshot.upsert({
          where: {
            marketId_intervalStart: {
              marketId: BigInt(marketId.toString()),
              intervalStart: intervalStart
            }
          },
          update: {
            yesPriceBps: yesPriceBpsNum,
            noPriceBps: noPriceBpsNum,
            updatedAt: now
          },
          create: {
            marketId: BigInt(marketId.toString()),
            intervalStart: intervalStart,
            yesPriceBps: yesPriceBpsNum,
            noPriceBps: noPriceBpsNum,
            tradeCount: 0,
            totalVolumeWei: '0'
          }
        });
        
        console.log(`✅ Stored prices for market ${marketId.toString()}`);
      } catch (err) {
        console.error(`❌ Error processing market ${marketId.toString()}:`, err.message);
      }
    }
    
    console.log('✅ Finished seeding current prices');
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error seeding prices:', error);
    process.exit(1);
  }
}

seedCurrentPrices();

