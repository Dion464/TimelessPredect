import React, { useState, useEffect, useCallback } from 'react';
import { useWeb3 } from '../../hooks/useWeb3';
import { useOrderBook } from '../../hooks/useOrderBook';
import { 
  createOrderWithDefaults, 
  signOrder, 
  validateOrder, 
  centsToTicks,
  ticksToCents 
} from '../../utils/eip712';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';

const EXCHANGE_CONTRACT = import.meta.env.VITE_EXCHANGE_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000';
const API_BASE = import.meta.env.VITE_API_BASE_URL || window.location.origin;

const HybridOrderInterface = ({ marketId, market, onTradeComplete }) => {
  const { isConnected, account, signer, provider, contracts, getUserPosition, chainId } = useWeb3();
  const { orderBook, loading: orderBookLoading } = useOrderBook(marketId, 0); // 0 = YES outcome
  
  const [activeTab, setActiveTab] = useState('buy');
  const [orderType, setOrderType] = useState('limit'); // 'limit' or 'market'
  const [side, setSide] = useState('yes'); // 'yes' or 'no'
  const [price, setPrice] = useState('');
  const [size, setSize] = useState('100'); // shares
  const [loading, setLoading] = useState(false);
  const [myOrders, setMyOrders] = useState([]);
  const [userPosition, setUserPosition] = useState({ yesShares: '0', noShares: '0' });

  // Outcome ID: 0 = YES, 1 = NO
  const outcomeId = side === 'yes' ? 0 : 1;

  // Get best bid/ask for display
  const bestBid = orderBook.bids?.[0]?.price || '0';
  const bestAsk = orderBook.asks?.[0]?.price || '0';
  const currentPrice = side === 'yes' 
    ? ticksToCents(parseInt(bestBid) || 5000) 
    : ticksToCents(parseInt(bestAsk) || 5000);

  // Set price to current market price when switching
  useEffect(() => {
    if (orderType === 'limit' && !price && currentPrice > 0) {
      setPrice(currentPrice.toFixed(2));
    }
  }, [orderType, currentPrice, price]);

  // Fetch user's orders
  const fetchMyOrders = useCallback(async () => {
    if (!isConnected || !account || !marketId) return;
    
    try {
      const response = await fetch(
        `${API_BASE}/api/orders?user=${account}&marketId=${marketId}`
      );
      if (response.ok) {
        const data = await response.json();
        setMyOrders(data.orders || []);
      }
    } catch (err) {
      console.error('Failed to fetch user orders:', err);
    }
  }, [isConnected, account, marketId, API_BASE]);

  // Fetch user's position (shares balance)
  const fetchUserPosition = useCallback(async () => {
    if (!isConnected || !account || !marketId || !getUserPosition) return;
    
    try {
      const position = await getUserPosition(marketId);
      setUserPosition({
        yesShares: position.yesShares || '0',
        noShares: position.noShares || '0'
      });
    } catch (err) {
      console.error('Failed to fetch user position:', err);
      setUserPosition({ yesShares: '0', noShares: '0' });
    }
  }, [isConnected, account, marketId, getUserPosition]);

  useEffect(() => {
    fetchMyOrders();
    fetchUserPosition();
    const interval = setInterval(() => {
      fetchMyOrders();
      fetchUserPosition();
    }, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [fetchMyOrders, fetchUserPosition]);

  // Place order
  const handlePlaceOrder = async () => {
    if (!isConnected || !account || !signer) {
      toast.error('Please connect your wallet');
      return;
    }

    if (orderType === 'limit' && (!price || parseFloat(price) <= 0)) {
      toast.error('Please enter a valid limit price');
      return;
    }

    if (!size || parseFloat(size) <= 0) {
      toast.error('Please enter a valid size');
      return;
    }

    // For sell orders, check user has enough shares
    if (activeTab === 'sell') {
      const availableShares = side === 'yes' 
        ? parseFloat(userPosition.yesShares)
        : parseFloat(userPosition.noShares);
      
      if (availableShares < parseFloat(size)) {
        toast.error(`Insufficient shares. You have ${availableShares.toFixed(2)} ${side.toUpperCase()} shares`);
        return;
      }
    }

    setLoading(true);

    try {
      // Create order object
      const orderData = {
        maker: account,
        marketId: marketId.toString(),
        outcomeId: outcomeId.toString(), // Must be string
        price: orderType === 'limit' ? centsToTicks(parseFloat(price)).toString() : '0', // Market orders use 0
        size: ethers.utils.parseUnits(size || '0', 18).toString(), // Convert to wei
        side: activeTab === 'buy' // true = buy, false = sell
      };

      const order = createOrderWithDefaults(orderData);

      // Validate order
      const validation = validateOrder(order);
      if (!validation.valid) {
        toast.error(validation.error);
        setLoading(false);
        return;
      }

      // Sign order with EIP-712
      console.log('📝 Signing order with EIP-712...', order);
      const signature = await signOrder(order, chainId, EXCHANGE_CONTRACT, signer);
      console.log('✅ Order signed:', signature);

      // Submit to backend
      const response = await fetch(`${API_BASE}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order,
          signature,
          isMarketOrder: orderType === 'market'
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to place order');
      }

      if (result.status === 'matched') {
        // Order was matched - trigger settlement
        toast.success('Order matched! Settling on-chain...');
        
        // For now, just notify - in production, backend would auto-settle
        // Or we could call /api/settle here
        console.log('Matched orders:', result.matches);
        
        // Refresh data
        if (onTradeComplete) {
          setTimeout(() => onTradeComplete(), 2000);
        }
      } else {
        toast.success(`✅ Limit order placed at ${price}¢!`);
      }

      // Reset form
      setSize('');
      if (orderType === 'limit') {
        setPrice('');
      }

      // Refresh orders and position
      fetchMyOrders();
      fetchUserPosition();

    } catch (err) {
      console.error('Error placing order:', err);
      toast.error(`Order failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Cancel order
  const handleCancelOrder = async (orderId) => {
    if (!isConnected || !account) return;

    try {
      const response = await fetch(`${API_BASE}/api/orders/${orderId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress: account })
      });

      if (!response.ok) {
        throw new Error('Failed to cancel order');
      }

      toast.success('Order canceled');
      fetchMyOrders();
    } catch (err) {
      console.error('Error canceling order:', err);
      toast.error(`Cancel failed: ${err.message}`);
    }
  };

  if (!isConnected) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="text-center py-8">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Connect Wallet to Trade</h3>
          <p className="text-gray-600">Connect your wallet to place orders.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      {/* Buy/Sell Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('buy')}
          className={`flex-1 py-4 px-6 text-sm font-semibold transition-colors ${
            activeTab === 'buy'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Buy {side === 'yes' ? 'YES' : 'NO'}
        </button>
        <button
          onClick={() => setActiveTab('sell')}
          className={`flex-1 py-4 px-6 text-sm font-semibold transition-colors ${
            activeTab === 'sell'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Sell {side === 'yes' ? 'YES' : 'NO'}
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* User Position Display */}
        {isConnected && (parseFloat(userPosition.yesShares) > 0 || parseFloat(userPosition.noShares) > 0) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-xs font-medium text-blue-900 mb-2">Your Position</div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-600">YES Shares</div>
                <div className="text-lg font-bold text-green-600">
                  {parseFloat(userPosition.yesShares || '0').toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-gray-600">NO Shares</div>
                <div className="text-lg font-bold text-red-600">
                  {parseFloat(userPosition.noShares || '0').toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Side Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Outcome</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setSide('yes')}
              className={`p-4 rounded-lg border-2 transition-all ${
                side === 'yes'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-green-300'
              }`}
            >
              <div className="text-center">
                <div className="text-xl font-bold text-green-600">YES</div>
                <div className="text-xs text-gray-500 mt-1">
                  {activeTab === 'buy' ? `Best bid: ${ticksToCents(parseInt(bestBid)).toFixed(2)}¢` : `Best ask: ${ticksToCents(parseInt(bestAsk)).toFixed(2)}¢`}
                </div>
                {activeTab === 'sell' && parseFloat(userPosition.yesShares) > 0 && (
                  <div className="text-xs text-green-600 mt-1 font-medium">
                    You have {parseFloat(userPosition.yesShares).toFixed(2)} shares
                  </div>
                )}
              </div>
            </button>
            <button
              onClick={() => setSide('no')}
              className={`p-4 rounded-lg border-2 transition-all ${
                side === 'no'
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-200 hover:border-red-300'
              }`}
            >
              <div className="text-center">
                <div className="text-xl font-bold text-red-600">NO</div>
                <div className="text-xs text-gray-500 mt-1">
                  {activeTab === 'buy' ? `Best bid: ${ticksToCents(parseInt(bestBid)).toFixed(2)}¢` : `Best ask: ${ticksToCents(parseInt(bestAsk)).toFixed(2)}¢`}
                </div>
                {activeTab === 'sell' && parseFloat(userPosition.noShares) > 0 && (
                  <div className="text-xs text-red-600 mt-1 font-medium">
                    You have {parseFloat(userPosition.noShares).toFixed(2)} shares
                  </div>
                )}
              </div>
            </button>
          </div>
        </div>

        {/* Order Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Order Type</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setOrderType('limit')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                orderType === 'limit'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Limit
            </button>
            <button
              onClick={() => setOrderType('market')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                orderType === 'market'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Market
            </button>
          </div>
        </div>

        {/* Limit Price Input */}
        {orderType === 'limit' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Limit Price (¢)</label>
              <span className="text-xs text-gray-500">
                Current: {currentPrice.toFixed(2)}¢
              </span>
            </div>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="100"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={currentPrice.toFixed(2)}
              className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => setPrice((currentPrice * 0.95).toFixed(2))}
                className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
              >
                -5%
              </button>
              <button
                onClick={() => setPrice(currentPrice.toFixed(2))}
                className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
              >
                Market
              </button>
              <button
                onClick={() => setPrice((currentPrice * 1.05).toFixed(2))}
                className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
              >
                +5%
              </button>
            </div>
          </div>
        )}

        {/* Size Input */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">Size (Shares)</label>
            {activeTab === 'sell' && (
              <span className="text-xs text-gray-500">
                Available: <span className="font-semibold">
                  {side === 'yes' 
                    ? parseFloat(userPosition.yesShares || '0').toFixed(2)
                    : parseFloat(userPosition.noShares || '0').toFixed(2)} shares
                </span>
              </span>
            )}
          </div>
          <input
            type="number"
            step="1"
            min="1"
            max={activeTab === 'sell' ? (side === 'yes' ? userPosition.yesShares : userPosition.noShares) : undefined}
            value={size}
            onChange={(e) => setSize(e.target.value)}
            placeholder="100"
            className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="mt-2 flex gap-2">
            {activeTab === 'buy' && orderType === 'limit' && price && (
              <div className="text-xs text-gray-500">
                Total cost: ${((parseFloat(price) / 100) * parseFloat(size || 0)).toFixed(2)}
              </div>
            )}
            {activeTab === 'sell' && orderType === 'limit' && price && (
              <div className="text-xs text-gray-500">
                Total proceeds: ${((parseFloat(price) / 100) * parseFloat(size || 0)).toFixed(2)}
              </div>
            )}
            {activeTab === 'sell' && (
              <button
                onClick={() => {
                  const available = side === 'yes' 
                    ? parseFloat(userPosition.yesShares || '0')
                    : parseFloat(userPosition.noShares || '0');
                  setSize(available.toFixed(2));
                }}
                className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
              >
                Max
              </button>
            )}
          </div>
        </div>

        {/* Place Order Button */}
        <button
          onClick={handlePlaceOrder}
          disabled={
            loading || 
            !size || 
            parseFloat(size) <= 0 ||
            (orderType === 'limit' && (!price || parseFloat(price) <= 0))
          }
          className={`w-full py-4 px-6 rounded-lg font-semibold text-white transition-all ${
            loading || 
            !size || 
            parseFloat(size) <= 0 ||
            (orderType === 'limit' && (!price || parseFloat(price) <= 0))
              ? 'bg-gray-300 cursor-not-allowed'
              : activeTab === 'buy'
              ? 'bg-blue-600 hover:bg-blue-700'
              : 'bg-red-600 hover:bg-red-700'
          }`}
        >
          {loading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
              {orderType === 'market' ? 'Placing Market Order...' : 'Signing & Placing Order...'}
            </div>
          ) : (
            orderType === 'market' 
              ? `Place Market ${activeTab === 'buy' ? 'Buy' : 'Sell'} Order`
              : `Place Limit Order at ${price || '...'}¢`
          )}
        </button>

        {/* My Open Orders */}
        {myOrders.length > 0 && (
          <div className="pt-6 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">My Open Orders</h3>
            <div className="space-y-2">
              {myOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-1 rounded ${
                        order.isYes ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {order.isYes ? 'YES' : 'NO'}
                      </span>
                      <span className={`text-xs font-medium px-2 py-1 rounded ${
                        order.side ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {order.side ? 'BUY' : 'SELL'}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {ticksToCents(parseInt(order.price)).toFixed(2)}¢
                      </span>
                      <span className="text-xs text-gray-500">
                        × {parseFloat(order.size).toFixed(2)} shares
                      </span>
                    </div>
                    {order.filled && parseFloat(order.filled) > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        Filled: {parseFloat(order.filled).toFixed(2)} / {parseFloat(order.size).toFixed(2)}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleCancelOrder(order.id)}
                    className="text-xs px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded"
                  >
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Order Book Preview */}
        {!orderBookLoading && (orderBook.bids.length > 0 || orderBook.asks.length > 0) && (
          <div className="pt-6 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Order Book</h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <div className="text-green-600 font-medium mb-2">Bids (Buy)</div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {orderBook.bids.slice(0, 5).map((bid, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span className="text-gray-700">{ticksToCents(parseInt(bid.price)).toFixed(2)}¢</span>
                      <span className="text-gray-500">{parseFloat(bid.remaining).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-red-600 font-medium mb-2">Asks (Sell)</div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {orderBook.asks.slice(0, 5).map((ask, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span className="text-gray-700">{ticksToCents(parseInt(ask.price)).toFixed(2)}¢</span>
                      <span className="text-gray-500">{parseFloat(ask.remaining).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HybridOrderInterface;

