import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useWeb3 } from '../../hooks/useWeb3';
import { ethers } from 'ethers';

// Market Card Component
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
      'Technology': 'bg-blue-500',
      'Sports': 'bg-green-500',
      'Politics': 'bg-red-500',
      'Entertainment': 'bg-purple-500',
      'Economics': 'bg-yellow-500',
      'Science': 'bg-indigo-500',
      'default': 'bg-gray-500'
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
      className="bg-gray-800 rounded-lg p-6 hover:bg-gray-750 transition-all duration-200 cursor-pointer border border-gray-700 hover:border-gray-600"
    >
      {/* Category Badge */}
      <div className="flex items-center justify-between mb-3">
        <span className={`px-2 py-1 rounded-full text-xs font-medium text-white ${getCategoryColor(market.category)}`}>
          {market.category || 'General'}
        </span>
        <span className="text-xs text-gray-400">
          {getTimeRemaining(market.resolutionDateTime)}
        </span>
      </div>

      {/* Question */}
      <h3 className="text-white font-medium mb-4 line-clamp-2 leading-snug">
        {market.questionTitle}
      </h3>

      {/* Probability Display */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-300">{market.yesLabel || 'Yes'}</span>
          </div>
          <span className="text-2xl font-bold text-green-400">
            {yesPrice}¢
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-2xl font-bold text-red-400">
            {noPrice}¢
          </span>
          <div className="flex items-center space-x-1">
            <span className="text-sm text-gray-300">{market.noLabel || 'No'}</span>
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-700 rounded-full h-2 mb-3">
        <div 
          className="bg-green-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${yesPrice}%` }}
        ></div>
      </div>

      {/* Volume/Activity */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>Volume: ${market.totalVolume || 0}</span>
        <span>{market.totalBets || 0} traders</span>
      </div>
    </div>
  );
};

// Category Filter Component
const CategoryFilter = ({ categories, selectedCategory, onCategoryChange }) => {
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      <button
        onClick={() => onCategoryChange('All')}
        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
          selectedCategory === 'All' 
            ? 'bg-blue-600 text-white' 
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        }`}
      >
        All
      </button>
      {categories.map(category => (
        <button
          key={category}
          onClick={() => onCategoryChange(category)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            selectedCategory === category 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
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
              totalVolume: parseFloat(marketData.totalVolume),
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
      <div className='min-h-screen bg-gray-900 text-white'>
        <div className='max-w-7xl mx-auto px-4 py-8'>
          <div className='text-center'>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className='text-lg text-gray-300'>Loading markets from blockchain...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50'>
      <div className='max-w-7xl mx-auto px-4 py-8'>
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2 text-gray-900">Prediction Markets</h1>
              <p className="text-gray-600 text-lg">
                Trade on the outcome of future events
              </p>
            </div>
            
            {/* Wallet Status */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Live Data</span>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-1">
                <span className="text-sm text-blue-800">{networkName || 'Not Connected'}</span>
              </div>
              
              {isConnected ? (
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-green-800">
                      {account?.slice(0, 6)}...{account?.slice(-4)}
                    </span>
                  </div>
                </div>
              ) : (
                <button
                  onClick={connectWallet}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="text-2xl font-bold text-blue-600">{markets.length}</div>
            <div className="text-sm text-gray-600">Active Markets</div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="text-2xl font-bold text-green-600">
              ${markets.reduce((sum, m) => sum + (m.totalVolume || 0), 0).toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Total Volume</div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="text-2xl font-bold text-purple-600">
              {markets.reduce((sum, m) => sum + (m.totalBets || 0), 0)}
            </div>
            <div className="text-sm text-gray-600">Total Trades</div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="text-2xl font-bold text-yellow-600">{categories.length}</div>
            <div className="text-sm text-gray-600">Categories</div>
          </div>
        </div>

        {/* Category Filter */}
        <CategoryFilter 
          categories={categories}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />

        {/* Markets Grid */}
        {filteredMarkets.length === 0 ? (
          <div className='text-center py-12'>
            <p className='text-xl text-gray-600'>No markets found in this category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMarkets.slice(0, 12).map((market, index) => (
              <MarketCard key={market.id || index} market={market} />
            ))}
          </div>
        )}

        {/* View All Button */}
        {filteredMarkets.length > 12 && (
          <div className="text-center mt-8">
            <button 
              onClick={() => window.location.href = '/markets'}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-colors"
            >
              View All Markets
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Home;
