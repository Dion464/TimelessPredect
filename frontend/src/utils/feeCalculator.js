/**
 * Comprehensive Fee Calculation System
 * Based on Polymarket's fee structure with AMM and liquidity provider rewards
 */

// Fee rates in basis points (1 basis point = 0.01%)
export const FEE_RATES = {
  // Trading fees (main revenue source)
  TRADING_FEE_BPS: 200, // 2% per trade
  MAKER_FEE_BPS: 100,   // 1% for makers (liquidity providers)
  TAKER_FEE_BPS: 200,   // 2% for takers
  
  // Settlement fees
  SETTLEMENT_FEE_BPS: 50, // 0.5% on market resolution
  WITHDRAWAL_FEE_BPS: 25, // 0.25% on withdrawals
  
  // Volume-based rebates
  VOLUME_REBATE_TIERS: [
    { minVolume: 0, rebateBps: 0 },
    { minVolume: 10000, rebateBps: 10 },   // $10k+ volume: 0.1% rebate
    { minVolume: 50000, rebateBps: 25 },   // $50k+ volume: 0.25% rebate
    { minVolume: 100000, rebateBps: 50 },  // $100k+ volume: 0.5% rebate
    { minVolume: 500000, rebateBps: 75 },  // $500k+ volume: 0.75% rebate
  ],
  
  // Liquidity provider rewards
  LP_REWARD_SHARE: 0.4, // 40% of trading fees go to LPs
  PLATFORM_SHARE: 0.6,  // 60% goes to platform
};

// Market creation fees
export const MARKET_CREATION_FEES = {
  BASIC_MARKET: 100,     // $100 to create basic market
  FEATURED_MARKET: 500,  // $500 for featured placement
  SPONSORED_MARKET: 1000, // $1000 for sponsored markets
};

/**
 * Calculate trading fee for an order
 */
export function calculateTradingFee(amount, price, side, userVolume = 0, isMaker = false) {
  const tradeValue = amount * price;
  
  // Base fee rate
  let feeRateBps = isMaker ? FEE_RATES.MAKER_FEE_BPS : FEE_RATES.TAKER_FEE_BPS;
  
  // Apply volume rebate
  const rebate = getVolumeRebate(userVolume);
  feeRateBps = Math.max(0, feeRateBps - rebate);
  
  const fee = (tradeValue * feeRateBps) / 10000;
  
  return {
    feeAmount: fee,
    feeRateBps: feeRateBps,
    rebateApplied: rebate,
    tradeValue: tradeValue,
    netAmount: tradeValue - fee
  };
}

/**
 * Get volume-based rebate for user
 */
export function getVolumeRebate(userVolume) {
  const tiers = FEE_RATES.VOLUME_REBATE_TIERS;
  
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (userVolume >= tiers[i].minVolume) {
      return tiers[i].rebateBps;
    }
  }
  
  return 0;
}

/**
 * Calculate liquidity provider rewards
 */
export function calculateLPRewards(totalFees, userLiquidity, totalLiquidity, timeProvided) {
  const lpRewardPool = totalFees * FEE_RATES.LP_REWARD_SHARE;
  const userShare = userLiquidity / totalLiquidity;
  
  // Time-weighted rewards (longer provision = higher rewards)
  const timeMultiplier = Math.min(2.0, 1.0 + (timeProvided / (30 * 24 * 60 * 60))); // Max 2x after 30 days
  
  const baseReward = lpRewardPool * userShare;
  const timeWeightedReward = baseReward * timeMultiplier;
  
  return {
    baseReward: baseReward,
    timeWeightedReward: timeWeightedReward,
    timeMultiplier: timeMultiplier,
    userShare: userShare,
    totalRewardPool: lpRewardPool
  };
}

/**
 * Calculate settlement fees
 */
export function calculateSettlementFee(winnings) {
  const fee = (winnings * FEE_RATES.SETTLEMENT_FEE_BPS) / 10000;
  
  return {
    feeAmount: fee,
    netWinnings: winnings - fee,
    feeRateBps: FEE_RATES.SETTLEMENT_FEE_BPS
  };
}

/**
 * Calculate withdrawal fees
 */
