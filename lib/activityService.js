const prisma = require('./prismaClient');
const { ethers } = require('ethers');

/**
 * Create an activity event in the database
 * @param {Object} params
 * @param {BigInt|string|number} params.marketId - Market ID
 * @param {string} params.eventType - ActivityEventType enum value
 * @param {string} [params.userAddress] - User wallet address
 * @param {string} [params.txHash] - Transaction hash
 * @param {BigInt|string|number} [params.blockNumber] - Block number
 * @param {Date} [params.blockTime] - Block timestamp
 * @param {string} [params.description] - Description text
 * @param {Object} [params.metadata] - Metadata object with UI data
 */
async function createActivityEvent({
  marketId,
  eventType,
  userAddress = null,
  txHash = null,
  blockNumber = null,
  blockTime = null,
  description = null,
  metadata = {},
}) {
  try {
    const marketIdBigInt = typeof marketId === 'bigint' ? marketId : BigInt(marketId);
    
    // Normalize user address to lowercase
    const normalizedUserAddress = userAddress ? userAddress.toLowerCase() : null;
    
    // Normalize block number
    const normalizedBlockNumber = blockNumber 
      ? (typeof blockNumber === 'bigint' ? blockNumber : BigInt(blockNumber))
      : null;

    const activityEvent = await prisma.activityEvent.create({
      data: {
        marketId: marketIdBigInt,
        userAddress: normalizedUserAddress,
        eventType,
        txHash,
        blockNumber: normalizedBlockNumber,
        blockTime,
        description,
        metadata: metadata || {},
      },
    });

    return activityEvent;
  } catch (error) {
    console.error('Failed to create activity event:', error);
    // Don't throw - activity events are non-critical
    return null;
  }
}

/**
 * Create activity event for a buy/sell trade
 * @param {Object} params
 * @param {BigInt|string|number} params.marketId
 * @param {string} params.userAddress
 * @param {boolean} params.isYes - true for YES/Up, false for NO/Down
 * @param {string} params.sharesWei - Shares amount in wei
 * @param {number} params.priceBps - Price in basis points
 * @param {string} params.costWei - Cost/payout in wei
 * @param {string} params.txHash
 * @param {BigInt|string|number} params.blockNumber
 * @param {Date} params.blockTime
 * @param {Object} [params.market] - Market object (optional, for getting question/category)
 */
async function createTradeActivity({
  marketId,
  userAddress,
  isYes,
  sharesWei,
  priceBps,
  costWei,
  txHash,
  blockNumber,
  blockTime,
  market = null,
}) {
  const priceCents = Math.round(priceBps / 100);
  const costEth = parseFloat(ethers.utils.formatEther(costWei));
  const shares = parseFloat(ethers.utils.formatEther(sharesWei));

  // Determine side label based on market type
  let side = isYes ? 'Yes' : 'No';
  if (market?.category === 'crypto') {
    side = isYes ? 'Up' : 'Down';
  }

  // Get market question for description
  const marketQuestion = market?.question || `Market #${marketId}`;

  // Build transaction URL (adjust chain explorer as needed)
  const chainId = process.env.CHAIN_ID || '8453'; // Base mainnet default
  const explorerBase = chainId === '8453' 
    ? 'https://basescan.org'
    : chainId === '84532'
    ? 'https://sepolia.basescan.org'
    : 'https://etherscan.io';
  const txUrl = txHash ? `${explorerBase}/tx/${txHash}` : null;

  // Determine avatar gradient based on category
  let avatarGradient = 'from-[#3B82F6] to-[#06B6D4]'; // Default blue
  if (market?.category === 'crypto') {
    avatarGradient = 'from-[#FF9900] to-[#FF5E00]'; // Orange for crypto
  } else if (market?.category === 'sports') {
    avatarGradient = 'from-[#10B981] to-[#059669]'; // Green for sports
  }

  return await createActivityEvent({
    marketId,
    eventType: 'ORDER_FILLED',
    userAddress,
    txHash,
    blockNumber,
    blockTime,
    description: `${userAddress.slice(0, 8)} ${isYes ? 'bought' : 'sold'} ${side} shares`,
    metadata: {
      action: isYes ? 'bought' : 'sold',
      side,
      priceCents,
      notionalUsd: costEth, // Approximate USD value (1 ETH ≈ $X, adjust if needed)
      txUrl,
      avatarGradient,
      timestampLabel: 'now',
      marketTitle: marketQuestion,
    },
  });
}

/**
 * Create activity event for market creation
 */
async function createMarketCreatedActivity({
  marketId,
  creator,
  question,
  category,
  txHash,
  blockNumber,
  blockTime,
}) {
  return await createActivityEvent({
    marketId,
    eventType: 'MARKET_CREATED',
    userAddress: creator,
    txHash,
    blockNumber,
    blockTime,
    description: `New market created: ${question}`,
    metadata: {
      action: 'created',
      marketTitle: question,
      avatarGradient: category === 'crypto' 
        ? 'from-[#FF9900] to-[#FF5E00]'
        : 'from-[#3B82F6] to-[#06B6D4]',
    },
  });
}

/**
 * Create activity event for market resolution
 */
async function createMarketResolvedActivity({
  marketId,
  outcome,
  resolver,
  txHash,
  blockNumber,
  blockTime,
  market = null,
}) {
  const outcomeLabels = { 1: 'Yes', 2: 'No', 3: 'Invalid' };
  const outcomeLabel = outcomeLabels[outcome] || 'Unknown';

  return await createActivityEvent({
    marketId,
    eventType: 'MARKET_RESOLVED',
    userAddress: resolver,
    txHash,
    blockNumber,
    blockTime,
    description: `Market resolved: ${outcomeLabel}`,
    metadata: {
      action: 'resolved',
      outcome: outcomeLabel,
      marketTitle: market?.question || `Market #${marketId}`,
    },
  });
}

module.exports = {
  createActivityEvent,
  createTradeActivity,
  createMarketCreatedActivity,
  createMarketResolvedActivity,
};

