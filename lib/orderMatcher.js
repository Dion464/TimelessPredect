/**
 * Order Matching Service
 * Automatically matches and settles orders when compatible
 */

import { getOrderBook } from './orderBook.js';
import { shouldExecuteLimitOrder } from './priceChecker.js';

class OrderMatcher {
  constructor(settlementCallback) {
    this.orderBook = getOrderBook();
    this.settlementCallback = settlementCallback || null;
    this.matchingInterval = null;
    this.isRunning = false;
    this.ammExecutionCallback = null; // Callback to execute orders via AMM
  }

  /**
   * Set callback for executing orders via AMM when market price crosses limit
   */
  setAMMExecutionCallback(callback) {
    this.ammExecutionCallback = callback;
  }

  /**
   * Start automatic matching service
   */
  start(intervalMs = 5000) {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🔄 Order matching service started');

    this.matchingInterval = setInterval(() => {
      this.matchOrders();
    }, intervalMs);
  }

  /**
   * Stop matching service
   */
  stop() {
    if (this.matchingInterval) {
      clearInterval(this.matchingInterval);
      this.matchingInterval = null;
    }
    this.isRunning = false;
    console.log('⏹️  Order matching service stopped');
  }

  /**
   * Find and match compatible orders
   */
  async matchOrders() {
    // Get all open orders
    const allOrders = [];
    
    // Iterate through all markets and outcomes
    for (const [marketId, marketData] of this.orderBook.books.entries()) {
      for (const [outcomeId, outcomeData] of marketData.entries()) {
        // Check buy orders
        for (const buyOrder of outcomeData.buy) {
          if (buyOrder.status === 'open' || buyOrder.status === 'partially_filled') {
            allOrders.push(buyOrder);
          }
        }
        // Check sell orders
        for (const sellOrder of outcomeData.sell) {
          if (sellOrder.status === 'open' || sellOrder.status === 'partially_filled') {
            allOrders.push(sellOrder);
          }
        }
      }
    }

    // Try to match orders
    for (const order of allOrders) {
      if (order.status !== 'open' && order.status !== 'partially_filled') continue;

      // First, try to match against other orders in the book
      const matches = this.orderBook.findMatches(order);
      
      if (matches.length > 0) {
        console.log(`✅ Found ${matches.length} matches for order ${order.id}`);
        
        // Process matches
        for (const match of matches) {
          await this.processMatch(order, match);
        }
        continue; // Order matched, skip AMM execution check
      }

      // If no matches in order book, check if we should execute via AMM
      // (when market price crosses limit price)
      if (this.ammExecutionCallback) {
        try {
          const shouldExecute = await shouldExecuteLimitOrder(order);
          if (shouldExecute) {
            console.log(`💰 Market price crossed limit for order ${order.id}, executing via AMM...`);
            await this.ammExecutionCallback(order);
          }
        } catch (error) {
          console.error(`Error checking AMM execution for order ${order.id}:`, error);
        }
      }
    }
  }

  /**
   * Process a matched order pair
   */
  async processMatch(takerOrder, match) {
    const makerOrder = match.order;
    const fillSize = match.fillSize;

    try {
      // Update order book
      this.orderBook.fillOrder(makerOrder.id, fillSize);
      this.orderBook.fillOrder(takerOrder.id, fillSize);

      // Trigger settlement if callback provided
      if (this.settlementCallback) {
        await this.settlementCallback({
          makerOrder,
          takerOrder,
          fillSize,
          fillPrice: match.fillPrice
        });
      } else {
        console.log(`💼 Match ready for settlement:`, {
          makerOrderId: makerOrder.id,
          takerOrderId: takerOrder.id,
          fillSize,
          fillPrice: match.fillPrice
        });
      }

    } catch (error) {
      console.error('Error processing match:', error);
    }
  }
}

// Singleton instance
let matcherInstance = null;

export function getOrderMatcher(settlementCallback) {
  if (!matcherInstance) {
    matcherInstance = new OrderMatcher(settlementCallback);
  }
  return matcherInstance;
}

export default OrderMatcher;

