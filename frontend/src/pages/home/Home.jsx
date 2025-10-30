import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useWeb3 } from '../../hooks/useWeb3';
import { ethers } from 'ethers';

// Helper function to format volume
const formatVolumeDisplay = (volume) => {
  if (!volume || volume === 0) return '0';
  // If volume is extremely large (likely Wei that wasn't converted), convert it
  if (volume > 1e12) {
    const ethValue = volume / 1e18;
    return `${ethValue.toFixed(2)} ETH`;
  }
  // Format with 2 decimal places for readability
  return volume.toFixed(2);
};

// Market Card Component - Dribbble Style
const MarketCard = ({ market }) => {
  const history = useHistory();
  const probability = market.currentProbability || market.initialProbability || 0.5;
  const probabilityPercent = Math.round(probability * 100);
  
  // Use actual prices from LMSR if available
  const yesPrice = market.yesPrice !== undefined ? Math.round(market.yesPrice) : probabilityPercent;
  const noPrice = market.noPrice !== undefined ? Math.round(market.noPrice) : (100 - probabilityPercent);
  
  const handleCardClick = () => {
    history.push(`/markets/${market.id}`);
  };

  const getCategoryColor = (category) => {
    const colors = {
      'Technology': 'bg-blue-500 text-white',
      'Crypto': 'bg-blue-600 text-white',
      'Sports': 'bg-green-500 text-white',
      'Politics': 'bg-red-500 text-white',
      'Entertainment': 'bg-purple-500 text-white',
      'Economics': 'bg-yellow-500 text-white',
      'Science': 'bg-indigo-500 text-white',
      'Medical': 'bg-teal-500 text-white',
      'AI': 'bg-orange-500 text-white',
      'Startups': 'bg-pink-500 text-white',
      'default': 'bg-gray-500 text-white'
    };
    return colors[category] || colors.default;
  };

  const getTimeRemaining = (resolutionDate) => {
    if (!resolutionDate) return 'No end date';
    const now = new Date();
    const end = new Date(resolutionDate);
    const diff = end - now;
    
    if (diff <= 0) return 'Ended';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  return (
    <div 
      onClick={handleCardClick}
      className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all duration-200 cursor-pointer overflow-hidden"
    >
      {/* Header with Category Badge and Time */}
      <div className="p-5 pb-4">
        <div className="flex items-center justify-between mb-3">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getCategoryColor(market.category)}`}>
            {market.category || 'General'}
          </span>
          <span className="text-xs font-medium text-gray-500">
            {getTimeRemaining(market.resolutionDateTime)}
          </span>
        </div>

        {/* Question */}
        <h3 className="text-gray-900 font-semibold mb-4 line-clamp-2 leading-snug text-base">
          {market.questionTitle}
        </h3>

        {/* Price Display - More Prominent */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1.5">
              <div className="w-2.5 h-2.5 bg-green-500 rounded-full"></div>
              <span className="text-sm font-medium text-gray-600">{market.yesLabel || 'YES'}</span>
            </div>
            <span className="text-2xl font-bold text-green-600">
              {yesPrice}¢
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-2xl font-bold text-red-600">
              {noPrice}¢
            </span>
            <div className="flex items-center space-x-1.5">
              <span className="text-sm font-medium text-gray-600">{market.noLabel || 'NO'}</span>
              <div className="w-2.5 h-2.5 bg-red-500 rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Progress Bar - Enhanced */}
        <div className="w-full bg-gray-100 rounded-full h-2.5 mb-4 overflow-hidden relative">
          <div 
            className="bg-gradient-to-r from-green-500 to-green-600 h-2.5 rounded-l-full transition-all duration-300 absolute left-0 top-0"
            style={{ width: `${yesPrice}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
          </div>
          <div 
            className="bg-gradient-to-r from-red-500 to-red-600 h-2.5 rounded-r-full transition-all duration-300 absolute right-0 top-0"
            style={{ width: `${noPrice}%` }}
          ></div>
        </div>

        {/* Volume/Activity */}
        <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
          <span className="font-medium">Volume: <span className="text-gray-900">${formatVolumeDisplay(market.totalVolume)}</span></span>
          <span className="font-medium">{market.totalBets || 0} traders</span>
        </div>
      </div>
    </div>
  );
};

