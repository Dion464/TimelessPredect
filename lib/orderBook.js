/**
 * In-memory Order Book for Hybrid CLOB System
 * Tracks off-chain orders and matches them
 */

import { ethers } from 'ethers';

class OrderBook {
  constructor() {
    // Order book structure: marketId -> outcomeId -> side -> orders[]
    this.books = new Map(); // Map<string, Map<string, Map<string, Order[]>>>
    this.orders = new Map(); // orderId -> Order
    this.nextOrderId = 1;
  }

  /**
   * Get order book key for indexing
   */
  getBookKey(marketId, outcomeId, side) {
    return `${marketId}:${outcomeId}:${side}`;
  }

  /**
   * Initialize market order book if not exists
   */
  initMarketBook(marketId, outcomeId) {
    if (!this.books.has(marketId.toString())) {
      this.books.set(marketId.toString(), new Map());
    }
    const marketBook = this.books.get(marketId.toString());
    
    if (!marketBook.has(outcomeId.toString())) {
      marketBook.set(outcomeId.toString(), {
        buy: [],  // Bids (sorted descending by price)
        sell: []  // Asks (sorted ascending by price)
      });
    }
  }

  /**
   * Add order to book
   */
  addOrder(order) {
    const orderId = (this.nextOrderId++).toString();
    order.id = orderId;
    order.createdAt = new Date().toISOString();
    order.status = 'open';
    
    this.orders.set(orderId, order);
    
    const marketId = order.marketId.toString();
    const outcomeId = order.outcomeId.toString();
    const side = order.side ? 'buy' : 'sell';
    
    this.initMarketBook(marketId, outcomeId);
    const book = this.books.get(marketId).get(outcomeId);
    const orders = book[side];
    
    // Insert in sorted order
    // Sort by whole cents first, then by exact price
    const orderCents = Math.floor(parseInt(order.price) / 100);
    
    if (side === 'buy') {
      // Buy orders: highest price first (descending by cents, then by exact price)
      const index = orders.findIndex(o => {
        const oCents = Math.floor(parseInt(o.price) / 100);
        if (oCents < orderCents) return true;
        if (oCents > orderCents) return false;
        return parseInt(o.price) < parseInt(order.price);
      });
      if (index === -1) {
        orders.push(order);
      } else {
        orders.splice(index, 0, order);
      }
    } else {
      // Sell orders: lowest price first (ascending by cents, then by exact price)
      const index = orders.findIndex(o => {
        const oCents = Math.floor(parseInt(o.price) / 100);
        if (oCents > orderCents) return true;
        if (oCents < orderCents) return false;
        return parseInt(o.price) > parseInt(order.price);
      });
      if (index === -1) {
        orders.push(order);
      } else {
        orders.splice(index, 0, order);
      }
    }
    
    return orderId;
  }

  /**
   * Find matching orders for a new order
   * Returns array of {order, fillSize} tuples
   * Matches based on whole cents (e.g., 42.67 matches 42.0, 42.5, 42.9, etc.)
   */
  findMatches(newOrder) {
    const matches = [];
    const marketId = newOrder.marketId.toString();
    const outcomeId = newOrder.outcomeId.toString();
    const oppositeSide = newOrder.side ? 'sell' : 'buy';
    
    if (!this.books.has(marketId) || !this.books.get(marketId).has(outcomeId)) {
      return matches;
    }
    
    const book = this.books.get(marketId).get(outcomeId);
    const counterOrders = book[oppositeSide];
    
    // Convert new order price to whole cents for matching
    const newOrderPriceTicks = parseInt(newOrder.price);
    const newOrderCents = Math.floor(newOrderPriceTicks / 100); // e.g., 4267 ticks = 42 cents
    
    let remainingSize = BigInt(newOrder.size);
    
    for (const counterOrder of counterOrders) {
      if (remainingSize <= 0n) break;
      if (counterOrder.status !== 'open' && counterOrder.status !== 'partially_filled') continue;
      
      // Check price compatibility
      // Match based on whole cents (first two digits) - if user sets 42.67, match any 42.x
      const counterOrderPriceTicks = parseInt(counterOrder.price);
      const counterOrderCents = Math.floor(counterOrderPriceTicks / 100); // e.g., 4200 ticks = 42 cents
      
      if (newOrder.side) {
        // New order is buy - match against asks (sell orders)
        // Match if buy price (in cents) >= sell price (in cents)
        // e.g., 42.67¢ (42 cents) matches 42.0¢, 42.5¢, 42.9¢, etc.
        if (newOrderCents < counterOrderCents) {
          break; // No more matches possible (sorted order)
        }
      } else {
        // New order is sell - match against bids (buy orders)
        // Match if sell price (in cents) <= buy price (in cents)
        if (newOrderCents > counterOrderCents) {
          break; // No more matches possible (sorted order)
        }
      }
      
      const counterFilled = BigInt(counterOrder.filled || 0);
      const counterRemaining = BigInt(counterOrder.size) - counterFilled;
      if (counterRemaining <= 0n) continue; // Skip fully filled orders
      
      const fillSize = remainingSize < counterRemaining ? remainingSize : counterRemaining;
      
      matches.push({
        order: counterOrder,
        fillSize: fillSize.toString(),
        fillPrice: counterOrder.price // Use maker order price
      });
      
      remainingSize -= fillSize;
    }
    
    return matches;
  }

