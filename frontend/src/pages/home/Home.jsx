import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useWeb3 } from '../../hooks/useWeb3';
import { ethers } from 'ethers';
import ModernMarketCard from '../../components/modern/ModernMarketCard';

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

// Generate image URL based on category and market ID (Polymarket-style)
const getMarketImage = (market) => {
  const marketId = market.id || '0';
  
  // First, check if there's a stored image URL in localStorage
  try {
    const marketImages = JSON.parse(localStorage.getItem('marketImages') || '{}');
    if (marketImages[marketId]) {
      return marketImages[marketId];
    }
  } catch (err) {
    console.log('Error reading market images from localStorage');
  }
  
  // If market has an imageUrl prop, use it
  if (market.imageUrl) {
    return market.imageUrl;
  }
  
  // Otherwise, generate a placeholder based on category
  const category = market.category || 'General';
  
  // Use Unsplash API for category-based images
  const categoryKeywords = {
    'Technology': 'technology,computer,digital',
    'Crypto': 'cryptocurrency,bitcoin,blockchain',
    'Sports': 'sports,athlete,competition',
    'Politics': 'politics,government,democracy',
    'Entertainment': 'entertainment,showbiz,celebrity',
    'Economics': 'economics,money,finance',
    'Science': 'science,research,laboratory',
    'General': 'abstract,pattern,design'
  };
  
  const keywords = categoryKeywords[category] || categoryKeywords['General'];
  // Use a deterministic seed based on market ID for consistent images
  const seed = parseInt(marketId) % 1000;
  
  return `https://source.unsplash.com/200x200/?${keywords}&sig=${seed}`;
};

// Market Card Component - Modern Style with Image on Left
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
      className="bg-white rounded-2xl shadow-sm border border-gray-200 hover:shadow-xl hover:border-blue-400 hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden group"
    >
      <div className="flex">
        {/* Image on Left Corner - Modern Style */}
        <div className="relative w-28 h-28 flex-shrink-0 bg-gradient-to-br from-gray-100 via-gray-50 to-gray-200 overflow-hidden">
          <img
            src={getMarketImage(market)}
            alt={market.questionTitle || 'Market'}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.parentElement.className = 'relative w-28 h-28 flex-shrink-0 bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100';
            }}
          />
          {/* Category Badge Overlay - Modern */}
          <div className="absolute top-2 left-2">
            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold shadow-lg backdrop-blur-sm ${getCategoryColor(market.category)}`}>
              {market.category || 'General'}
            </span>
          </div>
          {/* Time Badge Overlay */}
          <div className="absolute bottom-2 right-2">
            <span className="px-2 py-0.5 rounded-md text-xs font-semibold text-gray-700 bg-white/90 backdrop-blur-sm shadow-sm">
              {getTimeRemaining(market.resolutionDateTime)}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 min-w-0">
          {/* Question Title */}
          <h3 className="text-gray-900 font-bold mb-4 line-clamp-2 leading-tight text-lg group-hover:text-blue-600 transition-colors">
            {market.questionTitle}
          </h3>

          {/* Price Display - Modern Style */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2.5">
              <div className="flex items-center space-x-1.5 bg-green-50 px-3 py-1.5 rounded-lg">
                <div className="w-2.5 h-2.5 bg-green-500 rounded-full shadow-sm"></div>
                <span className="text-xs font-semibold text-gray-700">{market.yesLabel || 'YES'}</span>
              </div>
              <span className="text-2xl font-extrabold text-green-600">
                {yesPrice}¢
              </span>
            </div>
            <div className="flex items-center space-x-2.5">
              <span className="text-2xl font-extrabold text-red-600">
                {noPrice}¢
              </span>
              <div className="flex items-center space-x-1.5 bg-red-50 px-3 py-1.5 rounded-lg">
                <span className="text-xs font-semibold text-gray-700">{market.noLabel || 'NO'}</span>
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full shadow-sm"></div>
              </div>
            </div>
          </div>

          {/* Progress Bar - Enhanced Modern */}
          <div className="w-full bg-gray-100 rounded-full h-2.5 mb-4 overflow-hidden relative shadow-inner">
            <div 
              className="bg-gradient-to-r from-green-500 via-green-500 to-green-600 h-2.5 rounded-l-full transition-all duration-500 absolute left-0 top-0 shadow-sm"
              style={{ width: `${yesPrice}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
            </div>
            <div 
              className="bg-gradient-to-r from-red-500 via-red-500 to-red-600 h-2.5 rounded-r-full transition-all duration-500 absolute right-0 top-0 shadow-sm"
              style={{ width: `${noPrice}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
            </div>
          </div>

          {/* Volume/Activity - Modern Footer */}
          <div className="flex items-center justify-between text-xs pt-3 border-t border-gray-100">
            <div className="flex items-center space-x-1">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span className="font-semibold text-gray-600">Volume:</span>
              <span className="font-bold text-gray-900">${formatVolumeDisplay(market.totalVolume)}</span>
            </div>
            <div className="flex items-center space-x-1">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span className="font-semibold text-gray-600">{market.totalBets || 0}</span>
              <span className="text-gray-500">traders</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Category Filter Component - Polymarket Style (Horizontal Text Bar)
const CategoryFilter = ({ categories, selectedCategory, onCategoryChange }) => {
  const [showMore, setShowMore] = useState(false);
  const allCategories = ['All', ...categories];
  const visibleCategories = allCategories.slice(0, 8);
  const moreCategories = allCategories.slice(8);

  return (
    <div className="mb-8">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-4">
        <div className="flex items-center space-x-1 overflow-x-auto scrollbar-hide">
          {visibleCategories.map((category, index) => (
            <React.Fragment key={category}>
              {index > 0 && (
                <div className="h-4 w-px bg-gray-300 mx-2 flex-shrink-0"></div>
              )}
              <button
                onClick={() => onCategoryChange(category)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
                  selectedCategory === category 
                    ? 'text-blue-600 bg-blue-50 font-semibold' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {category === 'All' && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                )}
                {category === 'Trending' && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                )}
                <span>{category}</span>
              </button>
            </React.Fragment>
          ))}
          
          {moreCategories.length > 0 && (
            <>
              <div className="h-4 w-px bg-gray-300 mx-2 flex-shrink-0"></div>
              <div className="relative">
                <button
                  onClick={() => setShowMore(!showMore)}
                  className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
                    showMore
                      ? 'text-blue-600 bg-blue-50 font-semibold'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <span>More</span>
                  <svg 
                    className={`w-4 h-4 transition-transform duration-200 ${showMore ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {showMore && (
                  <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-10 min-w-[200px] py-2">
                    {moreCategories.map((category) => (
                      <button
                        key={category}
                        onClick={() => {
                          onCategoryChange(category);
                          setShowMore(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm font-medium transition-colors ${
                          selectedCategory === category
                            ? 'text-blue-600 bg-blue-50 font-semibold'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
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
    
    // Auto-refresh markets every 30 seconds to show real-time updates
    const refreshInterval = setInterval(() => {
      if (isConnected && contracts.predictionMarket) {
        fetchMarkets();
      }
    }, 30000);
    
    return () => clearInterval(refreshInterval);
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
        {/* Header - Modern Style */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold mb-2 text-gray-900">DegenPoly</h1>
              <p className="text-gray-600 text-lg">
                Trade on the outcome of future events
              </p>
            </div>
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
            {filteredMarkets.map((market, index) => (
              <ModernMarketCard key={market.id || index} market={market} showBuyButtons={true} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Home;
