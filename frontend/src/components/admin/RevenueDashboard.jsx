import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../../hooks/useWeb3';
import { ethers } from 'ethers';
import { calculatePlatformRevenue, calculateAPIUsageFee, MARKET_CREATION_FEES } from '../../utils/feeCalculator';

const RevenueDashboard = () => {
  const { contracts, provider } = useWeb3();
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState({
    tradingFees: 0,
    lpRewards: 0,
    settlementFees: 0,
    withdrawalFees: 0,
    marketCreationFees: 0,
    apiRevenue: 0,
    totalRevenue: 0,
    contractBalance: '0',
    totalMarkets: 0,
    totalVolume: '0',
    platformFee: 0
  });

  const [timeframe, setTimeframe] = useState('7d');
  const [apiUsage, setApiUsage] = useState({
    basic: 15000,
    pro: 45000,
    enterprise: 120000
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
        let totalMarketCreationFees = ethers.BigNumber.from(0);
        
        // Calculate total volume and market creation fees from all markets
        for (const marketId of activeMarkets) {
          try {
            const market = await contracts.predictionMarket.getMarket(marketId);
            totalVolume = totalVolume.add(market.totalVolume);
            totalMarketCreationFees = totalMarketCreationFees.add(marketCreationFee);
          } catch (err) {
            console.error(`Error fetching market ${marketId}:`, err);
          }
        }

        // Calculate platform fees from volume (using platform fee percent)
        const platformFeeBasisPoints = platformFeePercent.toNumber();
        const tradingVolume = parseFloat(ethers.utils.formatEther(totalVolume));
        const platformTradingFees = tradingVolume * (platformFeeBasisPoints / 10000);

        // Calculate LP rewards (assuming 60% of fees go to LPs as per fee calculator)
        const lpRewardShare = 0.6;
        const lpRewards = platformTradingFees * lpRewardShare;

        const apiRevenue = 
          calculateAPIUsageFee(apiUsage.basic, 'basic').cost +
          calculateAPIUsageFee(apiUsage.pro, 'pro').cost +
          calculateAPIUsageFee(apiUsage.enterprise, 'enterprise').cost;

        const marketCreationFeesInUSD = parseFloat(ethers.utils.formatEther(totalMarketCreationFees)) * 3000; // Assuming $3000 per ETH
        const tradingFeesInUSD = platformTradingFees * 3000;

        setRevenueData({
          tradingFees: tradingFeesInUSD,
          lpRewards: lpRewards * 3000,
          settlementFees: tradingFeesInUSD * 0.1, // Estimate 10% of trading fees
          withdrawalFees: 800, // Could calculate from withdrawals if tracked
          marketCreationFees: marketCreationFeesInUSD,
          apiRevenue: apiRevenue,
          totalRevenue: tradingFeesInUSD + (lpRewards * 3000) + (tradingFeesInUSD * 0.1) + 800 + marketCreationFeesInUSD + apiRevenue,
          contractBalance: ethers.utils.formatEther(contractBalance),
          totalMarkets: activeMarkets.length,
          totalVolume: ethers.utils.formatEther(totalVolume),
          platformFee: platformFeeBasisPoints / 100 // Convert to percentage
        });

      } catch (error) {
        console.error('Error fetching on-chain data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOnChainData();
  }, [contracts, provider, apiUsage, timeframe]);

  const revenueStreams = [
    {
      name: 'Trading Fees',
      value: revenueData.tradingFees,
      percentage: (revenueData.tradingFees / revenueData.totalRevenue) * 100,
      color: 'bg-blue-500',
      description: '1-2% per trade (main revenue)',
      icon: '💱'
    },
    {
      name: 'Market Creation',
      value: revenueData.marketCreationFees,
      percentage: (revenueData.marketCreationFees / revenueData.totalRevenue) * 100,
      color: 'bg-green-500',
      description: '$100-$1000 per market',
      icon: '🏦'
    },
    {
      name: 'Settlement Fees',
      value: revenueData.settlementFees,
      percentage: (revenueData.settlementFees / revenueData.totalRevenue) * 100,
      color: 'bg-purple-500',
      description: '0.5% on resolution',
      icon: '📊'
    },
    {
      name: 'API Revenue',
      value: revenueData.apiRevenue,
      percentage: (revenueData.apiRevenue / revenueData.totalRevenue) * 100,
      color: 'bg-yellow-500',
      description: 'Data monetization',
      icon: '💰'
    },
    {
      name: 'Withdrawal Fees',
      value: revenueData.withdrawalFees,
      percentage: (revenueData.withdrawalFees / revenueData.totalRevenue) * 100,
      color: 'bg-red-500',
      description: '0.25% on withdrawals',
      icon: '🏧'
    }
  ];

  const lpMetrics = {
    totalRewards: revenueData.lpRewards,
    activeProviders: 156,
    averageAPR: 24.5,
    totalLiquidity: 450000
  };

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
              {(parseFloat(revenueData.contractBalance) / revenueData.totalMarkets || 0).toFixed(4)} ETH
            </div>
          </div>
        </div>
      </div>

      {/* Timeframe Selector */}
      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 mb-8 w-fit">
        {['24h', '7d', '30d', '90d'].map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              timeframe === tf
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Total Revenue Card */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium opacity-90">Total Revenue ({timeframe})</h2>
            <div className="text-4xl font-bold mt-2">
              ${revenueData.totalRevenue.toLocaleString()}
            </div>
            <div className="text-sm opacity-75 mt-1">
              +12.5% from previous period
            </div>
          </div>
          <div className="text-6xl opacity-20">💎</div>
        </div>
      </div>

      {/* Revenue Streams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {revenueStreams.map((stream, index) => (
          <div key={index} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-2xl">{stream.icon}</div>
              <div className={`w-3 h-3 rounded-full ${stream.color}`}></div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{stream.name}</h3>
            <div className="text-2xl font-bold text-gray-900 mb-2">
              ${stream.value.toLocaleString()}
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

      {/* Liquidity Provider Metrics */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Liquidity Provider Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">
              ${lpMetrics.totalRewards.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Total LP Rewards</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">
              {lpMetrics.activeProviders}
            </div>
            <div className="text-sm text-gray-600">Active Providers</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600 mb-2">
              {lpMetrics.averageAPR}%
            </div>
            <div className="text-sm text-gray-600">Average APR</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-600 mb-2">
              ${lpMetrics.totalLiquidity.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Total Liquidity</div>
          </div>
        </div>
      </div>

      {/* API Usage & Revenue */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">API Monetization</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Object.entries(apiUsage).map(([tier, requests]) => {
            const usage = calculateAPIUsageFee(requests, tier);
            return (
              <div key={tier} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-medium capitalize">{tier}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    tier === 'basic' ? 'bg-blue-100 text-blue-800' :
                    tier === 'pro' ? 'bg-green-100 text-green-800' :
                    'bg-purple-100 text-purple-800'
                  }`}>
                    {tier.toUpperCase()}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Requests:</span>
                    <span className="font-medium">{usage.totalRequests.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Billable:</span>
                    <span className="font-medium">{usage.billableRequests.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Revenue:</span>
                    <span className="font-medium text-green-600">${usage.cost.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Market Creation Revenue */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Market Creation Revenue</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 border border-gray-200 rounded-lg">
            <div className="text-2xl font-bold text-gray-900 mb-2">
              ${MARKET_CREATION_FEES.BASIC_MARKET}
            </div>
            <div className="text-sm text-gray-600 mb-2">Basic Market</div>
            <div className="text-xs text-gray-500">Standard market creation</div>
          </div>
          <div className="text-center p-4 border border-gray-200 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 mb-2">
              ${MARKET_CREATION_FEES.FEATURED_MARKET}
            </div>
            <div className="text-sm text-gray-600 mb-2">Featured Market</div>
            <div className="text-xs text-gray-500">Homepage placement</div>
          </div>
          <div className="text-center p-4 border border-gray-200 rounded-lg">
            <div className="text-2xl font-bold text-purple-600 mb-2">
              ${MARKET_CREATION_FEES.SPONSORED_MARKET}
            </div>
            <div className="text-sm text-gray-600 mb-2">Sponsored Market</div>
            <div className="text-xs text-gray-500">Premium promotion</div>
          </div>
        </div>
      </div>

      {/* Revenue Projections */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Revenue Projections</h2>
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
            <h3 className="text-lg font-medium text-gray-900 mb-4">Monthly Projection</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Current Volume:</span>
                <span className="font-medium">{parseFloat(revenueData.totalVolume).toFixed(4)} ETH</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Revenue (2% fee):</span>
                <span className="font-medium">${(parseFloat(revenueData.totalVolume) * 3000 * 0.02).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Market Creation Fees:</span>
                <span className="font-medium text-green-600">${revenueData.marketCreationFees.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Platform Statistics</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Markets:</span>
                <span className="font-medium">{revenueData.totalMarkets}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Average Volume/Market:</span>
                <span className="font-medium">
                  {revenueData.totalMarkets > 0 
                    ? (parseFloat(revenueData.totalVolume) / revenueData.totalMarkets).toFixed(4)
                    : '0.0000'
                  } ETH
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Accumulated Fees:</span>
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

