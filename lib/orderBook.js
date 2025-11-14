import { ethers } from 'ethers';

class OrderBook {
  constructor() {
    this.orders = new Map();
    this.marketBooks = new Map(); // key => { bids: string[], asks: string[] }
    this.nextOrderId = 1;
  }

  _key(marketId, outcomeId) {
    const market = marketId !== undefined ? marketId : '0';
    const outcome = outcomeId !== undefined ? outcomeId : '0';
    return `${market.toString()}:${outcome.toString()}`;
  }

  _ensureBook(key) {
    if (!this.marketBooks.has(key)) {
      this.marketBooks.set(key, { bids: [], asks: [] });
    }
    return this.marketBooks.get(key);
  }

  _sortSide(book, isBidSide) {
    const ids = isBidSide ? book.bids : book.asks;
    ids.sort((aId, bId) => {
      const a = this.orders.get(aId);
      const b = this.orders.get(bId);
      if (!a || !b) return 0;
      if (isBidSide) {
        // Higher price first, tie-break by earlier createdAt
        const priceDiff = Number(b.price) - Number(a.price);
        if (priceDiff !== 0) return priceDiff;
        return a.createdAt - b.createdAt;
      } else {
        // Lower price first, tie-break by earlier createdAt
        const priceDiff = Number(a.price) - Number(b.price);
        if (priceDiff !== 0) return priceDiff;
        return a.createdAt - b.createdAt;
      }
    });
  }

  _removeOrderFromBook(order) {
    const key = this._key(order.marketId, order.outcomeId);
    const book = this.marketBooks.get(key);
    if (!book) return;

    const collection = order.side ? book.bids : book.asks;
    const index = collection.indexOf(order.id);
    if (index !== -1) {
      collection.splice(index, 1);
    }
  }

  _serializeOrder(order) {
    if (!order) return null;
    return {
      id: order.id,
      maker: order.maker,
      marketId: order.marketId,
      outcomeId: order.outcomeId,
      price: order.price.toString(),
      priceDecimal: Number(order.price) / 10000,
      size: order.size.toString(),
      remainingSize: order.remainingSize.toString(),
      filledSize: order.filledSize.toString(),
      side: order.side,
      expiry: order.expiry,
      salt: order.salt,
      signature: order.signature,
      orderHash: order.orderHash,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    };
  }

  _formatForBook(order) {
    if (!order || order.remainingSize <= 0n || order.status !== 'open') {
      return null;
    }

    let amount = 0;
    try {
      amount = parseFloat(ethers.utils.formatUnits(order.remainingSize.toString(), 18));
    } catch (error) {
      amount = Number(order.remainingSize) / 1e18;
    }

    return {
      id: order.id,
      maker: order.maker,
      price: Number(order.price) / 10000,
      ticks: order.price.toString(),
      amount,
      size: order.size.toString(),
      remainingSize: order.remainingSize.toString(),
      side: order.side ? 'buy' : 'sell',
      createdAt: order.createdAt
    };
  }

  _getInternalOrder(orderId) {
    return this.orders.get(orderId);
  }

  getInternalOrder(orderId) {
    return this._getInternalOrder(orderId?.toString());
  }

  addOrder(orderInput) {
    if (!orderInput) {
      throw new Error('Order input is required');
    }

    const id = orderInput.id ? orderInput.id.toString() : (this.nextOrderId++).toString();
    const marketId = orderInput.marketId?.toString() ?? '0';
    const outcomeId = orderInput.outcomeId?.toString() ?? '0';

    const price = BigInt(orderInput.price ?? orderInput.priceTicks ?? 0);
    const size = BigInt(orderInput.size ?? 0);
    const remaining = orderInput.remainingSize !== undefined
      ? BigInt(orderInput.remainingSize)
      : size;

    const normalized = {
      id,
      maker: orderInput.maker || orderInput.address || ethers.constants.AddressZero,
      marketId,
      outcomeId,
      price,
      size,
      remainingSize: remaining < 0n ? 0n : remaining,
      filledSize: orderInput.filledSize !== undefined ? BigInt(orderInput.filledSize) : (size - remaining),
      side: orderInput.side === true || orderInput.side === 'buy' || orderInput.side === 1,
      expiry: orderInput.expiry ? orderInput.expiry.toString() : null,
      salt: orderInput.salt ? orderInput.salt.toString() : null,
      signature: orderInput.signature || null,
      orderHash: orderInput.orderHash || null,
      status: 'open',
      createdAt: orderInput.createdAt || Date.now(),
      updatedAt: Date.now()
    };

    this.orders.set(id, normalized);

    const key = this._key(marketId, outcomeId);
    const book = this._ensureBook(key);
    if (normalized.side) {
      book.bids.push(id);
      this._sortSide(book, true);
    } else {
      book.asks.push(id);
      this._sortSide(book, false);
    }

    return id;
  }

