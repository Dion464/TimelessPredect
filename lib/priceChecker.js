/**
 * Price Checker
 * Fetches current market prices from the database
 */

import prisma from './prismaClient.js';

/**
 * Get current market price from database (latest price snapshot)
 * @param {string} marketId - Market ID
 * @param {boolean} isYes - true for YES, false for NO
 * @returns {Promise<number>} Price in cents (e.g., 43.58)
 */
export async function getCurrentMarketPrice(marketId, isYes) {
  try {
    // Get latest price snapshot from database
    const latestSnapshot = await prisma.priceSnapshot.findFirst({
      where: {
        marketId: BigInt(marketId)
      },
      orderBy: {
        intervalStart: 'desc'
      }
    });

    if (!latestSnapshot) {
      return null;
    }

    // Prices are stored as basis points (5000 = 50%)
    // Convert to cents (5000 = 50¢)
    const priceBps = isYes ? latestSnapshot.yesPriceBps : latestSnapshot.noPriceBps;
    const priceCents = priceBps / 100; // Convert to cents
    return priceCents;
  } catch (error) {
    console.error(`Error fetching price for market ${marketId}:`, error);
    return null;
  }
}

/**
 * Check if limit order should execute based on market price
 * @param {Object} order - Order object
 * @returns {Promise<boolean>} true if order should execute
 */
export async function shouldExecuteLimitOrder(order) {
  if (!order.marketId || order.price === undefined) {
    return false;
  }

  // Get current market price
  const outcomeId = parseInt(order.outcomeId);
  const isYes = outcomeId === 0;
  const currentPrice = await getCurrentMarketPrice(order.marketId, isYes);

  if (currentPrice === null) {
    return false; // Can't determine price, skip
  }

  // Convert order price from ticks to cents
  const orderPriceTicks = parseInt(order.price);
  const orderPriceCents = orderPriceTicks / 100; // e.g., 4358 ticks = 43.58 cents

  // Convert to whole cents for matching
  const currentPriceCents = Math.floor(currentPrice);
  const orderPriceWholeCents = Math.floor(orderPriceCents);

  // For buy orders: execute if market price <= limit price (same whole cents)
  // For sell orders: execute if market price >= limit price (same whole cents)
  if (order.side) {
    // Buy order: execute if current price <= order price (within same whole cents)
    return currentPriceWholeCents <= orderPriceWholeCents;
  } else {
    // Sell order: execute if current price >= order price (within same whole cents)
    return currentPriceWholeCents >= orderPriceWholeCents;
  }
}

