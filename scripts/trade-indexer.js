// Usage:
//   POSTGRES_URL is used by the API (not by this script).
//   This script needs: RPC_URL, INGEST_ENDPOINT, PREDICTION_MARKET_ADDRESS.
//   node scripts/trade-indexer.js

import { ethers } from 'ethers';

let processTradeEvent = null;
let prisma = null;
let disconnectPrisma = null;
let upsertMarketMetadata = null;
let markMarketResolved = null;

const toDateFromBn = (bn) => {
  if (!bn) return null;
  if (bn.toNumber === undefined) {
    const asNumber = Number(bn);
    if (!Number.isFinite(asNumber) || asNumber === 0) {
      return null;
    }
    return new Date(asNumber * 1000);
  }
  if (bn.isZero && bn.isZero()) {
    return null;
  }
  const num = bn.toNumber();
  if (!Number.isFinite(num) || num === 0) {
    return null;
  }
  return new Date(num * 1000);
};

// Minimal ABI fragments for events we're ingesting
const ABI = [
  // Events
  "event SharesPurchased(uint256 indexed marketId, address indexed buyer, bool isYes, uint256 shares, uint256 cost, uint256 newPrice)",
  "event SharesSold(uint256 indexed marketId, address indexed seller, bool isYes, uint256 shares, uint256 payout, uint256 newPrice)",
  "event MarketCreated(uint256 indexed marketId, address indexed creator, string question, string category, uint256 endTime)",
  "event MarketResolved(uint256 indexed marketId, uint8 outcome, uint256 totalPayout)",
  // Read functions
  "function getMarket(uint256 marketId) view returns (tuple(uint256 id,string question,string description,string category,uint256 endTime,uint256 resolutionTime,bool resolved,uint8 outcome,uint256 totalYesShares,uint256 totalNoShares,uint256 totalVolume,address creator,uint256 createdAt,bool active,uint256 lastTradedPrice,uint256 yesBidPrice,uint256 yesAskPrice,uint256 noBidPrice,uint256 noAskPrice))",
  "function getCurrentPrice(uint256 marketId, bool isYes) view returns (uint256)",
  "function getActiveMarkets() view returns (uint256[])"
];

