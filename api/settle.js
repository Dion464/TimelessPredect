export const config = { runtime: 'nodejs' };

import { ethers } from 'ethers';
import { getOrderBook } from '../lib/orderBook.js';
import { verifyOrderSignature } from '../lib/eip712.js';
import prisma from '../lib/prismaClient.js';
import 'dotenv/config';

const EXCHANGE_CONTRACT = process.env.EXCHANGE_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000';
const PREDICTION_MARKET_ADDRESS = process.env.ETHPREDICTIONMARKET_ADDRESS || '0x0000000000000000000000000000000000000000';
const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '1337', 10);

const orderBook = getOrderBook();

// Exchange contract ABI (minimal for fillOrder)
const EXCHANGE_ABI = [
  "function fillOrder(tuple(address maker, uint256 marketId, uint256 outcomeId, uint256 price, uint256 size, bool side, uint256 expiry, uint256 salt) makerOrder, uint256 takerSize) returns (bool)",
  "event OrderFilled(bytes32 indexed orderHash, address indexed maker, address indexed taker, uint256 marketId, uint256 outcomeId, uint256 price, uint256 size, uint256 fee)"
];

// ETHPredictionMarket contract ABI for fetching prices
const PREDICTION_MARKET_ABI = [
  "function calculatePrice(uint256 _marketId) external view returns (uint256 yesPrice, uint256 noPrice)"
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST required' });
  }

  try {
    const { makerOrder, takerOrder, fillSize, signatures } = req.body;

    if (!makerOrder || !takerOrder || !fillSize || !signatures) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify both signatures
    const makerValid = verifyOrderSignature(
      makerOrder,
      signatures.maker,
      CHAIN_ID,
      EXCHANGE_CONTRACT
    );

    const takerValid = verifyOrderSignature(
      takerOrder,
      signatures.taker,
      CHAIN_ID,
      EXCHANGE_CONTRACT
    );

    if (!makerValid || !takerValid) {
      return res.status(401).json({ error: 'Invalid signatures' });
    }

    // Check orders are compatible
    if (makerOrder.side === takerOrder.side) {
      return res.status(400).json({ error: 'Orders must be opposite sides' });
    }

    if (makerOrder.marketId !== takerOrder.marketId || 
        makerOrder.outcomeId !== takerOrder.outcomeId) {
      return res.status(400).json({ error: 'Orders must be for same market/outcome' });
    }

    // Initialize provider and contract
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const exchangeContract = new ethers.Contract(
      EXCHANGE_CONTRACT,
      EXCHANGE_ABI,
      provider
    );

    // Get private key for settlement (from env - should be a relayer account)
    const SETTLEMENT_PRIVATE_KEY = process.env.SETTLEMENT_PRIVATE_KEY;
    if (!SETTLEMENT_PRIVATE_KEY) {
      return res.status(500).json({ error: 'Settlement key not configured' });
    }

    const wallet = new ethers.Wallet(SETTLEMENT_PRIVATE_KEY, provider);

    // Prepare order struct for contract
    const makerOrderStruct = {
      maker: makerOrder.maker,
      marketId: makerOrder.marketId,
      outcomeId: makerOrder.outcomeId,
      price: makerOrder.price,
      size: makerOrder.size,
      side: makerOrder.side,
      expiry: makerOrder.expiry,
      salt: makerOrder.salt
    };

    // Call fillOrder on-chain
    const contractWithSigner = exchangeContract.connect(wallet);
    
    console.log(`🔵 Settling trade: ${fillSize} @ ${makerOrder.price} ticks`);
    
    const tx = await contractWithSigner.fillOrder(
      makerOrderStruct,
      fillSize,
      { gasLimit: 500000 }
    );

    console.log(`⏳ Transaction sent: ${tx.hash}`);

    // Wait for confirmation
    const receipt = await tx.wait();
    console.log(`✅ Trade settled: ${receipt.transactionHash}`);

    // Update order book
    const makerOrderId = orderBook.findOrderId(makerOrder);
    const takerOrderId = orderBook.findOrderId(takerOrder);

    if (makerOrderId) {
      orderBook.fillOrder(makerOrderId, fillSize);
    }
    if (takerOrderId) {
      orderBook.fillOrder(takerOrderId, fillSize);
    }

    // Record price snapshot to database after settlement
    try {
      const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
      const predictionMarketContract = new ethers.Contract(
        PREDICTION_MARKET_ADDRESS,
        PREDICTION_MARKET_ABI,
        provider
      );

      // Fetch current prices from the contract
      const marketId = BigInt(makerOrder.marketId);
      const [yesPriceBps, noPriceBps] = await predictionMarketContract.calculatePrice(marketId);
      
      let yesPriceBpsInt = Math.round(Number(yesPriceBps));
      let noPriceBpsInt = Math.round(Number(noPriceBps));

      // Validate prices - ensure they're reasonable (between 10 bps = 0.1% and 9990 bps = 99.9%)
      // Prices outside this range are likely errors and should not be stored
      if (yesPriceBpsInt < 10 || yesPriceBpsInt > 9990 || noPriceBpsInt < 10 || noPriceBpsInt > 9990) {
        console.warn('⚠️  Invalid prices detected, skipping price snapshot:', {
          marketId: marketId.toString(),
          yesPriceBps: yesPriceBpsInt,
          noPriceBps: noPriceBpsInt,
          txHash: receipt.transactionHash
        });
        // Don't store invalid prices - skip price snapshot
        return res.status(200).json({
          success: true,
          txHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
          message: 'Trade settled on-chain (price snapshot skipped due to invalid prices)'
        });
      }

      // Ensure YES + NO = 10000 (within rounding tolerance)
      const total = yesPriceBpsInt + noPriceBpsInt;
      if (Math.abs(total - 10000) > 100) { // Allow 1% tolerance for rounding
        console.warn('⚠️  Price sum mismatch, normalizing:', {
          yesPriceBps: yesPriceBpsInt,
          noPriceBps: noPriceBpsInt,
          total: total
        });
        // Normalize to ensure they sum to 10000
        const scale = 10000 / total;
        yesPriceBpsInt = Math.round(yesPriceBpsInt * scale);
        noPriceBpsInt = 10000 - yesPriceBpsInt;
      }

      console.log('📊 Recording price snapshot after settlement:', {
        marketId: marketId.toString(),
        yesPriceBps: yesPriceBpsInt,
        noPriceBps: noPriceBpsInt,
        yesPricePercent: (yesPriceBpsInt / 100).toFixed(2),
        noPricePercent: (noPriceBpsInt / 100).toFixed(2),
        txHash: receipt.transactionHash
      });

      // Ensure Market record exists (required for foreign key constraint)
      try {
        const existingMarket = await prisma.market.findUnique({
          where: { marketId: marketId }
        });

        if (!existingMarket) {
          console.log(`📝 Creating Market record for marketId ${marketId.toString()} (required for price snapshot)`);
          await prisma.market.create({
            data: {
              marketId: marketId,
              question: `Market ${marketId.toString()}`,
              description: null,
              category: null,
              resolved: false,
              totalYesSharesWei: '0',
              totalNoSharesWei: '0',
              totalVolumeWei: '0',
              createdAt: new Date()
            }
          });
          console.log(`✅ Market record created for marketId ${marketId.toString()}`);
        }
      } catch (marketError) {
        // If market creation fails, check if it's because it already exists (race condition)
        if (marketError.code !== 'P2002') {
          console.error('⚠️  Failed to ensure Market record exists:', marketError);
          // Continue anyway - might already exist from concurrent request
        }
      }

      // Use transaction timestamp for price snapshot
      const block = await provider.getBlock(receipt.blockNumber);
      const priceSnapshotTime = new Date(block.timestamp * 1000);

      // Create price snapshot with unique timestamp
      let attempts = 0;
      const maxAttempts = 10;
      let snapshotTime = priceSnapshotTime;

      while (attempts < maxAttempts) {
        try {
          await prisma.priceSnapshot.create({
            data: {
              marketId: marketId,
              intervalStart: snapshotTime,
              yesPriceBps: yesPriceBpsInt,
              noPriceBps: noPriceBpsInt,
              tradeCount: 1,
              totalVolumeWei: fillSize.toString()
            }
          });
          console.log('✅ Price snapshot recorded after settlement');
          break;
        } catch (err) {
          if (err.code === 'P2002') { // Unique constraint violation
            attempts++;
            snapshotTime = new Date(snapshotTime.getTime() + 1);
            continue;
          }
          throw err;
        }
      }
    } catch (priceError) {
      console.error('⚠️  Failed to record price snapshot after settlement:', priceError);
      // Don't fail the settlement if price recording fails
    }

    return res.status(200).json({
      success: true,
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      message: 'Trade settled on-chain'
    });

  } catch (error) {
    console.error('Error settling trade:', error);
    
    // Provide helpful error messages
    let errorMessage = error.message;
    if (error.code === 'INSUFFICIENT_FUNDS') {
      errorMessage = 'Relayer account has insufficient funds for gas';
    } else if (error.code === 'CALL_EXCEPTION') {
      errorMessage = 'Contract call failed - check order validity';
    }

    return res.status(500).json({ 
      error: errorMessage,
      details: error.code || 'Unknown error'
    });
  }
}

