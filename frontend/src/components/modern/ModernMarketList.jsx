import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import ModernMarketCard from './ModernMarketCard';
import { useWeb3 } from '../../hooks/useWeb3';

const ModernMarketList = () => {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('volume'); // volume, newest, ending
  const [searchTerm, setSearchTerm] = useState('');
  
  // Get Web3 context
  let web3Context;
  try {
    web3Context = useWeb3();
  } catch (error) {
    console.error('Web3 context error:', error);
    web3Context = { isConnected: false, contracts: {} };
  }
  
  const { isConnected, contracts } = web3Context;

  useEffect(() => {
    fetchMarkets();
    
    // Auto-refresh markets every 15 seconds to show real-time price and volume updates
    const refreshInterval = setInterval(() => {
      if (isConnected && contracts.predictionMarket) {
        fetchMarkets();
      }
    }, 15000);
    
    return () => clearInterval(refreshInterval);
  }, [isConnected, contracts.predictionMarket]);

  const fetchMarkets = async () => {
    try {
      // Fetch markets directly from smart contract
      if (isConnected && contracts.predictionMarket) {
        console.log('📊 Fetching markets from smart contract...');
        const activeMarketIds = await contracts.predictionMarket.getActiveMarkets();
        console.log('Active market IDs:', activeMarketIds);
        
        if (activeMarketIds.length === 0) {
          console.log('⚠️ No active markets found on blockchain');
          setMarkets([]);
          setLoading(false);
          return;
        }
        
        const marketPromises = activeMarketIds.map(async (marketId) => {
          try {
            const market = await contracts.predictionMarket.getMarket(marketId);
            const yesPrice = await contracts.predictionMarket.getCurrentPrice(marketId, true);
            const noPrice = await contracts.predictionMarket.getCurrentPrice(marketId, false);
            
            return {
              market: {
                id: market.id.toString(),
                questionTitle: market.question,
                description: market.description,
                category: market.category,
                resolutionDateTime: new Date(market.resolutionTime.toNumber() * 1000).toISOString(),
                createdAt: new Date(market.createdAt.toNumber() * 1000).toISOString(),
                endTime: market.endTime.toNumber(),
                resolved: market.resolved,
                active: market.active,
                yesLabel: "YES",
                noLabel: "NO"
              },
              totalVolume: parseFloat(ethers.utils.formatEther(market.totalVolume)),
              numUsers: 0, // We'd need to track this separately
              lastProbability: parseFloat(yesPrice.toString()) / 10000 // Convert basis points to probability (5000 -> 0.5)
            };
          } catch (error) {
            console.error(`Error fetching market ${marketId}:`, error);
            return null;
          }
        });
        
        const marketsData = await Promise.all(marketPromises);
        const validMarkets = marketsData.filter(market => market !== null);
        const footballMarkets = validMarkets
          .filter(({ market }) => {
            const sourceCategory = (market?.category || '').toLowerCase();
            if (!sourceCategory) return false;
            return sourceCategory.includes('football') || sourceCategory.includes('soccer');
          })
          .map((marketData) => ({
            ...marketData,
            market: {
              ...marketData.market,
              category: 'Football'
            }
          }));

        setMarkets(footballMarkets);
        console.log('✅ Loaded football markets from blockchain:', footballMarkets);
      } else {
        console.log('⚠️ Wallet not connected or contracts not loaded');
        setMarkets([]);
      }
    } catch (error) {
      console.error('❌ Failed to load markets from blockchain:', error);
      setMarkets([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedMarkets = markets
    .filter(m => {
      const market = m.market;
      const matchesSearch = !searchTerm || market?.questionTitle?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    })
    .sort((a, b) => {
      const marketA = a.market;
      const marketB = b.market;
      
      switch (sortBy) {
        case 'volume':
          return (b.totalVolume || 0) - (a.totalVolume || 0);
        case 'newest':
          return new Date(marketB.createdAt || 0) - new Date(marketA.createdAt || 0);
        case 'ending':
          return new Date(marketA.resolutionDateTime || 0) - new Date(marketB.resolutionDateTime || 0);
        default:
          return 0;
      }
    });

  const handleBuy = (marketId, side) => {
    // Navigate to market details for trading
    console.log(`Buy ${side} for market ${marketId}`);
    window.location.href = `/markets/${marketId}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-600">Loading markets from blockchain...</span>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Connect Your Wallet</h3>
          <p className="text-gray-600">Connect your MetaMask wallet to view and trade markets.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Football Markets</h1>
        <p className="text-gray-600">Trade on upcoming football results with ETH</p>
        {markets.length > 0 && (
          <div className="mt-2 text-sm text-green-600">
            ✅ {markets.length} active markets loaded from blockchain
          </div>
        )}
      </div>

      {markets.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Markets Available</h3>
          <p className="text-gray-600 mb-4">No markets have been created yet.</p>
          <p className="text-sm text-gray-500">Markets are loaded directly from the blockchain smart contract.</p>
        </div>
      ) : (
        <>
          {/* Search and Sort */}
          <div className="mb-6 space-y-4">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search markets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Sort */}
            <div className="flex justify-end">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="volume">Highest Volume</option>
                <option value="newest">Newest</option>
                <option value="ending">Ending Soon</option>
              </select>
            </div>
          </div>

          {/* Results Count */}
          <div className="mb-4">
            <p className="text-sm text-gray-600">
              {filteredAndSortedMarkets.length} football market{filteredAndSortedMarkets.length !== 1 ? 's' : ''}
              {searchTerm && ` matching "${searchTerm}"`}
            </p>
          </div>

          {/* Markets Grid */}
          {filteredAndSortedMarkets.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No markets found</h3>
              <p className="text-gray-600">Try adjusting your search or filter criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAndSortedMarkets.map((marketData, index) => (
                <ModernMarketCard
                  key={marketData.market?.id || index}
                  market={{
                    ...marketData.market,
                    totalVolume: marketData.totalVolume,
                    numUsers: marketData.numUsers,
                    currentProbability: marketData.lastProbability
                  }}
                  showBuyButtons={isConnected}
                  onBuy={handleBuy}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ModernMarketList;