// Category Filter Component - Dribbble Style
const CategoryFilter = ({ categories, selectedCategory, onCategoryChange }) => {
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      <button
        onClick={() => onCategoryChange('All')}
        className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 ${
          selectedCategory === 'All' 
            ? 'bg-blue-600 text-white shadow-md' 
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        All
      </button>
      {categories.map(category => (
        <button
          key={category}
          onClick={() => onCategoryChange(category)}
          className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 ${
            selectedCategory === category 
              ? 'bg-blue-600 text-white shadow-md' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {category}
        </button>
      ))}
    </div>
  );
};

function Home() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const { isConnected, account, connectWallet, contracts, networkName, ethBalance, getMarketData } = useWeb3();

  // Fetch markets from blockchain
  useEffect(() => {
    const fetchMarkets = async () => {
      if (!isConnected || !contracts.predictionMarket) {
        console.log('⚠️ Not connected or no contract');
        setMarkets([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        console.log('📊 Fetching markets from blockchain...');
        console.log('Contract address:', contracts.predictionMarket.address);
        
        const rawIds = await contracts.predictionMarket.getActiveMarkets();
        console.log('Active market IDs:', rawIds);
        console.log('Active market IDs length:', rawIds.length);

        const activeMarketIds = rawIds
          .map((marketIdRaw) => {
            try {
              const normalizedId = ethers.BigNumber.isBigNumber(marketIdRaw)
                ? marketIdRaw
                : ethers.BigNumber.from(marketIdRaw);

              if (normalizedId.lte(0)) {
                console.warn(`Skipping non-positive market id: ${normalizedId.toString()}`);
                return null;
              }

              return normalizedId;
            } catch (normalizationError) {
              console.warn('Skipping invalid market id from contract:', marketIdRaw, normalizationError);
              return null;
            }
          })
          .filter(Boolean);

        if (activeMarketIds.length === 0) {
          console.log('⚠️ No active markets found');
          setMarkets([]);
          setLoading(false);
          return;
        }

        const marketPromises = activeMarketIds.map(async (marketId) => {
          try {
            // Use getMarketData function to get complete market data with LMSR pricing
            const marketData = await getMarketData(marketId);
            console.log(`Market ${marketId} - marketData:`, marketData);

            return {
              id: marketData.id,
              questionTitle: marketData.question,
              description: marketData.description,
              category: marketData.category,
              resolutionDateTime: new Date(Number(marketData.resolutionTime) * 1000).toISOString(),
              createdAt: new Date(Number(marketData.createdAt) * 1000).toISOString(),
              endTime: marketData.endTime,
              resolved: marketData.resolved,
              active: marketData.active,
              yesLabel: "YES",
              noLabel: "NO",
              currentProbability: parseFloat(marketData.yesPrice) / 100, // Use LMSR price from marketData
              yesPrice: marketData.yesPrice,
              noPrice: marketData.noPrice,
              initialProbability: 0.5,
              totalVolume: parseFloat(ethers.utils.formatEther(marketData.totalVolume)),
              totalBets: 0 // We'd need to track this separately
            };
          } catch (error) {
            console.error(`Error fetching market ${marketId}:`, error);
            return null;
          }
        });
        
        const marketsData = await Promise.all(marketPromises);
        const validMarkets = marketsData.filter(market => market !== null);
        setMarkets(validMarkets);
        console.log('✅ Loaded markets from blockchain:', validMarkets);
      } catch (error) {
        console.error('❌ Failed to load markets:', error);
        setMarkets([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMarkets();
  }, [isConnected, contracts.predictionMarket, getMarketData]);

  // Extract unique categories from markets
  const categories = [...new Set(markets.map(m => m.category).filter(Boolean))];

  const filteredMarkets = selectedCategory === 'All' 
    ? markets 
    : markets.filter(m => (m.category || 'General') === selectedCategory);

  if (loading) {
    return (
      <div className='min-h-screen bg-gray-50'>
        <div className='max-w-7xl mx-auto px-4 py-8'>
          <div className='text-center py-16'>
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
            <p className='text-lg font-medium text-gray-600'>Loading markets from blockchain...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50'>
      <div className='max-w-7xl mx-auto px-4 py-8'>
        {/* Header - Dribbble Style */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold mb-2 text-gray-900">Prediction Markets</h1>
              <p className="text-gray-600 text-lg">
                Trade on the outcome of future events
              </p>
            </div>
            
            {/* Wallet Status - Enhanced */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 text-sm font-medium text-gray-600 bg-white px-3 py-2 rounded-lg border border-gray-200">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>Live Data</span>
              </div>
              
              {isConnected ? (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
                    <span className="text-sm font-medium text-blue-800">{networkName || 'Network'}</span>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-medium text-green-800">
                        {account?.slice(0, 6)}...{account?.slice(-4)}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <button
                  onClick={connectWallet}
                  className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg"
                >
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stats Bar - Enhanced Dribbble Style */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-3xl font-bold text-blue-600 mb-1">{markets.length}</div>
            <div className="text-sm font-medium text-gray-600">Active Markets</div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-3xl font-bold text-green-600 mb-1">
              ${formatVolumeDisplay(markets.reduce((sum, m) => sum + (m.totalVolume || 0), 0))}
            </div>
            <div className="text-sm font-medium text-gray-600">Total Volume</div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-3xl font-bold text-purple-600 mb-1">
              {markets.reduce((sum, m) => sum + (m.totalBets || 0), 0)}
            </div>
            <div className="text-sm font-medium text-gray-600">Total Trades</div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-3xl font-bold text-yellow-600 mb-1">{categories.length}</div>
            <div className="text-sm font-medium text-gray-600">Categories</div>
          </div>
        </div>

        {/* Category Filter */}
        <CategoryFilter 
          categories={categories}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />

        {/* Markets Grid - Enhanced Spacing */}
        {filteredMarkets.length === 0 ? (
          <div className='text-center py-16 bg-white rounded-xl border border-gray-200'>
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className='text-xl font-semibold text-gray-700 mb-2'>No markets found</p>
            <p className='text-gray-500'>Try selecting a different category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMarkets.slice(0, 12).map((market, index) => (
              <MarketCard key={market.id || index} market={market} />
            ))}
          </div>
        )}

        {/* View All Button - Enhanced */}
        {filteredMarkets.length > 12 && (
          <div className="text-center mt-10">
            <button 
              onClick={() => window.location.href = '/markets'}
              className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-3.5 rounded-lg font-semibold transition-all duration-200 shadow-md hover:shadow-lg"
            >
              See all markets
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Home;