  /**
   * Mark order as filled (partially or fully)
   */
  fillOrder(orderId, fillSize) {
    const order = this.orders.get(orderId);
    if (!order) return false;
    
    const currentFilled = BigInt(order.filled || 0);
    const newFilled = currentFilled + BigInt(fillSize);
    const totalSize = BigInt(order.size);
    
    order.filled = newFilled.toString();
    
    if (newFilled >= totalSize) {
      order.status = 'filled';
    } else {
      order.status = 'partially_filled';
    }
    
    return true;
  }

  /**
   * Cancel an order
   */
  cancelOrder(orderId) {
    const order = this.orders.get(orderId);
    if (!order) return false;
    
    if (order.status === 'filled') {
      return false; // Cannot cancel filled order
    }
    
    order.status = 'canceled';
    return true;
  }

  /**
   * Get order book depth for a market/outcome
   */
  getOrderBook(marketId, outcomeId, depth = 10) {
    const marketIdStr = marketId.toString();
    const outcomeIdStr = outcomeId.toString();
    
    if (!this.books.has(marketIdStr) || !this.books.get(marketIdStr).has(outcomeIdStr)) {
      return { bids: [], asks: [] };
    }
    
    const book = this.books.get(marketIdStr).get(outcomeIdStr);
    
    // Get top bids (buy orders, highest price first)
    const bids = book.buy
      .filter(o => o.status === 'open')
      .slice(0, depth)
      .map(o => ({
        price: o.price,
        size: o.size,
        remaining: (BigInt(o.size) - BigInt(o.filled || 0)).toString(),
        orderId: o.id
      }));
    
    // Get top asks (sell orders, lowest price first)
    const asks = book.sell
      .filter(o => o.status === 'open')
      .slice(0, depth)
      .map(o => ({
        price: o.price,
        size: o.size,
        remaining: (BigInt(o.size) - BigInt(o.filled || 0)).toString(),
        orderId: o.id
      }));
    
    return { bids, asks };
  }

  /**
   * Get user's open orders
   */
  getUserOrders(userAddress, marketId = null) {
    const userOrders = [];
    
    for (const order of this.orders.values()) {
      if (order.maker.toLowerCase() !== userAddress.toLowerCase()) continue;
      if (marketId && order.marketId.toString() !== marketId.toString()) continue;
      if (order.status === 'open' || order.status === 'partially_filled') {
        userOrders.push(order);
      }
    }
    
    return userOrders;
  }

  /**
   * Get order by ID
   */
  getOrder(orderId) {
    return this.orders.get(orderId);
  }

  /**
   * Find order ID by order hash or signature
   */
  findOrderId(order) {
    for (const [orderId, storedOrder] of this.orders.entries()) {
      if (storedOrder.maker === order.maker &&
          storedOrder.marketId.toString() === order.marketId.toString() &&
          storedOrder.outcomeId.toString() === order.outcomeId.toString() &&
          storedOrder.price.toString() === order.price.toString() &&
          storedOrder.size.toString() === order.size.toString() &&
          storedOrder.salt.toString() === order.salt.toString()) {
        return orderId;
      }
    }
    return null;
  }
}

// Singleton instance
let orderBookInstance = null;

export function getOrderBook() {
  if (!orderBookInstance) {
    orderBookInstance = new OrderBook();
  }
  return orderBookInstance;
}

export default OrderBook;