  findMatches(orderInput) {
    if (!orderInput) return [];

    const marketId = orderInput.marketId?.toString() ?? '0';
    const outcomeId = orderInput.outcomeId?.toString() ?? '0';
    const key = this._key(marketId, outcomeId);
    const book = this.marketBooks.get(key);
    if (!book) return [];

    const isBuy = orderInput.side === true || orderInput.side === 'buy' || orderInput.side === 1;
    const targetPrice = BigInt(orderInput.price ?? 0);
    let remaining = BigInt(orderInput.size ?? 0);

    const oppositeIds = isBuy ? [...book.asks] : [...book.bids];
    const matches = [];

    for (const id of oppositeIds) {
      if (remaining <= 0n) break;
      const stored = this.orders.get(id);
      if (!stored || stored.status !== 'open' || stored.remainingSize <= 0n) continue;

      if (isBuy) {
        if (stored.price > targetPrice) continue;
      } else {
        if (stored.price < targetPrice) continue;
      }

      const fillSize = stored.remainingSize < remaining ? stored.remainingSize : remaining;

      matches.push({
        order: this._serializeOrder(stored),
        fillSize: fillSize.toString(),
        fillPrice: stored.price.toString()
      });

      remaining -= fillSize;
    }

    return matches;
  }

  fillOrder(orderId, fillSizeInput) {
    const order = this.orders.get(orderId?.toString());
    if (!order) return null;

    const fillSize = BigInt(fillSizeInput ?? 0);
    if (fillSize <= 0n) return this._serializeOrder(order);

    order.filledSize += fillSize;
    if (order.filledSize > order.size) {
      order.filledSize = order.size;
    }
    order.remainingSize = order.size - order.filledSize;
    order.updatedAt = Date.now();

    if (order.remainingSize <= 0n) {
      order.remainingSize = 0n;
      order.status = 'filled';
      this._removeOrderFromBook(order);
    } else {
      order.status = 'partial';
    }

    return this._serializeOrder(order);
  }

  cancelOrder(orderId) {
    const order = this.orders.get(orderId?.toString());
    if (!order || order.status === 'filled') {
      return false;
    }

    order.status = 'canceled';
    order.remainingSize = 0n;
    order.updatedAt = Date.now();
    this._removeOrderFromBook(order);
    return true;
  }

  getOrder(orderId) {
    return this._serializeOrder(this.orders.get(orderId?.toString()));
  }

  findOrderId(orderInput) {
    if (!orderInput) return null;
    if (orderInput.id && this.orders.has(orderInput.id.toString())) {
      return orderInput.id.toString();
    }

    for (const [id, stored] of this.orders.entries()) {
      if (orderInput.orderHash && stored.orderHash && stored.orderHash === orderInput.orderHash) {
        return id;
      }
      if (orderInput.signature && stored.signature && stored.signature === orderInput.signature) {
        return id;
      }
      if (stored.maker?.toLowerCase() === orderInput.maker?.toLowerCase() &&
          stored.marketId === orderInput.marketId?.toString() &&
          stored.outcomeId === orderInput.outcomeId?.toString() &&
          stored.price === BigInt(orderInput.price ?? stored.price) &&
          stored.salt === orderInput.salt?.toString()) {
        return id;
      }
    }

    return null;
  }

  getUserOrders(userAddress, marketId) {
    if (!userAddress) return [];
    const lower = userAddress.toLowerCase();
    const filtered = [];

    for (const order of this.orders.values()) {
      if (order.maker?.toLowerCase() !== lower) continue;
      if (marketId && order.marketId !== marketId.toString()) continue;
      filtered.push(this._serializeOrder(order));
    }

    // Sort by updatedAt desc
    filtered.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    return filtered;
  }

  getOrderBook(marketId, outcomeId, depth = 10) {
    const key = this._key(marketId, outcomeId);
    const book = this.marketBooks.get(key);
    if (!book) {
      return { bids: [], asks: [] };
    }

    const formatOrders = (ids, isBid) => {
      const result = [];
      for (const id of ids) {
        const order = this.orders.get(id);
        if (!order || order.status !== 'open' || order.remainingSize <= 0n) continue;
        const formatted = this._formatForBook(order);
        if (formatted) result.push(formatted);
        if (result.length >= depth) break;
      }
      return result;
    };

    return {
      bids: formatOrders(book.bids, true),
      asks: formatOrders(book.asks, false)
    };
  }

  getBestBid(marketId, outcomeId) {
    const key = this._key(marketId, outcomeId);
    const book = this.marketBooks.get(key);
    if (!book) return null;
    for (const id of book.bids) {
      const order = this.orders.get(id);
      if (order && order.status === 'open' && order.remainingSize > 0n) {
        return this._serializeOrder(order);
      }
    }
    return null;
  }

  getBestAsk(marketId, outcomeId) {
    const key = this._key(marketId, outcomeId);
    const book = this.marketBooks.get(key);
    if (!book) return null;
    for (const id of book.asks) {
      const order = this.orders.get(id);
      if (order && order.status === 'open' && order.remainingSize > 0n) {
        return this._serializeOrder(order);
      }
    }
    return null;
  }

  getMarketKeys() {
    const keys = [];
    for (const key of this.marketBooks.keys()) {
      const [marketId, outcomeId] = key.split(':');
      keys.push({ marketId, outcomeId });
    }
    return keys;
  }
}

const orderBookSingleton = new OrderBook();

export function getOrderBook() {
  return orderBookSingleton;
}


