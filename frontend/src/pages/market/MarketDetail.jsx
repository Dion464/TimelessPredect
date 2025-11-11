import React, { useState, useEffect } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import useMarketData from '../../hooks/useMarketData';
import useWallet from '../../hooks/useWallet';
import AdvancedTradingInterface from '../../components/trading/AdvancedTradingInterface';
import PriceChart from '../../components/charts/PriceChart';

// Generate image URL based on category and market ID (Polymarket-style)
const getMarketImage = (market, marketIdParam) => {
  if (!market) return 'https://source.unsplash.com/200x200/?abstract,pattern,design';
  
  // Get market ID - handle both string and number formats, try multiple ways
  const marketId = market.id?.toString() || 
                   market.marketId?.toString() || 
                   marketIdParam?.toString() || 
                   String(market.id) ||
                   '0';
  
  console.log('🔍 Getting market image:', { 
    marketId, 
    marketIdParam, 
    marketIdType: typeof marketId,
    market: market 
  });
  
  // First, check if there's a stored image URL in localStorage
  // Check both string and number formats
  try {
    const marketImages = JSON.parse(localStorage.getItem('marketImages') || '{}');
    console.log('📦 Stored market images:', marketImages);
    
    // Try exact match first
    if (marketImages[marketId]) {
      console.log('✅ Found stored image:', marketImages[marketId]);
      return marketImages[marketId];
    }
    
    // Try number format
    const numId = parseInt(marketId);
    if (!isNaN(numId) && marketImages[numId.toString()]) {
      console.log('✅ Found stored image (number format):', marketImages[numId.toString()]);
      return marketImages[numId.toString()];
    }
    
    // Try all keys to find a match
    for (const key in marketImages) {
      if (parseInt(key) === numId || key === marketId) {
        console.log('✅ Found stored image (key match):', marketImages[key]);
        return marketImages[key];
      }
    }
  } catch (err) {
    console.log('❌ Error reading market images from localStorage:', err);
  }
  
  // If market has an imageUrl prop, use it
  if (market?.imageUrl) {
    return market.imageUrl;
  }
  
  // Otherwise, generate a placeholder based on category
  const category = market?.category || 'General';
  
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
  
  const imageUrl = `https://source.unsplash.com/200x200/?${keywords}&sig=${seed}`;
  console.log('🖼️ Generated image URL:', imageUrl);
  return imageUrl;
};

