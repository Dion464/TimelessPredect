import React, { useState, useEffect } from 'react';
import useWallet from '../../hooks/useWallet';
import useMarketData from '../../hooks/useMarketData';

const TradingInterface = ({ marketId, market }) => {
  const [selectedSide, setSelectedSide] = useState('yes');
  const [orderType, setOrderType] = useState('market');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState(null);

  const { 
    account, 
    balance, 
    isConnected, 
    connectWallet, 
    sendTransaction 
  } = useWallet();

  const { 
    placeOrder, 
    getOrderBook, 
    getRecentTrades 
  } = useMarketData(marketId);

  const orderBook = getOrderBook(marketId);
  const recentTrades = getRecentTrades(marketId);

  // Calculate potential payout
  const calculatePayout = () => {
    if (!amount || !price) return 0;
    const shares = parseFloat(amount);
    const sharePrice = parseFloat(price) / 100; // Convert cents to decimal
    return shares / sharePrice;
  };

  // Calculate potential profit
  const calculateProfit = () => {
    if (!amount || !price) return 0;
    const shares = parseFloat(amount);
    const sharePrice = parseFloat(price) / 100;
    const cost = shares * sharePrice;
    return shares - cost;
  };

  // Handle order placement
  const handlePlaceOrder = async () => {
    if (!isConnected) {
      await connectWallet();
      return;
    }

    if (!amount || (orderType === 'limit' && !price)) {
      setOrderError('Please fill in all required fields');
      return;
    }

    setIsPlacingOrder(true);
    setOrderError(null);

    try {
      // For demo purposes, we'll simulate the order
      // In a real implementation, this would interact with smart contracts
      
      const orderPrice = orderType === 'market' 
        ? (selectedSide === 'yes' ? market.currentProbability : 1 - market.currentProbability)
        : parseFloat(price) / 100;

      const result = await placeOrder(marketId, selectedSide, parseFloat(amount), orderPrice);
      
      // Reset form
      setAmount('');
      setPrice('');
      
      console.log('Order placed:', result);
    } catch (error) {
      setOrderError(error.message);
    } finally {
      setIsPlacingOrder(false);
    }
  };

  // Set price based on market price
  useEffect(() => {
    if (orderType === 'market' && market) {
      const marketPrice = selectedSide === 'yes' 
        ? market.currentProbability 
        : 1 - market.currentProbability;
      setPrice((marketPrice * 100).toFixed(0));
    }
  }, [orderType, selectedSide, market]);

  if (!market) {
    return <div className="text-center py-8">Market not found</div>;
  }

  const yesPrice = Math.round(market.currentProbability * 100);
  const noPrice = 100 - yesPrice;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Trade</h3>
        <p className="text-sm text-gray-600">{market.questionTitle}</p>
      </div>

      {/* Side Selection */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => setSelectedSide('yes')}
          className={`p-4 rounded-lg border-2 transition-all ${
            selectedSide === 'yes'
              ? 'border-green-500 bg-green-50'
              : 'border-gray-200 hover:border-green-300'
          }`}
        >
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{yesPrice}¢</div>
            <div className="text-sm text-gray-600">{market.yesLabel || 'Yes'}</div>
          </div>
        </button>
        
        <button
          onClick={() => setSelectedSide('no')}
          className={`p-4 rounded-lg border-2 transition-all ${
            selectedSide === 'no'
              ? 'border-red-500 bg-red-50'
              : 'border-gray-200 hover:border-red-300'
          }`}
        >
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{noPrice}¢</div>
            <div className="text-sm text-gray-600">{market.noLabel || 'No'}</div>
          </div>
        </button>
      </div>

      {/* Order Type */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Order Type
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setOrderType('market')}
            className={`px-4 py-2 rounded-lg border text-sm font-medium ${
              orderType === 'market'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-700 hover:border-gray-300'
            }`}
          >
            Market
          </button>
          <button
            onClick={() => setOrderType('limit')}
            className={`px-4 py-2 rounded-lg border text-sm font-medium ${
              orderType === 'limit'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-700 hover:border-gray-300'
            }`}
          >
            Limit
          </button>
        </div>
      </div>

      {/* Amount Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Amount ($)
        </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Price Input (for limit orders) */}
      {orderType === 'limit' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Price (¢)
          </label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="50"
            min="1"
            max="99"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      )}

      {/* Order Summary */}
      {amount && price && (
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <div className="text-sm text-gray-600 space-y-1">
            <div className="flex justify-between">
              <span>Shares:</span>
              <span>{calculatePayout().toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Cost:</span>
              <span>${amount}</span>
            </div>
            <div className="flex justify-between">
              <span>Potential Profit:</span>
              <span className="text-green-600">${calculateProfit().toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {orderError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-red-600">{orderError}</p>
        </div>
      )}

      {/* Wallet Info */}
      {isConnected && (
        <div className="bg-blue-50 rounded-lg p-3 mb-4">
          <div className="text-sm text-blue-800">
            <div>Connected: {account?.slice(0, 6)}...{account?.slice(-4)}</div>
            <div>Balance: {balance} ETH</div>
          </div>
        </div>
      )}

      {/* Place Order Button */}
      <button
        onClick={handlePlaceOrder}
        disabled={isPlacingOrder || (!isConnected && !amount)}
        className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
          selectedSide === 'yes'
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : 'bg-red-600 hover:bg-red-700 text-white'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isPlacingOrder ? (
          'Placing Order...'
        ) : !isConnected ? (
          'Connect Wallet'
        ) : (
          `Buy ${selectedSide === 'yes' ? 'Yes' : 'No'} ${amount ? `for $${amount}` : ''}`
        )}
      </button>

      {/* Order Book */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Order Book</h4>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <div className="text-green-600 font-medium mb-2">Bids (Yes)</div>
            {orderBook.bids?.slice(0, 5).map((bid, index) => (
              <div key={index} className="flex justify-between py-1">
                <span>{(bid.price * 100).toFixed(0)}¢</span>
                <span>${bid.amount}</span>
              </div>
            )) || <div className="text-gray-500">No bids</div>}
          </div>
          <div>
            <div className="text-red-600 font-medium mb-2">Asks (No)</div>
            {orderBook.asks?.slice(0, 5).map((ask, index) => (
              <div key={index} className="flex justify-between py-1">
                <span>{(ask.price * 100).toFixed(0)}¢</span>
                <span>${ask.amount}</span>
              </div>
            )) || <div className="text-gray-500">No asks</div>}
          </div>
        </div>
      </div>

      {/* Recent Trades */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Recent Trades</h4>
        <div className="space-y-2 text-xs">
          {recentTrades.slice(0, 5).map((trade, index) => (
            <div key={index} className="flex justify-between items-center py-1">
              <span className={trade.side === 'yes' ? 'text-green-600' : 'text-red-600'}>
                {(trade.price * 100).toFixed(0)}¢
              </span>
              <span>${trade.amount}</span>
              <span className="text-gray-500">
                {new Date(trade.timestamp).toLocaleTimeString()}
              </span>
            </div>
          )) || <div className="text-gray-500">No recent trades</div>}
        </div>
      </div>
    </div>
  );
};

export default TradingInterface;

