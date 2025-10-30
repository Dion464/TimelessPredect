import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';

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
  
  const probability = market.currentProbability || market.initialProbability || 0.5;
  const yesPrice = Math.round(probability * 100);
  const noPrice = 100 - yesPrice;
  
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

  return (
    <div 
      onClick={handleCardClick}
      className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-all duration-200 cursor-pointer overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <span className={`px-2 py-1 rounded-full text-xs font-medium text-white ${getCategoryColor(market.category)}`}>
            {market.category || 'General'}
          </span>
          <span className="text-xs text-gray-500">
            {formatTimeRemaining(market.resolutionDateTime)}
          </span>
        </div>
        
        <h3 className="text-gray-900 font-medium text-sm leading-tight mb-3 line-clamp-3">
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
                {yesPrice}¢
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
                {noPrice}¢
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

