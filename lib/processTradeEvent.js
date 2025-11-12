import prisma from './prismaClient.js';
import { ethers } from 'ethers';
import 'dotenv/config';

export const SUPPORTED_EVENTS = new Set(['SharesPurchased', 'SharesSold']);

// ABI for fetching prices from contract
const PREDICTION_MARKET_ABI = [
  "function calculatePrice(uint256 _marketId) external view returns (uint256 yesPrice, uint256 noPrice)"
];

const PREDICTION_MARKET_ADDRESS = process.env.ETHPREDICTIONMARKET_ADDRESS || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';

function toBigInt(value, label) {
  try {
    return BigInt(value);
  } catch (err) {
    throw new Error(`Invalid ${label}`);
  }
}

function normalizeBlockTime(input) {
  if (input instanceof Date) {
    return input;
  }
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid blockTime');
  }
  return date;
}

export async function processTradeEvent(evt) {
  if (!SUPPORTED_EVENTS.has(evt.event)) {
    throw new Error(`Unsupported event type ${evt.event}`);
  }

  const tradeType = evt.event === 'SharesPurchased' ? 'BUY' : 'SELL';
  const normalizedTrader = evt.trader.toLowerCase();
  const marketId = toBigInt(evt.marketId, 'marketId');
  const blockNumber = toBigInt(evt.blockNumber, 'blockNumber');
  const shares = toBigInt(evt.sharesWei, 'sharesWei');
  const value = toBigInt(evt.costWei, 'costWei');
  const signedShareChange = tradeType === 'BUY' ? shares : -shares;
  const investedDelta = tradeType === 'BUY' ? value : -value;
  const volumeDelta = value < 0n ? -value : value;
  const blockTime = normalizeBlockTime(evt.blockTime);
  
  // ALWAYS fetch current market prices from contract - don't trust event priceBps
  // Event priceBps might be the execution price for that trade, not the current market price
  let yesPriceBps = null;
  let noPriceBps = null;
  
  try {
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(PREDICTION_MARKET_ADDRESS, PREDICTION_MARKET_ABI, provider);
    const [yesPrice, noPrice] = await contract.calculatePrice(marketId);
    yesPriceBps = Math.round(Number(yesPrice));
    noPriceBps = Math.round(Number(noPrice));
    
    // Validate fetched prices - must be between 10 bps (0.1%) and 9990 bps (99.9%)
    if (yesPriceBps < 10 || yesPriceBps > 9990 || noPriceBps < 10 || noPriceBps > 9990) {
      console.error('❌ Contract returned invalid prices, skipping price snapshot:', {
        marketId: marketId.toString(),
        yesPriceBps,
        noPriceBps,
        yesPricePercent: (yesPriceBps / 100).toFixed(2),
        noPricePercent: (noPriceBps / 100).toFixed(2)
      });
      // Skip price snapshot if contract prices are invalid
      yesPriceBps = null;
      noPriceBps = null;
    } else {
      // Ensure YES + NO = 10000 (within rounding tolerance)
      const total = yesPriceBps + noPriceBps;
      if (Math.abs(total - 10000) > 100) { // Allow 1% tolerance
        console.warn('⚠️  Price sum mismatch, normalizing:', {
          yesPriceBps,
          noPriceBps,
          total
        });
        // Normalize to ensure they sum to 10000
        const scale = 10000 / total;
        yesPriceBps = Math.round(yesPriceBps * scale);
        noPriceBps = 10000 - yesPriceBps;
      }
      
      console.log('✅ Fetched valid market prices from contract:', {
        marketId: marketId.toString(),
        yesPriceBps,
        noPriceBps,
        yesPricePercent: (yesPriceBps / 100).toFixed(2),
        noPricePercent: (noPriceBps / 100).toFixed(2),
        sum: yesPriceBps + noPriceBps
      });
    }
  } catch (error) {
    console.error('❌ Error fetching prices from contract:', error);
    // Skip price snapshot if we can't fetch valid prices
    yesPriceBps = null;
    noPriceBps = null;
  }
  
  const snapshotTimestamp = new Date(blockTime.getTime() + (Number(evt.logIndex ?? 0)));

  await prisma.$transaction(async (tx) => {
    const tradeKey = { txHash_logIndex: { txHash: evt.txHash, logIndex: evt.logIndex } };
    const existingTrade = await tx.trade.findUnique({ where: tradeKey, select: { id: true } });

    if (existingTrade) {
      await tx.trade.update({
        where: tradeKey,
        data: { tradeType, trader: normalizedTrader }
      });
      return;
    }

    await tx.trade.create({
      data: {
        txHash: evt.txHash,
        logIndex: evt.logIndex,
        marketId,
        trader: normalizedTrader,
        isYes: Boolean(evt.isYes),
        sharesWei: String(evt.sharesWei),
        priceBps: Number(evt.priceBps),
        costWei: String(evt.costWei),
        tradeType,
        blockNumber,
        blockTime
      }
    });

    const positionKey = { userAddress_marketId: { userAddress: normalizedTrader, marketId } };
    const existingPosition = await tx.position.findUnique({
      where: positionKey,
      select: { yesSharesWei: true, noSharesWei: true, totalInvestedWei: true }
    });

    const yesChange = evt.isYes ? signedShareChange : 0n;
    const noChange = evt.isYes ? 0n : signedShareChange;
    const currentYes = BigInt(existingPosition?.yesSharesWei ?? '0');
    const currentNo = BigInt(existingPosition?.noSharesWei ?? '0');
    const currentInvested = BigInt(existingPosition?.totalInvestedWei ?? '0');

    const nextYes = currentYes + yesChange;
    const nextNo = currentNo + noChange;
    const nextInvested = currentInvested + investedDelta;

    if (nextYes < 0n || nextNo < 0n) {
      throw new Error('Resulting position would be negative');
    }

    const positionData = {
      yesSharesWei: nextYes.toString(),
      noSharesWei: nextNo.toString(),
      totalInvestedWei: nextInvested.toString(),
      updatedAt: new Date()
    };

    if (existingPosition) {
      await tx.position.update({
        where: positionKey,
        data: positionData
      });
    } else {
      await tx.position.create({
        data: {
          userAddress: normalizedTrader,
          marketId,
          ...positionData
        }
      });
    }

    const marketKey = { marketId };
    const existingMarket = await tx.market.findUnique({
      where: marketKey,
      select: {
        totalYesSharesWei: true,
        totalNoSharesWei: true,
        totalVolumeWei: true
      }
    });

    const currentMarketYes = BigInt(existingMarket?.totalYesSharesWei ?? '0');
    const currentMarketNo = BigInt(existingMarket?.totalNoSharesWei ?? '0');
    const currentMarketVolume = BigInt(existingMarket?.totalVolumeWei ?? '0');

    const nextMarketYes = currentMarketYes + yesChange;
    const nextMarketNo = currentMarketNo + noChange;
    const nextMarketVolume = currentMarketVolume + (volumeDelta < 0n ? -volumeDelta : volumeDelta);

    const marketData = {
      totalYesSharesWei: nextMarketYes.toString(),
      totalNoSharesWei: nextMarketNo.toString(),
      totalVolumeWei: nextMarketVolume.toString(),
      lastYesPriceBps: yesPriceBps !== null ? yesPriceBps : undefined,
      lastNoPriceBps: noPriceBps !== null ? noPriceBps : undefined,
      lastTradeBlock: blockNumber,
      lastTradeTxHash: evt.txHash,
      updatedAt: blockTime
    };
    
    // Remove undefined values to avoid overwriting with null
    Object.keys(marketData).forEach(key => {
      if (marketData[key] === undefined) {
        delete marketData[key];
      }
    });

    if (existingMarket) {
      await tx.market.update({
        where: marketKey,
        data: marketData
      });
    } else {
      await tx.market.create({
        data: {
          marketId,
          ...marketData,
          createdAt: blockTime
        }
      });
    }

    // Create price snapshot ONLY if prices are valid
    // Skip price snapshot if prices are invalid (null) to prevent storing bad data
    if (yesPriceBps !== null && noPriceBps !== null) {
      // Create price snapshot with unique timestamp
      // Use logIndex and blockNumber to create unique timestamps
      // Ensure each trade creates a distinct price point
      let priceSnapshotTimestamp = snapshotTimestamp;
      let snapshotAttempts = 0;
      const maxSnapshotAttempts = 1000; // Allow many attempts (very unlikely to need this many)
      
      // Try to create price snapshot with unique timestamp
      while (snapshotAttempts < maxSnapshotAttempts) {
        try {
          // Check if snapshot already exists at this timestamp
          const existing = await tx.priceSnapshot.findUnique({
            where: {
              marketId_intervalStart: {
                marketId,
                intervalStart: priceSnapshotTimestamp
              }
            }
          });
          
          if (existing) {
            // Timestamp already exists, increment and try again
            snapshotAttempts++;
            priceSnapshotTimestamp = new Date(priceSnapshotTimestamp.getTime() + 1);
            continue;
          }
          
          // Create new snapshot with validated prices
          await tx.priceSnapshot.create({
            data: {
              marketId,
              intervalStart: priceSnapshotTimestamp,
              yesPriceBps,
              noPriceBps,
              tradeCount: 1,
              totalVolumeWei: (volumeDelta < 0n ? -volumeDelta : volumeDelta).toString()
            }
          });
          console.log('✅ Price snapshot created with valid prices:', {
            marketId: marketId.toString(),
            yesPriceBps,
            noPriceBps
          });
          break; // Success, exit loop
        } catch (err) {
          if (err.code === 'P2002') { // Unique constraint violation
            snapshotAttempts++;
            // Increment timestamp by 1ms to create unique timestamp
            priceSnapshotTimestamp = new Date(priceSnapshotTimestamp.getTime() + 1);
            continue;
          }
          throw err; // Re-throw if it's not a unique constraint error
        }
      }
      
      if (snapshotAttempts >= maxSnapshotAttempts) {
        throw new Error(`Could not create unique price snapshot after ${maxSnapshotAttempts} attempts for market ${marketId}, trade ${evt.txHash}:${evt.logIndex}`);
      }
    } else {
      console.warn('⚠️  Skipping price snapshot - invalid prices:', {
        marketId: marketId.toString(),
        yesPriceBps,
        noPriceBps,
        txHash: evt.txHash
      });
    }
  });
}

export default processTradeEvent;
