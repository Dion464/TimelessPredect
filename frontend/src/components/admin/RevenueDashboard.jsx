import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../../hooks/useWeb3';
import { ethers } from 'ethers';

const RevenueDashboard = () => {
  const { contracts, provider } = useWeb3();
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState({
    tradingFees: 0, // Calculated from totalVolume * platformFeePercent
    marketCreationFees: 0, // Calculated from marketCreationFee * totalMarkets
    totalRevenue: 0, // Sum of tradingFees + marketCreationFees
    contractBalance: '0', // Actual contract balance
    totalMarkets: 0, // From getActiveMarkets
    totalVolume: '0', // Sum of all markets totalVolume
    platformFee: 0, // From platformFeePercent
    marketCreationFee: '0' // From marketCreationFee
  });

  // Fetch on-chain data
  useEffect(() => {
    const fetchOnChainData = async () => {
      if (!contracts.predictionMarket || !provider) {
        console.log('No contracts or provider available');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Get contract state
        const marketCreationFee = await contracts.predictionMarket.marketCreationFee();
        const platformFeePercent = await contracts.predictionMarket.platformFeePercent();
        const contractBalance = await provider.getBalance(contracts.predictionMarket.address);
        
        // Get all active markets
        const activeMarkets = await contracts.predictionMarket.getActiveMarkets();
        
        let totalVolume = ethers.BigNumber.from(0);
        
        // Calculate total volume from all markets
        for (const marketId of activeMarkets) {
          try {
            const market = await contracts.predictionMarket.getMarket(marketId);
            totalVolume = totalVolume.add(market.totalVolume);
          } catch (err) {
            console.error(`Error fetching market ${marketId}:`, err);
          }
        }

        // Calculate actual fees from on-chain data
        const platformFeeBasisPoints = platformFeePercent.toNumber();
        const tradingVolume = parseFloat(ethers.utils.formatEther(totalVolume));
        
        // Trading fees = total volume * platform fee percent
        const tradingFeesETH = tradingVolume * (platformFeeBasisPoints / 10000);
        
        // Market creation fees = fee per market * number of markets
        const marketCreationFeeETH = parseFloat(ethers.utils.formatEther(marketCreationFee));
        const totalMarketCreationFeesETH = marketCreationFeeETH * activeMarkets.length;

        // Total revenue = trading fees + market creation fees (all in ETH)
        const totalRevenueETH = tradingFeesETH + totalMarketCreationFeesETH;

        setRevenueData({
          tradingFees: tradingFeesETH,
          marketCreationFees: totalMarketCreationFeesETH,
          totalRevenue: totalRevenueETH,
          contractBalance: ethers.utils.formatEther(contractBalance),
          totalMarkets: activeMarkets.length,
          totalVolume: ethers.utils.formatEther(totalVolume),
          platformFee: platformFeeBasisPoints / 100, // Convert to percentage
          marketCreationFee: ethers.utils.formatEther(marketCreationFee)
        });

      } catch (error) {
        console.error('Error fetching on-chain data:', error);
      } finally {
        setLoading(false);
      }
    };

    const interval = setInterval(fetchOnChainData, 10000); // Refresh every 10 seconds
    fetchOnChainData();

    return () => clearInterval(interval);
  }, [contracts, provider]);

  const revenueStreams = [
    {
      name: 'Trading Fees',
      value: revenueData.tradingFees,
      percentage: revenueData.totalRevenue > 0 ? (revenueData.tradingFees / revenueData.totalRevenue) * 100 : 0,
      color: 'bg-blue-500',
      description: `${revenueData.platformFee}% platform fee on trades`,
      icon: '💱'
    },
    {
      name: 'Market Creation Fees',
      value: revenueData.marketCreationFees,
      percentage: revenueData.totalRevenue > 0 ? (revenueData.marketCreationFees / revenueData.totalRevenue) * 100 : 0,
      color: 'bg-green-500',
      description: `${parseFloat(revenueData.marketCreationFee).toFixed(4)} ETH per market`,
      icon: '🏦'
    }
  ];

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading blockchain data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-display-md font-semibold text-gray-900 mb-2">Revenue Dashboard</h1>
        <p className="text-lg text-gray-600">Real-time on-chain platform performance</p>
      </div>

      {/* On-Chain Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-blue-900">Total Markets</h3>
            <span className="text-2xl">📊</span>
          </div>
          <div className="text-3xl font-bold text-blue-900">{revenueData.totalMarkets}</div>
          <div className="text-sm text-blue-700 mt-1">Active markets on-chain</div>
        </div>
        
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-green-900">Total Volume</h3>
            <span className="text-2xl">💹</span>
          </div>
          <div className="text-3xl font-bold text-green-900">
            {parseFloat(revenueData.totalVolume).toFixed(4)} ETH
          </div>
          <div className="text-sm text-green-700 mt-1">All-time trading volume</div>
        </div>
        
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-purple-900">Contract Balance</h3>
            <span className="text-2xl">💰</span>
          </div>
          <div className="text-3xl font-bold text-purple-900">
            {parseFloat(revenueData.contractBalance).toFixed(4)} ETH
          </div>
          <div className="text-sm text-purple-700 mt-1">Accumulated fees</div>
        </div>
      </div>

      {/* Platform Settings */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Platform Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900">Platform Fee</p>
              <p className="text-xs text-gray-600">Charged on all trades</p>
            </div>
            <div className="text-2xl font-bold text-blue-600">{revenueData.platformFee}%</div>
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900">Market Creation Fee</p>
              <p className="text-xs text-gray-600">Per market creation</p>
            </div>
            <div className="text-2xl font-bold text-green-600">
              {revenueData.marketCreationFee} ETH
            </div>
          </div>
        </div>
      </div>

      {/* Total Revenue Card */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium opacity-90">Total Revenue (All-Time)</h2>
            <div className="text-4xl font-bold mt-2">
              {revenueData.totalRevenue.toFixed(6)} ETH
            </div>
            <div className="text-sm opacity-75 mt-1">
              From {revenueData.totalMarkets} markets
            </div>
          </div>
          <div className="text-6xl opacity-20">💎</div>
        </div>
      </div>

      {/* Revenue Streams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {revenueStreams.map((stream, index) => (
          <div key={index} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-2xl">{stream.icon}</div>
              <div className={`w-3 h-3 rounded-full ${stream.color}`}></div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{stream.name}</h3>
            <div className="text-2xl font-bold text-gray-900 mb-2">
              {stream.value.toFixed(6)} ETH
            </div>
            <div className="text-sm text-gray-600 mb-3">{stream.description}</div>
            <div className="flex items-center">
              <div className={`h-2 rounded-full ${stream.color} mr-2`} 
                   style={{ width: `${Math.max(stream.percentage, 5)}%` }}></div>
              <span className="text-sm text-gray-500">{stream.percentage.toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>

      {/* Platform Statistics */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Platform Statistics</h2>
          <button 
            onClick={() => window.location.reload()}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh Data</span>
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Trading Metrics</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Volume:</span>
                <span className="font-medium">{parseFloat(revenueData.totalVolume).toFixed(6)} ETH</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Trading Fees Collected:</span>
                <span className="font-medium text-blue-600">{revenueData.tradingFees.toFixed(6)} ETH</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Average Volume/Market:</span>
                <span className="font-medium">
                  {revenueData.totalMarkets > 0 
                    ? (parseFloat(revenueData.totalVolume) / revenueData.totalMarkets).toFixed(6)
                    : '0.000000'
                  } ETH
                </span>
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Market Metrics</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Markets:</span>
                <span className="font-medium">{revenueData.totalMarkets}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Market Creation Fees Collected:</span>
                <span className="font-medium text-green-600">{revenueData.marketCreationFees.toFixed(6)} ETH</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Contract Balance:</span>
                <span className="font-medium text-purple-600">{parseFloat(revenueData.contractBalance).toFixed(6)} ETH</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RevenueDashboard;

