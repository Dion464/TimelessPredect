import React, { useState, useEffect, useCallback } from 'react';
import { useWeb3 } from '../../hooks/useWeb3';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';

const Web3TradingInterface = ({ marketId, market }) => {
  // Add error handling for Web3 context
  let web3Context;
  try {
    web3Context = useWeb3();
  } catch (error) {
    console.error('Web3 context error in trading interface:', error);
    web3Context = {
      isConnected: false,
      account: null,
      contracts: {},
      buyShares: null,
      sellShares: null,
      getUserPosition: null,
      getMarketData: null,
      ethBalance: '0',
    };
  }
  
  const {
    isConnected,
    account,
    contracts,
    buyShares,
    sellShares,
    getUserPosition,
    getMarketData,
    ethBalance,
  } = web3Context;

  const [activeTab, setActiveTab] = useState('buy');
  const [tradeAmount, setTradeAmount] = useState('0.1');
  const [tradeSide, setTradeSide] = useState('yes');
  const [position, setPosition] = useState({ yesShares: '0', noShares: '0', totalInvested: '0' });
  const [marketData, setMarketData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [estimatedShares, setEstimatedShares] = useState('0');

  // Fetch market data and user position
  const fetchData = useCallback(async () => {
    if (!isConnected || !contracts.predictionMarket || !marketId) return;

    try {
      const [marketInfo, userPos] = await Promise.all([
        getMarketData(marketId),
        getUserPosition(marketId),
      ]);

      setMarketData(marketInfo);
      setPosition(userPos);
    } catch (err) {
      console.log('Blockchain data not available, using fallback:', err.message);
    }
  }, [isConnected, contracts.predictionMarket, marketId, getMarketData, getUserPosition]);

  // Real-time price updates
  useEffect(() => {
    if (!isConnected || !contracts.predictionMarket || !marketId) return;

    const updatePrices = async () => {
      try {
        const yesPrice = await contracts.predictionMarket.getCurrentPrice(marketId, true);
        const noPrice = await contracts.predictionMarket.getCurrentPrice(marketId, false);
        
        // Convert basis points to cents (5000 -> 50¢)
        setMarketData(prev => ({
          ...prev,
          yesPrice: parseFloat(yesPrice.toString()) / 100,
          noPrice: parseFloat(noPrice.toString()) / 100
        }));
      } catch (err) {
        console.log('Failed to update prices:', err.message);
      }
    };

    // Update prices every 3 seconds
    const interval = setInterval(updatePrices, 3000);
    updatePrices(); // Initial update

    return () => clearInterval(interval);
  }, [isConnected, contracts.predictionMarket, marketId]);

  // Calculate estimated shares using AMM logic
  const calculateEstimatedShares = useCallback(async () => {
    if (!contracts.pricingAMM || !tradeAmount || parseFloat(tradeAmount) <= 0) {
      setEstimatedShares('0');
      return;
    }

    try {
      // Get current market data to calculate shares using LMSR
      const market = await contracts.predictionMarket.getMarket(marketId);
      const yesShares = market.totalYesShares;
      const noShares = market.totalNoShares;
      
      const investmentAmount = parseFloat(tradeAmount);
      
      // LMSR calculation: Use PricingAMM to calculate shares
      let estimatedShares;
      
      if (activeTab === 'buy') {
        // Calculate shares using LMSR pricing
        try {
          if (!contracts.pricingAMM) {
            throw new Error('PricingAMM contract not available');
          }
          const sharesToGive = await contracts.pricingAMM.calculateSharesToGive(
            marketId, 
            tradeSide === 'yes', 
            ethers.utils.parseEther(tradeAmount.toString())
          );
          estimatedShares = parseFloat(ethers.utils.formatEther(sharesToGive));
        } catch (error) {
          console.error('Failed to calculate shares with LMSR:', error);
          // Fallback: simple calculation based on price
          estimatedShares = investmentAmount; // 1:1 ratio for now
        }
      } else {
        // For selling, use 1:1 ratio for now
        estimatedShares = investmentAmount;
      }
      
      setEstimatedShares(estimatedShares.toFixed(4));
    } catch (err) {
      console.error('Failed to calculate shares:', err);
      // Fallback: simple calculation based on price
      const currentPrice = tradeSide === 'yes' ? parseFloat(yesPrice) : parseFloat(noPrice);
      
      // Prevent division by zero and handle very small prices
      if (currentPrice <= 0 || currentPrice < 0.001) {
        // If price is too small, use 1:1 ratio (1 ETH = 1 share)
        const estimatedShares = parseFloat(tradeAmount);
        setEstimatedShares(estimatedShares.toFixed(4));
      } else {
        const estimatedShares = parseFloat(tradeAmount) / currentPrice;
        setEstimatedShares(estimatedShares.toFixed(4));
      }
    }
  }, [contracts.predictionMarket, marketId, tradeAmount, tradeSide, market, marketData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    calculateEstimatedShares();
  }, [calculateEstimatedShares]);

  const handleBuy = async () => {
    if (!tradeAmount || parseFloat(tradeAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (parseFloat(tradeAmount) > parseFloat(ethBalance)) {
      toast.error('Insufficient ETH balance');
      return;
    }

    setLoading(true);

    try {
      await buyShares(marketId, tradeSide === 'yes', tradeAmount);
      setTradeAmount('');
      await fetchData(); // Refresh data
      toast.success('✅ Shares purchased successfully!');
    } catch (err) {
      console.error('Buy failed:', err);
      toast.error(`Buy failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSell = async () => {
    if (!tradeAmount || parseFloat(tradeAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const availableShares = tradeSide === 'yes' ? position.yesShares : position.noShares;
    if (parseFloat(tradeAmount) > parseFloat(availableShares)) {
      toast.error(`Insufficient ${tradeSide.toUpperCase()} shares`);
      return;
    }

    setLoading(true);

    try {
      await sellShares(marketId, tradeSide === 'yes', tradeAmount);
      setTradeAmount('');
      await fetchData(); // Refresh data
      toast.success('✅ Shares sold successfully!');
    } catch (err) {
      console.error('Sell failed:', err);
      toast.error(`Sell failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="text-center py-8">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Connect Wallet to Trade</h3>
          <p className="text-gray-600">Connect your MetaMask wallet to buy and sell shares.</p>
        </div>
      </div>
    );
  }

  // Define prices early to avoid initialization issues
  // Prioritize marketData over market prop, with fallback to 50¢
  const yesPrice = marketData?.yesPrice || market?.yesPrice || 50; // Default to 50¢
  const noPrice = marketData?.noPrice || market?.noPrice || 50; // Default to 50¢
  const currentPrice = tradeSide === 'yes' ? yesPrice : noPrice;
  
  // Debug logging
  console.log('Web3TradingInterface Debug:', {
    tradeAmount,
    tradeAmountType: typeof tradeAmount,
    tradeAmountParsed: parseFloat(tradeAmount),
    loading,
    isConnected,
    yesPrice,
    noPrice,
    currentPrice,
    market: market ? {
      yesPrice: market.yesPrice,
      noPrice: market.noPrice,
      id: market.id
    } : null,
    marketData: marketData ? {
      yesPrice: marketData.yesPrice,
      noPrice: marketData.noPrice,
      id: marketData.id
    } : null
  });

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-lg font-semibold mb-4">Trade with ETH</h2>

      {/* Tab Navigation */}
      <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('buy')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'buy'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Buy Shares
        </button>
        <button
          onClick={() => setActiveTab('sell')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'sell'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Sell Shares
        </button>
      </div>

      {/* Side Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Choose Side
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setTradeSide('yes')}
            className={`p-3 rounded-lg border-2 transition-colors ${
              tradeSide === 'yes'
                ? 'border-green-500 bg-green-50 text-green-700'
                : 'border-gray-200 hover:border-green-300'
            }`}
          >
            <div className="font-medium">YES</div>
            <div className="text-sm">{parseFloat(yesPrice).toFixed(0)}¢</div>
          </button>
          <button
            onClick={() => setTradeSide('no')}
            className={`p-3 rounded-lg border-2 transition-colors ${
              tradeSide === 'no'
                ? 'border-red-500 bg-red-50 text-red-700'
                : 'border-gray-200 hover:border-red-300'
            }`}
          >
            <div className="font-medium">NO</div>
            <div className="text-sm">{parseFloat(noPrice).toFixed(0)}¢</div>
          </button>
        </div>
      </div>

      {/* Amount Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {activeTab === 'buy' ? 'ETH Amount' : 'Shares to Sell'}
        </label>
        <div className="relative">
          <input
            type="number"
            step="0.001"
            min="0"
            value={tradeAmount}
            onChange={(e) => setTradeAmount(e.target.value)}
            placeholder={activeTab === 'buy' ? '0.1' : '10'}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <span className="text-gray-500 text-sm">
              {activeTab === 'buy' ? 'ETH' : 'shares'}
            </span>
          </div>
        </div>
        {activeTab === 'buy' && (
          <div className="mt-1 text-xs text-gray-500">
            Available: {parseFloat(ethBalance).toFixed(4)} ETH
          </div>
        )}
        {activeTab === 'sell' && (
          <div className="mt-1 text-xs text-gray-500">
            Available: {parseFloat(tradeSide === 'yes' ? position.yesShares : position.noShares).toFixed(2)} {tradeSide.toUpperCase()} shares
          </div>
        )}
      </div>

      {/* Estimated Shares */}
      {activeTab === 'buy' && parseFloat(estimatedShares) > 0 && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <div className="text-sm text-blue-700">
            Estimated shares: <span className="font-medium">{parseFloat(estimatedShares).toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Error Display */}

      {/* Action Button */}
      <button
        onClick={activeTab === 'buy' ? handleBuy : handleSell}
        disabled={loading || !tradeAmount || parseFloat(tradeAmount) <= 0}
        className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
          loading || !tradeAmount || parseFloat(tradeAmount) <= 0
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : activeTab === 'buy'
            ? tradeSide === 'yes'
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {loading ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Processing...
          </div>
        ) : (
          `${activeTab === 'buy' ? 'Buy' : 'Sell'} ${tradeSide.toUpperCase()} Shares`
        )}
      </button>

      {/* Position Summary */}
      {(parseFloat(position.yesShares) > 0 || parseFloat(position.noShares) > 0) && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Your Position</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>YES shares:</span>
              <span className="font-medium">{parseFloat(position.yesShares).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>NO shares:</span>
              <span className="font-medium">{parseFloat(position.noShares).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Total invested:</span>
              <span>{parseFloat(position.totalInvested).toFixed(4)} ETH</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Web3TradingInterface;