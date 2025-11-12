import prisma from './prismaClient.js';

function toBigInt(value, label) {
  try {
    return BigInt(value);
  } catch (err) {
    throw new Error(`Invalid ${label}`);
  }
}

export async function upsertMarketMetadata(data) {
  const {
    marketId,
    question = null,
    description = null,
    category = null,
    endTime = null,
    resolutionTime = null,
    creator = null,
    totalYesShares = '0',
    totalNoShares = '0',
    totalVolume = '0',
    blockTime = null
  } = data;

  const marketKey = { marketId: toBigInt(marketId, 'marketId') };

  const baseData = {
    question,
    description,
    category,
    endTime,
    resolutionTime,
    creator,
    totalYesSharesWei: String(totalYesShares),
    totalNoSharesWei: String(totalNoShares),
    totalVolumeWei: String(totalVolume),
  };

  const createdAt = blockTime instanceof Date ? blockTime : (blockTime ? new Date(blockTime) : undefined);

  const existing = await prisma.market.findUnique({
    where: marketKey,
    select: { marketId: true }
  });

  if (existing) {
    await prisma.market.update({
      where: marketKey,
      data: baseData
    });
    return;
  }

  await prisma.market.create({
    data: {
      marketId: marketKey.marketId,
      ...baseData,
      createdAt: createdAt ?? new Date()
    }
  });
}

export async function markMarketResolved({ marketId, outcome, blockTime = null }) {
  const marketKey = { marketId: toBigInt(marketId, 'marketId') };
  await prisma.market.update({
    where: marketKey,
    data: {
      resolved: true,
      outcome: outcome ?? null,
      resolutionTime: blockTime instanceof Date ? blockTime : (blockTime ? new Date(blockTime) : undefined)
    }
  });
}

export default {
  upsertMarketMetadata,
  markMarketResolved,
};
