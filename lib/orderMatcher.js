import { getOrderBook } from './orderBook.js';

class OrderMatcher {
  constructor(settlementCallback) {
    this.orderBook = getOrderBook();
    this.settlementCallback = settlementCallback;
    this.ammExecutionCallback = null;
    this.isRunning = false;
    this.matchInterval = null;
  }

  setSettlementCallback(callback) {
    this.settlementCallback = callback;
  }

  setAMMExecutionCallback(callback) {
    this.ammExecutionCallback = callback;
  }

  start(intervalMs = 5000) {
    if (this.matchInterval) {
      clearInterval(this.matchInterval);
    }

    this.isRunning = true;
    this.matchInterval = setInterval(() => {
      this.matchOpenOrders().catch((error) => {
        console.error('Order matcher error:', error);
      });
    }, intervalMs);

    // Run immediately once
    this.matchOpenOrders().catch((error) => {
      console.error('Order matcher error:', error);
    });
  }

  stop() {
    if (this.matchInterval) {
      clearInterval(this.matchInterval);
      this.matchInterval = null;
    }
    this.isRunning = false;
  }

  async matchOpenOrders() {
    const markets = this.orderBook.getMarketKeys();

    for (const { marketId, outcomeId } of markets) {
      await this.matchMarket(marketId, outcomeId);
    }
  }

  async matchMarket(marketId, outcomeId) {
    while (true) {
      const bestBid = this.orderBook.getBestBid(marketId, outcomeId);
      const bestAsk = this.orderBook.getBestAsk(marketId, outcomeId);

      if (!bestBid || !bestAsk) {
        break;
      }

      const bidInternal = this.orderBook.getInternalOrder(bestBid.id);
      const askInternal = this.orderBook.getInternalOrder(bestAsk.id);
      if (!bidInternal || !askInternal) {
        break;
      }

      // Price check: match only if spread crosses
      if (bidInternal.price < askInternal.price) {
        break;
      }

      const fillSize = bidInternal.remainingSize < askInternal.remainingSize
        ? bidInternal.remainingSize
        : askInternal.remainingSize;
      const fillPrice = askInternal.price;

      const makerOrderInternal = bidInternal.createdAt <= askInternal.createdAt
        ? this.orderBook.getOrder(bidInternal.id)
        : this.orderBook.getOrder(askInternal.id);
      const takerOrderInternal = makerOrderInternal.id === bidInternal.id
        ? this.orderBook.getOrder(askInternal.id)
        : this.orderBook.getOrder(bidInternal.id);

      this.orderBook.fillOrder(bidInternal.id, fillSize);
      this.orderBook.fillOrder(askInternal.id, fillSize);

      if (this.settlementCallback && makerOrderInternal && takerOrderInternal) {
        try {
          await this.settlementCallback({
            makerOrder: makerOrderInternal,
            takerOrder: takerOrderInternal,
            fillSize: fillSize.toString(),
            fillPrice: fillPrice.toString()
          });
        } catch (error) {
          console.error('Auto-settlement callback failed:', error);
        }
      }

      if (this.ammExecutionCallback) {
        const remainingAsk = this.orderBook.getInternalOrder(bestAsk.id);
        if (remainingAsk && remainingAsk.status === 'open') {
          try {
            await this.ammExecutionCallback(this.orderBook.getOrder(bestAsk.id));
          } catch (error) {
            console.error('AMM execution callback failed:', error);
          }
        }
      }

      // Continue loop to see if more orders can match
      if (fillSize === 0n) {
        break;
      }
    }
  }
}

let matcherInstance = null;

export function getOrderMatcher(settlementCallback) {
  if (!matcherInstance) {
    matcherInstance = new OrderMatcher(settlementCallback);
  } else if (settlementCallback) {
    matcherInstance.setSettlementCallback(settlementCallback);
  }
  return matcherInstance;
}