async function main() {
  const rpcUrl = process.env.RPC_URL;
  const ingestEndpoint = process.env.INGEST_ENDPOINT;
  const contractAddress = process.env.PREDICTION_MARKET_ADDRESS;

  if (!rpcUrl || !contractAddress) {
    console.error('Missing env. Set RPC_URL and PREDICTION_MARKET_ADDRESS');
    process.exit(1);
  }

  ({ default: processTradeEvent } = await import('../lib/processTradeEvent.js'));
  ({ upsertMarketMetadata, markMarketResolved } = await import('../lib/processMarketEvent.js'));
  const prismaModule = await import('../lib/prismaClient.js');
  prisma = prismaModule.default;
  ({ disconnectPrisma } = prismaModule);

  const useApiIngest = Boolean(ingestEndpoint);

  if (!useApiIngest) {
    console.log('ℹ️  No INGEST_ENDPOINT provided. Writing trades directly via Prisma.');
  }

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(contractAddress, ABI, provider);

  const postIngest = async (payload) => {
    if (useApiIngest) {
      const res = await fetch(ingestEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const text = await res.text();
        console.error('Ingest failed', res.status, text);
      }
      return;
    }

    await processTradeEvent({
      ...payload,
      blockTime: new Date(Number(payload.blockTime) * 1000)
    });
  };

  contract.on('SharesPurchased', async (marketId, buyer, isYes, shares, cost, newPrice, event) => {
    try {
      const block = await event.getBlock();
      const payload = {
        event: 'SharesPurchased',
        txHash: event.transactionHash,
        logIndex: event.logIndex,
        marketId: marketId.toString(),
        trader: buyer,
        isYes: Boolean(isYes),
        sharesWei: shares.toString(),
        priceBps: Number(ethers.BigNumber.from(newPrice).toString()),
        costWei: cost.toString(),
        blockNumber: event.blockNumber,
        blockTime: Math.floor(block.timestamp)
      };
      if (useApiIngest) {
        await postIngest(payload);
      } else {
        await processTradeEvent({
          ...payload,
          blockTime: new Date(Number(payload.blockTime) * 1000)
        });
      }
    } catch (e) {
      console.error('Failed to process SharesPurchased', e);
    }
  });

  contract.on('SharesSold', async (marketId, seller, isYes, shares, payout, newPrice, event) => {
    try {
      const block = await event.getBlock();
      const payload = {
        event: 'SharesSold',
        txHash: event.transactionHash,
        logIndex: event.logIndex,
        marketId: marketId.toString(),
        trader: seller,
        isYes: Boolean(isYes),
        sharesWei: shares.toString(),
        priceBps: Number(ethers.BigNumber.from(newPrice).toString()),
        costWei: payout.toString(),
        blockNumber: event.blockNumber,
        blockTime: Math.floor(block.timestamp)
      };
      if (useApiIngest) {
        await postIngest(payload);
      } else {
        await processTradeEvent({
          ...payload,
          blockTime: new Date(Number(payload.blockTime) * 1000)
        });
      }
    } catch (e) {
      console.error('Failed to process SharesSold', e);
    }
  });

  contract.on('MarketCreated', async (marketIdBn, creator, question, category, endTimeBn, event) => {
    try {
      const block = await event.getBlock();
      let description = null;
      let resolutionTime = null;
      let totalYesShares = '0';
      let totalNoShares = '0';
      let totalVolume = '0';
      let endTime = toDateFromBn(endTimeBn);
      const marketId = marketIdBn.toString();

      try {
        const marketStruct = await contract.getMarket(marketIdBn);
        description = marketStruct.description;
        if (marketStruct.resolutionTime && marketStruct.resolutionTime.toNumber) {
          const resTs = Number(marketStruct.resolutionTime.toString());
          resolutionTime = resTs ? new Date(resTs * 1000) : null;
        }
        totalYesShares = marketStruct.totalYesShares?.toString?.() ?? '0';
        totalNoShares = marketStruct.totalNoShares?.toString?.() ?? '0';
        totalVolume = marketStruct.totalVolume?.toString?.() ?? '0';
        if (!endTime && marketStruct.endTime) {
          const endTs = Number(marketStruct.endTime.toString());
          endTime = endTs ? new Date(endTs * 1000) : null;
        }
      } catch (err) {
        console.warn('Unable to load market struct for MarketCreated', err.message);
      }

      const blockDate = new Date(block.timestamp * 1000);
      const marketIdBigInt = BigInt(marketId);
      const snapshotTimestamp = new Date(blockDate.getTime() + (event.logIndex ?? 0));

      await upsertMarketMetadata({
        marketId,
        question,
        description,
        category,
        endTime: endTime ?? blockDate,
        resolutionTime,
        creator,
        totalYesShares,
        totalNoShares,
        totalVolume,
        blockTime: blockDate
      });
      console.log(`Market ${marketId.toString()} metadata stored.`);

      if (prisma) {
        try {
          await prisma.priceSnapshot.create({
            data: {
              marketId: marketIdBigInt,
              intervalStart: snapshotTimestamp,
              yesPriceBps: 5000,
              noPriceBps: 5000,
              tradeCount: 0,
              totalVolumeWei: '0'
            }
          });
        } catch (err) {
          console.warn('Failed to seed initial snapshot', err.message);
        }
      }
    } catch (err) {
      console.error('Failed to process MarketCreated', err);
    }
  });

  contract.on('MarketResolved', async (marketId, outcome, totalPayout, event) => {
    try {
      const block = await event.getBlock();
      await markMarketResolved({
        marketId: marketId.toString(),
        outcome: outcome.toNumber(),
        blockTime: new Date(block.timestamp * 1000)
      });
      console.log(`Market ${marketId.toString()} marked resolved.`);
    } catch (err) {
      console.error('Failed to process MarketResolved', err);
    }
  });

  console.log('Trade indexer listening for events...');

  process.on('SIGINT', async () => {
    console.log('Shutting down indexer...');
    if (disconnectPrisma) {
      await disconnectPrisma();
    }
    process.exit(0);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
