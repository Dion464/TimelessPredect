import React from 'react';
import { useHistory } from 'react-router-dom';
import '../../pages/market/MarketDetailGlass.css';

// Helper function to format volume
const formatVolumeDisplay = (volume) => {
  if (!volume || volume === 0) return '$0';
  // If volume is extremely large (likely Wei that wasn't converted), convert it
  if (volume > 1e12) {
    const ethValue = volume / 1e18;
    if (ethValue >= 1e6) return `$${(ethValue / 1e6).toFixed(1)}m`;
    if (ethValue >= 1e3) return `$${(ethValue / 1e3).toFixed(1)}k`;
    return `$${ethValue.toFixed(2)}`;
  }
  // Format with appropriate suffix
  if (volume >= 1e6) return `$${(volume / 1e6).toFixed(1)}m`;
  if (volume >= 1e3) return `$${(volume / 1e3).toFixed(1)}k`;
  return `$${volume.toFixed(2)}`;
};

const ModernMarketCard = ({ market, showBuyButtons = false, onBuy }) => {
  const history = useHistory();
  
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
    history.push(`/markets/${market.id}`);
  };

  const handleBuy = (side, e) => {
    e.stopPropagation();
    if (onBuy) {
      onBuy(market.id, side);
    }
  };

  // Generate image URL based on category and market ID
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
    const seed = parseInt(marketId) % 1000;
    
    return `https://source.unsplash.com/400x200/?${keywords}&sig=${seed}`;
  };

  // Calculate progress bar width (YES percentage)
  const progressWidth = `${yesPrice}%`;

  return (
    <div 
      onClick={handleCardClick}
      className="glass-card box-shadow cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(247,208,34,0.15)]"
      style={{
        width: '100%',
        minHeight: '220px',
        // Lighter, clearer glass background
        background: 'linear-gradient(135deg, rgba(18,18,18,0.68), rgba(40,40,40,0.52))',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderRadius: '14px',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.06), 0 18px 45px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.14)',
        overflow: 'hidden'
      }}
    >
      <div style={{ padding: '20px 18px', height: '100%', display: 'flex', flexDirection: 'column' }}>
        
        {/* Top Section: Icon + Title + Volume */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', marginBottom: '20px' }}>
          {/* Market Icon */}
          <div 
            style={{
              width: '48px',
              height: '54px',
              borderRadius: '8px',
              overflow: 'hidden',
              flexShrink: 0,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
            }}
          >
            <img
              src={getMarketImage()}
              alt={market.questionTitle || 'Market'}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
          
          {/* Title and Volume */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 
              style={{
                fontFamily: '"Clash Grotesk", "Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontWeight: 600, 
                fontSize: '16.09px',
                lineHeight: '22.98px',
                color: '#F2F2F2',
                margin: 0,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}
            >
              {market.questionTitle || market.question}
            </h3>
          </div>
          
          {/* Volume */}
          <div 
            style={{
              fontFamily: '"Clash Grotesk", "Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontWeight: 400,
              fontSize: '13.79px',
              lineHeight: '18.38px',
              color: '#899CB2',
              flexShrink: 0,
              whiteSpace: 'nowrap'
            }}
          >
            {formatVolumeDisplay(market.totalVolume || market.volume)} Vol.
          </div>
        </div>
        
        {/* Middle Section: Progress Bar with Percentage */}
        <div style={{ marginBottom: '14px' }}>
          {/* Percentage and Label */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', marginBottom: '6px', gap: '6px' }}>
            <span 
              style={{
                fontFamily: '"Clash Grotesk", "Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontWeight: 500, // Medium
                fontSize: '18.38px',
                lineHeight: '27.58px',
                color: '#F2F2F2'
              }}
            >
              {yesPrice}%
            </span>
            <span 
              style={{
                fontFamily: '"Clash Grotesk", "Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontWeight: 500,
                fontSize: '13.83px',
                lineHeight: '27.58px',
                color: '#899CB2'
              }}
            >
              chance
            </span>
          </div>
          
          {/* Progress Bar */}
          <div 
            style={{
              width: '100%',
              height: '6px',
              background: 'rgba(55, 55, 55, 0.6)',
              borderRadius: '3px',
              overflow: 'hidden',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)'
            }}
          >
            <div 
              style={{
                width: progressWidth,
                height: '100%',
                background: 'linear-gradient(90deg, #F7D022 0%, #FFE566 100%)',
                borderRadius: '3px',
                transition: 'width 0.3s ease',
                boxShadow: '0 0 8px rgba(247, 208, 34, 0.4)'
              }}
            />
          </div>
        </div>
        
        {/* Bottom Section: Yes/No Buttons */}
        <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
          {/* Yes Button */}
          <button
            className="buy-button"
            onClick={(e) => handleBuy('yes', e)}
            style={{
              flex: 1,
              height: '48px',
              background: 'rgba(67, 199, 115, 0.15)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              borderRadius: '8px',
              border: '1px solid rgba(67, 199, 115, 0.2)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(67, 199, 115, 0.25)';
              e.currentTarget.style.borderColor = 'rgba(67, 199, 115, 0.4)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(67, 199, 115, 0.15)';
              e.currentTarget.style.borderColor = 'rgba(67, 199, 115, 0.2)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <span 
              style={{
                fontFamily: '"Clash Grotesk", "Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontWeight: 600, // Semibold
                fontSize: '16.09px',
                lineHeight: '22.98px',
                color: '#43C773',
                textShadow: '0 1px 2px rgba(0,0,0,0.2)'
              }}
            >
              Yes
            </span>
          </button>
          
          {/* No Button */}
          <button
            className="buy-button"
            onClick={(e) => handleBuy('no', e)}
            style={{
              flex: 1,
              height: '48px',
              background: 'rgba(225, 55, 55, 0.15)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              borderRadius: '8px',
              border: '1px solid rgba(225, 55, 55, 0.2)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(225, 55, 55, 0.25)';
              e.currentTarget.style.borderColor = 'rgba(225, 55, 55, 0.4)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(225, 55, 55, 0.15)';
              e.currentTarget.style.borderColor = 'rgba(225, 55, 55, 0.2)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <span 
              style={{
                fontFamily: '"Clash Grotesk", "Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontWeight: 600, // Semibold
                fontSize: '16.09px',
                lineHeight: '22.98px',
                color: '#E13737',
                textShadow: '0 1px 2px rgba(0,0,0,0.2)'
              }}
            >
              No
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModernMarketCard;
