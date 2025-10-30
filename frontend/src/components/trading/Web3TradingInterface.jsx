import React, { useState, useEffect, useCallback } from 'react';
import { useWeb3 } from '../../hooks/useWeb3';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';

const Web3TradingInterface = ({ marketId, market, onTradeComplete }) => {
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
    if (!contracts.pricingAMM || !contracts.predictionMarket || !tradeAmount || parseFloat(tradeAmount) <= 0) {
      setEstimatedShares('0');
      return;
    }

    try {
      // First, sync AMM state with current market state (same as contract does)
      const market = await contracts.predictionMarket.getMarket(marketId);
      const yesShares = market.totalYesShares;
      const noShares = market.totalNoShares;
      
      // Update AMM state before calculating (this syncs the internal state)
      // Note: updateMarketState is not a view function, so we can't call it directly
      // Instead, we'll use the market's current state directly in our calculation
      
      const investmentAmount = parseFloat(tradeAmount);
      let estimatedShares;
      
      if (activeTab === 'buy') {
        // Calculate shares using LMSR pricing from AMM
        try {
          // Get current price from AMM (in basis points: 5000 = 50%)
          const [yesPriceBasis, noPriceBasis] = await contracts.pricingAMM.calculatePrice(marketId);
          const currentPriceBasis = tradeSide === 'yes' ? yesPriceBasis.toNumber() : noPriceBasis.toNumber();
          
          // Convert price from basis points to decimal (5000 -> 0.5)
          const currentPriceDecimal = currentPriceBasis / 10000;
          
          // Calculate shares: investmentAmount / price_in_decimal
          // At 50% (0.5), 0.1 ETH buys 0.1 / 0.5 = 0.2 shares
          if (currentPriceDecimal > 0 && currentPriceDecimal <= 1) {
            estimatedShares = investmentAmount / currentPriceDecimal;
            // Apply 2% fee (same as contract)
            estimatedShares = estimatedShares * 0.98;
          } else {
            // Fallback: use 1:1 if price is invalid
            estimatedShares = investmentAmount;
          }
        } catch (error) {
          console.error('Failed to calculate shares with AMM:', error);
          // Fallback: use price from marketData if available
          const fallbackYesPrice = marketData?.yesPrice || market?.yesPrice || 50;
          const fallbackNoPrice = marketData?.noPrice || market?.noPrice || 50;
          const currentPrice = tradeSide === 'yes' ? parseFloat(fallbackYesPrice) : parseFloat(fallbackNoPrice);
          // Price is in cents, convert to decimal (50 -> 0.5)
          const priceDecimal = currentPrice / 100;
          if (priceDecimal > 0 && priceDecimal <= 1) {
            estimatedShares = investmentAmount / priceDecimal;
            estimatedShares = estimatedShares * 0.98; // Apply 2% fee
          } else {
            estimatedShares = investmentAmount; // 1:1 fallback
          }
        }
      } else {
        // For selling, use current price to calculate payout
        const fallbackYesPrice = marketData?.yesPrice || market?.yesPrice || 50;
        const fallbackNoPrice = marketData?.noPrice || market?.noPrice || 50;
        const currentPrice = tradeSide === 'yes' ? parseFloat(fallbackYesPrice) : parseFloat(fallbackNoPrice);
        const priceDecimal = currentPrice / 100; // Convert cents to decimal
        if (priceDecimal > 0 && priceDecimal <= 1) {
          estimatedShares = parseFloat(tradeAmount) * priceDecimal * 0.98; // Apply 2% fee
        } else {
          estimatedShares = parseFloat(tradeAmount); // 1:1 fallback
        }
      }
      
      // Ensure minimum of 0.0001 shares
      if (estimatedShares < 0.0001) {
        estimatedShares = 0.0001;
      }
      
      setEstimatedShares(estimatedShares.toFixed(4));
    } catch (err) {
      console.error('Failed to calculate shares:', err);
      // Final fallback: very simple calculation
      setEstimatedShares(parseFloat(tradeAmount).toFixed(4));
    }
  }, [contracts.predictionMarket, contracts.pricingAMM, marketId, tradeAmount, tradeSide, activeTab, marketData, market]);

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
      // Call the refresh callback to update chart and all data
      if (onTradeComplete) {
        setTimeout(() => onTradeComplete(), 2000); // Wait for blockchain confirmation
      }
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
      // Call the refresh callback to update chart and all data
      if (onTradeComplete) {
        setTimeout(() => onTradeComplete(), 2000); // Wait for blockchain confirmation
      }
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

  // Calculate estimated values for display (Dribbble style)
  const estimatedAveragePrice = parseFloat(tradeAmount) > 0 && parseFloat(estimatedShares) > 0
    ? (parseFloat(tradeAmount) / parseFloat(estimatedShares)).toFixed(2)
    : '0.00';
  
  const estimatedProfit = activeTab === 'buy' && parseFloat(tradeAmount) > 0
    ? (parseFloat(estimatedShares) * (currentPrice / 100) - parseFloat(tradeAmount)).toFixed(2)
    : '0.00';
  
  const estimatedFees = parseFloat(tradeAmount) > 0
    ? (parseFloat(tradeAmount) * 0.02).toFixed(2) // 2% fee
    : '0.00';
  
  const maxROI = activeTab === 'buy' && parseFloat(tradeAmount) > 0
    ? ((parseFloat(estimatedShares) * 1.0 - parseFloat(tradeAmount)) / parseFloat(tradeAmount) * 100).toFixed(2)
    : '0.00';

  const ratePerShare = parseFloat(tradeAmount) > 0 && parseFloat(estimatedShares) > 0
    ? (parseFloat(tradeAmount) / parseFloat(estimatedShares)).toFixed(2)
    : (currentPrice / 100).toFixed(2);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      {/* Buy/Sell Tabs - Dribbble Style */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('buy')}
          className={`flex-1 py-4 px-6 text-sm font-semibold transition-colors ${
            activeTab === 'buy'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setActiveTab('sell')}
          className={`flex-1 py-4 px-6 text-sm font-semibold transition-colors ${
            activeTab === 'sell'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Sell
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* Current Market Prices - Dribbble Style (Clickable) */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setTradeSide('yes')}
            className={`p-4 rounded-lg text-left transition-all ${
              tradeSide === 'yes' 
                ? 'bg-green-50 border-2 border-green-300' 
                : 'bg-gray-50 hover:bg-gray-100'
            }`}
          >
            <div className="text-xs text-gray-600 mb-1">Yes</div>
            <div className="text-xl font-bold text-green-600">
              ${(yesPrice / 100).toFixed(2)}
            </div>
          </button>
          <button
            onClick={() => setTradeSide('no')}
            className={`p-4 rounded-lg text-left transition-all ${
              tradeSide === 'no' 
                ? 'bg-red-50 border-2 border-red-300' 
                : 'bg-gray-50 hover:bg-gray-100'
            }`}
          >
            <div className="text-xs text-gray-600 mb-1">No</div>
            <div className="text-xl font-bold text-red-600">
              ${(noPrice / 100).toFixed(2)}
            </div>
          </button>
        </div>

        {/* Side Selection - Hidden, controlled by clicking price boxes */}
        <div className="hidden">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Choose Side
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTradeSide('yes')}
              className={`p-3 rounded-lg border-2 transition-colors ${
                tradeSide === 'yes'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200'
              }`}
            >
              <div className="font-medium">YES</div>
            </button>
            <button
              onClick={() => setTradeSide('no')}
              className={`p-3 rounded-lg border-2 transition-colors ${
                tradeSide === 'no'
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-200'
              }`}
            >
              <div className="font-medium">NO</div>
            </button>
          </div>
        </div>

        {/* Amount Input - Dribbble Style */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Amount</label>
            <span className="text-sm text-gray-500">
              Balance: <span className="font-semibold text-gray-900">
                {activeTab === 'buy' ? `${parseFloat(ethBalance).toFixed(4)} ETH` : `${parseFloat(tradeSide === 'yes' ? position.yesShares : position.noShares).toFixed(2)} shares`}
              </span>
            </span>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-green-600 font-semibold">ETH</span>
            </div>
            <input
              type="number"
              step="0.001"
              min="0"
              value={tradeAmount}
              onChange={(e) => setTradeAmount(e.target.value)}
              placeholder="0.00"
              className="w-full pl-12 pr-16 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={() => {
                if (activeTab === 'buy') {
                  setTradeAmount(parseFloat(ethBalance).toFixed(4));
                } else {
                  const available = tradeSide === 'yes' ? position.yesShares : position.noShares;
                  setTradeAmount(parseFloat(available).toFixed(2));
                }
              }}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              Max
            </button>
          </div>
          {activeTab === 'buy' && parseFloat(tradeAmount) > 0 && (
            <div className="mt-2 text-xs text-gray-500">
              Rate: <span className="font-semibold">{ratePerShare} ETH = 1 Share</span>
            </div>
          )}
        </div>

        {/* Estimated Trade Details - Dribbble Style */}
        {activeTab === 'buy' && parseFloat(tradeAmount) > 0 && (
          <div className="space-y-3 pt-4 border-t border-gray-200">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Average Price</span>
              <span className="font-semibold text-gray-900">${estimatedAveragePrice}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Estimated Shares</span>
              <span className="font-semibold text-gray-900">{parseFloat(estimatedShares).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Estimated Profit</span>
              <span className="font-semibold text-gray-900">${estimatedProfit}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Estimated Fees</span>
              <span className="font-semibold text-gray-900">${estimatedFees}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Max Return on Investment</span>
              <span className="font-semibold text-gray-900">${maxROI}%</span>
            </div>
          </div>
        )}

        {/* Buy/Sell Button - Dribbble Style */}
        <button
          onClick={activeTab === 'buy' ? handleBuy : handleSell}
          disabled={loading || !tradeAmount || parseFloat(tradeAmount) <= 0}
          className={`w-full py-4 px-6 rounded-lg font-semibold text-white transition-all duration-200 ${
            loading || !tradeAmount || parseFloat(tradeAmount) <= 0
              ? 'bg-gray-300 cursor-not-allowed'
              : activeTab === 'buy'
              ? 'bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg'
              : 'bg-red-600 hover:bg-red-700 shadow-md hover:shadow-lg'
          }`}
        >
          {loading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
              Processing...
            </div>
          ) : (
            activeTab === 'buy' ? 'Buy' : 'Sell'
          )}
        </button>

        {/* My Signals - Dribbble Style */}
        <div className="pt-6 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">My Signals</h3>
          <p className="text-sm text-gray-500">You have no available forecast.</p>
        </div>

        {/* Join Community - Dribbble Style */}
        <div className="pt-6 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900">Join Community</h3>
              <p className="text-xs text-gray-500">Be part of a great community</p>
            </div>
          </div>
          <button className="w-full mt-3 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
            Join
          </button>
        </div>
      </div>
    </div>
  );
};

export default Web3TradingInterface;