const MarketDetail = () => {
  const { id } = useParams();
  const history = useHistory();
  const [activeTab, setActiveTab] = useState('trade');

  const { 
    getMarket, 
    getPriceHistory, 
    loading, 
    error 
  } = useMarketData();

  const { isConnected, account } = useWallet();

  const market = getMarket(id);
  const priceHistory = getPriceHistory(parseInt(id));

  useEffect(() => {
    if (!loading && !market) {
      // Redirect to markets page if market not found
      history.push('/markets');
    }
  }, [market, loading, history]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading market data...</p>
        </div>
      </div>
    );
  }

  if (error || !market) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Market Not Found</h1>
          <p className="text-gray-600 mb-4">The market you're looking for doesn't exist.</p>
          <button
            onClick={() => history.push('/markets')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Back to Markets
          </button>
        </div>
      </div>
    );
  }

  const yesPrice = Math.round(market.currentProbability * 100);
  const noPrice = 100 - yesPrice;

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
    
    if (days > 0) return `${days}d ${hours}h remaining`;
    return `${hours}h remaining`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header - Modern Style with Image */}
        <div className="mb-8">
          <button
            onClick={() => history.goBack()}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-6 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-start space-x-6">
              {/* Market Image - Top Left Corner */}
              <div className="relative w-28 h-28 flex-shrink-0 rounded-xl overflow-hidden border-2 border-gray-200 bg-gradient-to-br from-gray-100 via-gray-50 to-gray-200">
                <img
                  src={getMarketImage(market, id)}
                  alt={market.questionTitle || 'Market'}
                  className="w-full h-full object-cover"
                  onLoad={() => console.log('✅ Image loaded successfully')}
                  onError={(e) => {
                    console.log('❌ Image failed to load, showing gradient fallback');
                    e.target.style.display = 'none';
                    // Ensure parent shows gradient
                    e.target.parentElement.className = 'relative w-28 h-28 flex-shrink-0 rounded-xl overflow-hidden border-2 border-gray-200 bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100';
                  }}
                />
                {/* Category Badge Overlay */}
                <div className="absolute top-1 left-1 z-10">
                  <span className={`px-2 py-0.5 rounded-md text-xs font-bold shadow-sm ${getCategoryColor(market.category)} text-white`}>
                    {market.category || 'General'}
                  </span>
                </div>
              </div>

              {/* Market Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h1 className="text-3xl font-bold text-gray-900 mb-3 leading-tight">
                      {market.questionTitle}
                    </h1>
                    
                    {/* Market Stats Row */}
                    <div className="flex items-center space-x-6 mb-4">
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        <span className="font-semibold text-gray-900">${market.totalVolume?.toLocaleString() || 0}</span>
                        <span>Vol.</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{new Date(market.resolutionDateTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>{getTimeRemaining(market.resolutionDateTime)}</span>
                      </div>
                    </div>

                    {/* Current Prices - Modern Display */}
                    <div className="flex items-center space-x-8">
                      <div className="flex items-center space-x-3 bg-green-50 px-4 py-2 rounded-lg">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-semibold text-gray-700">{market.yesLabel || 'Yes'}</span>
                        <span className="text-2xl font-bold text-green-600">{yesPrice}¢</span>
                      </div>
                      <div className="flex items-center space-x-3 bg-red-50 px-4 py-2 rounded-lg">
                        <span className="text-2xl font-bold text-red-600">{noPrice}¢</span>
                        <span className="text-sm font-semibold text-gray-700">{market.noLabel || 'No'}</span>
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      </div>
                    </div>
                  </div>

                  {/* Market Stats Card */}
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 ml-4 flex-shrink-0">
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-gray-900">
                          ${market.totalVolume?.toLocaleString() || 0}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">Volume</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-gray-900">
                          {market.totalBets?.toLocaleString() || 0}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">Traders</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs - Modern Style */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'trade', label: 'Trade' },
              { id: 'chart', label: 'Chart' },
              { id: 'about', label: 'About' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-1 border-b-2 font-semibold text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {activeTab === 'trade' && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <PriceChart 
                  priceHistory={priceHistory} 
                  marketId={parseInt(id)}
                  height={400}
                />
              </div>
            )}

            {activeTab === 'chart' && (
              <div>
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
                  <PriceChart 
                    priceHistory={priceHistory} 
                    marketId={parseInt(id)}
                    height={500}
                  />
                </div>
                
                {/* Additional chart controls */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Market Activity</h3>
                  <div className="text-sm text-gray-600">
                    <p>Real-time price updates and trading activity will be displayed here.</p>
                    <p className="mt-2">Features coming soon:</p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Volume indicators</li>
                      <li>Technical analysis tools</li>
                      <li>Historical volatility</li>
                      <li>Market depth visualization</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'about' && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">About This Market</h3>
                <div className="space-y-6 text-gray-700">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Question</h4>
                    <p className="text-gray-600">{market.questionTitle}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Resolution Criteria</h4>
                    <p className="text-gray-600">This market will resolve based on official sources and predetermined criteria. 
                    The resolution date is {new Date(market.resolutionDateTime).toLocaleDateString()}.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Market Details</h4>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Category:</span>
                        <span className="font-medium text-gray-900">{market.category}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Created:</span>
                        <span className="font-medium text-gray-900">{new Date().toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Resolution:</span>
                        <span className="font-medium text-gray-900">{new Date(market.resolutionDateTime).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Volume:</span>
                        <span className="font-medium text-gray-900">${market.totalVolume?.toLocaleString() || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Traders:</span>
                        <span className="font-medium text-gray-900">{market.totalBets?.toLocaleString() || 0}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">How It Works</h4>
                    <p className="text-gray-600 mb-3">Prediction markets allow you to trade on the outcome of future events. 
                    Prices represent the market's collective belief about the probability of an outcome.</p>
                    <ul className="list-disc list-inside space-y-2 text-gray-600">
                      <li>Buy "Yes" shares if you think the event will happen</li>
                      <li>Buy "No" shares if you think it won't happen</li>
                      <li>Shares pay out 1.00 TCENT if you're correct, 0.00 TCENT if you're wrong</li>
                      <li>You can sell your shares anytime before resolution</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Trading Sidebar */}
          <div className="lg:col-span-1">
            <AdvancedTradingInterface marketId={parseInt(id)} market={market} />

            {/* Wallet Status */}
            {!isConnected && (
              <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <h4 className="text-sm font-semibold text-yellow-800">Connect Your Wallet</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      Connect your wallet to start trading on this market.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Market Info */}
            <div className="mt-6 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <h4 className="text-sm font-semibold text-gray-900 mb-4">Market Information</h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Market ID:</span>
                  <span className="text-gray-900 font-semibold">#{market.id}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Status:</span>
                  <span className="text-green-600 font-semibold">Active</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Fee:</span>
                  <span className="text-gray-900 font-semibold">2%</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">Min Bet:</span>
                  <span className="text-gray-900 font-semibold">1.00 TCENT</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketDetail;
