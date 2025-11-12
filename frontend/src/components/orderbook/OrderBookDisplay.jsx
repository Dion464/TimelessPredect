import React from 'react';
import { useOrderBook } from '../../hooks/useOrderBook';
import { ticksToCents } from '../../utils/eip712';

const OrderBookDisplay = ({ marketId, outcomeId = 0, depth = 10 }) => {
  const { orderBook, loading } = useOrderBook(marketId, outcomeId);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const bids = orderBook.bids || [];
  const asks = orderBook.asks || [];

  // Calculate spread
  const bestBid = bids[0]?.price ? parseInt(bids[0].price) : 0;
  const bestAsk = asks[0]?.price ? parseInt(asks[0].price) : 0;
  const spread = bestBid > 0 && bestAsk > 0 ? bestAsk - bestBid : 0;
  const spreadPercent = bestBid > 0 ? (spread / bestBid) * 100 : 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Order Book</h3>
        {spread > 0 && (
          <div className="text-xs text-gray-500">
            Spread: {ticksToCents(spread).toFixed(2)}¢ ({spreadPercent.toFixed(2)}%)
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Asks (Sell Orders) - Red */}
        <div>
          <div className="text-red-600 font-medium text-xs mb-2">Asks (Sell)</div>
          <div className="space-y-1">
            {asks.slice(0, depth).reverse().map((ask, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs hover:bg-red-50 rounded px-2 py-1"
              >
                <span className="text-red-700 font-medium">
                  {ticksToCents(parseInt(ask.price)).toFixed(2)}¢
                </span>
                <span className="text-gray-600">
                  {parseFloat(ask.remaining).toFixed(2)}
                </span>
              </div>
            ))}
            {asks.length === 0 && (
              <div className="text-xs text-gray-400 py-2 text-center">No asks</div>
            )}
          </div>
        </div>

        {/* Bids (Buy Orders) - Green */}
        <div>
          <div className="text-green-600 font-medium text-xs mb-2">Bids (Buy)</div>
          <div className="space-y-1">
            {bids.slice(0, depth).map((bid, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs hover:bg-green-50 rounded px-2 py-1"
              >
                <span className="text-green-700 font-medium">
                  {ticksToCents(parseInt(bid.price)).toFixed(2)}¢
                </span>
                <span className="text-gray-600">
                  {parseFloat(bid.remaining).toFixed(2)}
                </span>
              </div>
            ))}
            {bids.length === 0 && (
              <div className="text-xs text-gray-400 py-2 text-center">No bids</div>
            )}
          </div>
        </div>
      </div>

      {/* Market Price Display */}
      {bestBid > 0 || bestAsk > 0 ? (
        <div className="mt-4 pt-4 border-t border-gray-200 text-center">
          <div className="text-xs text-gray-500 mb-1">Market Price</div>
          <div className="text-lg font-bold text-gray-900">
            {bestBid > 0 && bestAsk > 0
              ? `${ticksToCents(Math.floor((bestBid + bestAsk) / 2)).toFixed(2)}¢`
              : bestBid > 0
              ? `${ticksToCents(bestBid).toFixed(2)}¢`
              : `${ticksToCents(bestAsk).toFixed(2)}¢`}
          </div>
        </div>
      ) : (
        <div className="mt-4 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
          No orders yet
        </div>
      )}
    </div>
  );
};

export default OrderBookDisplay;

