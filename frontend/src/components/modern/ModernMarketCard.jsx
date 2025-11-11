import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { centsToTCENT } from '../../utils/priceFormatter';

// Helper function to format volume
const formatVolumeDisplay = (volume) => {
  if (!volume || volume === 0) return '0.00';
  // If volume is extremely large (likely Wei that wasn't converted), convert it
  if (volume > 1e12) {
    const ethValue = volume / 1e18;
    return `${ethValue.toFixed(2)} ETH`;
  }
  // Format with 2 decimal places for readability
  return volume.toFixed(2);
};

const ModernMarketCard = ({ market, showBuyButtons = false, onBuy }) => {
  const history = useHistory();
  const [hoveredSide, setHoveredSide] = useState(null);
  
  // Use actual prices from market if available (from blockchain), otherwise calculate from probability
  let yesPrice, noPrice;
  if (market.yesPrice !== undefined && market.noPrice !== undefined) {
    // Prices are already in cents from blockchain
    yesPrice = Math.round(market.yesPrice);
    noPrice = Math.round(market.noPrice);
  } else {
    // Fallback to probability calculation
    const probability = market.currentProbability || market.initialProbability || 0.5;
    yesPrice = Math.round(probability * 100);
    noPrice = 100 - yesPrice;
  }
  
  const handleCardClick = (e) => {
    // Don't navigate if clicking on buy buttons
    if (e.target.closest('.buy-button')) return;
    console.log('Card clicked, navigating to market:', market.id);
    history.push(`/markets/${market.id}`);
  };

  const handleBuy = (side, e) => {
    e.stopPropagation();
    if (onBuy) {
      onBuy(market.id, side);
    }
  };

  const formatTimeRemaining = (resolutionDate) => {
    if (!resolutionDate) return 'No end date';
    const now = new Date();
    const end = new Date(resolutionDate);
    const diff = end - now;
    
    if (diff <= 0) return 'Ended';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 30) return `${Math.floor(days / 30)}mo`;
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    return 'Soon';
  };

  const getCategoryColor = (category) => {
    const colors = {
      'Technology': 'bg-blue-500',
      'Sports': 'bg-green-500', 
      'Politics': 'bg-red-500',
      'Entertainment': 'bg-purple-500',
      'Economics': 'bg-yellow-500',
      'Science': 'bg-indigo-500'
    };
    return colors[category] || 'bg-gray-500';
  };

  // Generate image URL based on category and market ID (Polymarket-style)
  const getMarketImage = () => {
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
    
    return `https://source.unsplash.com/400x200/?${keywords}&sig=${seed}`;
  };

  return (
    <div 
      onClick={handleCardClick}
      className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-all duration-200 cursor-pointer overflow-hidden shadow-sm hover:shadow-md"
    >
      {/* Market Image */}
      <div className="relative w-full h-40 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
        <img
          src={getMarketImage()}
          alt={market.questionTitle || 'Market'}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback to gradient if image fails to load
            e.target.style.display = 'none';
            e.target.parentElement.className = 'relative w-full h-40 bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100';
          }}
        />
        <div className="absolute top-2 left-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium text-white shadow-sm ${getCategoryColor(market.category)}`}>
            {market.category || 'General'}
          </span>
        </div>
        <div className="absolute top-2 right-2">
          <span className="px-2 py-1 rounded-full text-xs font-medium text-white bg-black bg-opacity-50 backdrop-blur-sm">
            {formatTimeRemaining(market.resolutionDateTime)}
          </span>
        </div>
      </div>

      {/* Header */}
      <div className="p-4 pb-3">
        <h3 className="text-gray-900 font-medium text-sm leading-tight mb-3 line-clamp-2">
          {market.questionTitle}
        </h3>
      </div>

      {/* Betting Interface */}
      <div className="px-4 pb-4">
        <div className="grid grid-cols-2 gap-2">
          {/* Yes Button */}
          <button
            className={`buy-button relative p-3 rounded-lg border-2 transition-all duration-200 ${
              hoveredSide === 'yes' 
                ? 'border-green-500 bg-green-50' 
                : 'border-green-200 hover:border-green-300 hover:bg-green-50'
            }`}
            onMouseEnter={() => setHoveredSide('yes')}
            onMouseLeave={() => setHoveredSide(null)}
            onClick={(e) => handleBuy('yes', e)}
            disabled={!showBuyButtons}
          >
            <div className="text-center">
              <div className="text-xs text-gray-600 mb-1">
                {market.yesLabel || 'Yes'}
              </div>
              <div className="text-lg font-bold text-green-600">
                {centsToTCENT(yesPrice)} TCENT
              </div>
              {showBuyButtons && (
                <div className="text-xs text-green-600 mt-1">
                  Buy
                </div>
              )}
            </div>
          </button>

          {/* No Button */}
          <button
            className={`buy-button relative p-3 rounded-lg border-2 transition-all duration-200 ${
              hoveredSide === 'no' 
                ? 'border-red-500 bg-red-50' 
                : 'border-red-200 hover:border-red-300 hover:bg-red-50'
            }`}
            onMouseEnter={() => setHoveredSide('no')}
            onMouseLeave={() => setHoveredSide(null)}
            onClick={(e) => handleBuy('no', e)}
            disabled={!showBuyButtons}
          >
            <div className="text-center">
              <div className="text-xs text-gray-600 mb-1">
                {market.noLabel || 'No'}
              </div>
              <div className="text-lg font-bold text-red-600">
                {centsToTCENT(noPrice)} TCENT
              </div>
              {showBuyButtons && (
                <div className="text-xs text-red-600 mt-1">
                  Buy
                </div>
              )}
            </div>
          </button>
        </div>

        {/* Volume Info */}
        <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
          <span>${formatVolumeDisplay(market.totalVolume)} vol</span>
          <span>{market.totalBets || 0} traders</span>
        </div>
      </div>
    </div>
  );
};

export default ModernMarketCard;