export function calculateWithdrawalFee(amount) {
  const fee = (amount * FEE_RATES.WITHDRAWAL_FEE_BPS) / 10000;
  
  return {
    feeAmount: fee,
    netAmount: amount - fee,
    feeRateBps: FEE_RATES.WITHDRAWAL_FEE_BPS
  };
}

/**
 * Calculate AMM pricing with fees
 */
export function calculateAMMPrice(yesShares, noShares, tradeAmount, side) {
  // Constant Product Market Maker (x * y = k)
  const k = yesShares * noShares;
  
  let newYesShares, newNoShares, price;
  
  if (side === 'YES') {
    // Buying YES shares
    newNoShares = noShares + tradeAmount;
    newYesShares = k / newNoShares;
    price = (yesShares - newYesShares) / tradeAmount;
  } else {
    // Buying NO shares
    newYesShares = yesShares + tradeAmount;
    newNoShares = k / newYesShares;
    price = (noShares - newNoShares) / tradeAmount;
  }
  
  // Add trading fee to price
  const feeMultiplier = 1 + (FEE_RATES.TRADING_FEE_BPS / 10000);
  const finalPrice = price * feeMultiplier;
  
  return {
    price: finalPrice,
    priceWithoutFees: price,
    newYesShares: newYesShares,
    newNoShares: newNoShares,
    priceImpact: Math.abs(price - 0.5) / 0.5 // Impact relative to 50% probability
  };
}

/**
 * Calculate market creation cost
 */
export function calculateMarketCreationCost(marketType = 'basic', featured = false, sponsored = false) {
  let baseCost = MARKET_CREATION_FEES.BASIC_MARKET;
  
  if (sponsored) {
    baseCost = MARKET_CREATION_FEES.SPONSORED_MARKET;
  } else if (featured) {
    baseCost = MARKET_CREATION_FEES.FEATURED_MARKET;
  }
  
  return {
    baseCost: baseCost,
    marketType: marketType,
    features: {
      featured: featured,
      sponsored: sponsored
    }
  };
}

/**
 * Calculate platform revenue breakdown
 */
export function calculatePlatformRevenue(totalFees) {
  const lpRewards = totalFees * FEE_RATES.LP_REWARD_SHARE;
  const platformRevenue = totalFees * FEE_RATES.PLATFORM_SHARE;
  
  return {
    totalFees: totalFees,
    lpRewards: lpRewards,
    platformRevenue: platformRevenue,
    lpShare: FEE_RATES.LP_REWARD_SHARE,
    platformShare: FEE_RATES.PLATFORM_SHARE
  };
}

/**
 * Calculate optimal liquidity provision
 */
export function calculateOptimalLiquidity(marketVolume, targetSpread = 0.02) {
  // Optimal liquidity to maintain target spread
  const optimalLiquidity = marketVolume / (4 * targetSpread);
  
  return {
    optimalLiquidity: optimalLiquidity,
    targetSpread: targetSpread,
    currentUtilization: marketVolume / optimalLiquidity
  };
}

/**
 * Calculate data API pricing
 */
export function calculateAPIUsageFee(requests, tier = 'basic') {
  const pricingTiers = {
    basic: { freeRequests: 1000, pricePerRequest: 0.001 },
    pro: { freeRequests: 10000, pricePerRequest: 0.0005 },
    enterprise: { freeRequests: 100000, pricePerRequest: 0.0001 }
  };
  
  const tierConfig = pricingTiers[tier];
  const billableRequests = Math.max(0, requests - tierConfig.freeRequests);
  const cost = billableRequests * tierConfig.pricePerRequest;
  
  return {
    totalRequests: requests,
    freeRequests: Math.min(requests, tierConfig.freeRequests),
    billableRequests: billableRequests,
    cost: cost,
    tier: tier
  };
}

export default {
  calculateTradingFee,
  calculateLPRewards,
  calculateSettlementFee,
  calculateWithdrawalFee,
  calculateAMMPrice,
  calculateMarketCreationCost,
  calculatePlatformRevenue,
  calculateOptimalLiquidity,
  calculateAPIUsageFee,
  getVolumeRebate,
  FEE_RATES,
  MARKET_CREATION_FEES
};

