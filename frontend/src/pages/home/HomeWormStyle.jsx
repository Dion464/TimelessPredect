import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useWeb3 } from '../../hooks/useWeb3';
import { getCurrencySymbol } from '../../utils/currency';
import { ethers } from 'ethers';
import WormStyleNavbar from '../../components/modern/WormStyleNavbar';
import { CONTRACT_ADDRESS, CONTRACT_ABI, RPC_URL } from '../../contracts/eth-config';

const HomeWormStyle = () => {
  const history = useHistory();
  const { contracts, provider, chainId } = useWeb3();
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [trendingMarkets, setTrendingMarkets] = useState([]);
  
  const currencySymbol = getCurrencySymbol(chainId);

  const categories = ['All', 'Politics', 'Sports', 'Crypto', 'Tech', 'WTF'];

  useEffect(() => {
    fetchMarkets();
  }, [contracts]);

  const fetchMarkets = async () => {
    try {
      setLoading(true);
      
      // Create a direct provider if wallet is not connected
      let contractToUse = contracts?.predictionMarket;
      
      if (!contractToUse) {
        // Use direct RPC connection without wallet
        if (!RPC_URL) {
          throw new Error('RPC_URL not configured. Please set VITE_RPC_URL environment variable.');
        }
        const directProvider = new ethers.providers.JsonRpcProvider(RPC_URL);
        contractToUse = new ethers.Contract(
          CONTRACT_ADDRESS,
          CONTRACT_ABI,
          directProvider
        );
      }

      const activeMarkets = await contractToUse.getActiveMarkets();
      
      const marketsData = await Promise.all(
        activeMarkets.map(async (marketId) => {
          try {
            const market = await contractToUse.getMarket(marketId);
            
            // Get current prices from AMM (same as chart)
            let yesPrice = 50; // Default 50%
            let noPrice = 50;
            
            try {
              // Prices come as basis points from contract (5000 = 50%)
              const yesPriceBps = await contractToUse.getCurrentPrice(marketId, true);
              const noPriceBps = await contractToUse.getCurrentPrice(marketId, false);
              yesPrice = parseFloat(yesPriceBps.toString()) / 100; // Convert to percentage
              noPrice = parseFloat(noPriceBps.toString()) / 100;
            } catch (priceErr) {
              console.log(`Could not get AMM prices for market ${marketId}, using defaults`);
            }
            
            // Calculate volume from shares
            const totalYes = parseFloat(ethers.utils.formatEther(market.totalYesShares));
            const totalNo = parseFloat(ethers.utils.formatEther(market.totalNoShares));
            const volume = totalYes + totalNo;

            return {
              id: marketId.toString(),
              question: market.question,
              category: market.category || 'General',
              yesPrice: Math.round(yesPrice), // Round to whole number for display
              noPrice: Math.round(noPrice),
              totalYesShares: totalYes,
              totalNoShares: totalNo,
              volume,
              creator: market.creator,
              resolved: market.resolved,
              active: market.active,
              createdAt: market.createdAt ? new Date(market.createdAt.toNumber() * 1000) : new Date(),
            };
          } catch (err) {
            console.error(`Error fetching market ${marketId}:`, err);
            return null;
          }
        })
      );

      const activeMarketsData = marketsData.filter(m => m && m.active && !m.resolved);
      setMarkets(activeMarketsData);
      
      // Set top 4 as trending
      const sorted = [...activeMarketsData].sort((a, b) => b.volume - a.volume);
      setTrendingMarkets(sorted.slice(0, 4));
      
    } catch (error) {
      console.error('Error fetching markets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      history.push(`/markets?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  const filteredMarkets = markets.filter(market => {
    const matchesCategory = selectedCategory === 'All' || market.category === selectedCategory;
    const matchesSearch = market.question.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

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
    
    // Otherwise, generate a dynamic image based on category with unique seed
    const category = market.category || 'General';
    
    // Use Unsplash API for category-based images with higher quality
    const categoryKeywords = {
      'Politics': 'politics,government,election',
      'Sports': 'sports,athlete,competition',
      'Crypto': 'cryptocurrency,bitcoin,blockchain',
      'Tech': 'technology,innovation,digital',
      'WTF': 'abstract,surreal,unusual',
      'General': 'abstract,gradient,modern'
    };
    
    const keywords = categoryKeywords[category] || categoryKeywords['General'];
    // Use a deterministic seed based on market ID for consistent but varied images
    const seed = parseInt(marketId) % 1000;
    
    return `https://source.unsplash.com/600x400/?${keywords}&sig=${seed}`;
  };

  return (
    <div className="min-h-screen bg-[#0E0E0E]" style={{ fontFamily: 'gilroy, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Navbar */}
      <WormStyleNavbar />
      
      {/* Hero Section */}
      <div 
        className="relative  w-full  overflow-visible"
        style={{
          backgroundImage: 'url(/hero-background.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          minHeight: '500px',
          paddingBottom: '200px'
        }}
      >
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/70"></div>
        
        {/* Content */}
        <div className="relative max-w-6xl mx-auto px-4 pt-32 pb-20 mt-10">
          <div className="text-center">
            <h1 className="text-[33px] md:text-[33px] font-medium text-white leading-tight mb-8 font-space-grotesk">
              Discover the latest Prediction Markets<br />
              or Create your Own & Earn!
            </h1>
            
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. When will Taylor Swift release a new album"
                  className="w-full px-6 py-5 bg-white/10 backdrop-blur-md text-white rounded-[12px] border border-white/20 focus:border-white/40 focus:outline-none placeholder:text-gray-300 transition-all text-lg"
                />
                <button
                  type="submit"
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white p-3 rounded-full transition-colors backdrop-blur-md"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Main Content Section - Moved up with negative margin */}
      <div className="max-w-6xl mx-auto px-4 -mt-40 relative z-10">

        {/* Trending Section */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
          </div>
          
          {trendingMarkets.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {trendingMarkets.map((market) => (
                <div
                  key={market.id}
                  onClick={() => history.push(`/markets/${market.id}`)}
                  className="rounded-[24px] overflow-hidden cursor-pointer transition-all duration-300 ease-out group aspect-square relative border border-transparent shadow-[0_0_0_0_rgba(0,0,0,0)] hover:shadow-[0_0_45px_0_rgba(248,247,106,0.45)] hover:border-[#ffffff00] hover:scale-[1.02] hover:opacity-95"
                  style={{
                    backgroundImage: `url(${getMarketImage(market)})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                >
                  {/* Gradient overlay - matching Figma */}
                  <div 
                    className="absolute inset-0"
                    style={{
                      background: 'linear-gradient(135deg, rgba(23, 23, 23, 1) 0%, rgba(23, 23, 23, 0) 100%)'
                    }}
                  />
                  
                  <div className="relative h-full flex flex-col">
                    {/* Top badges - matching Figma specs */}
                    <div 
                      className="absolute flex items-center justify-between"
                      style={{
                        top: '24px',
                        left: '24px',
                        right: '24px',
                        height: '44px',
                        border: '2px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '9999px',
                        backdropFilter: 'blur(16px)',
                        padding: '10px'
                      }}
                    >
                      <span className="text-white font-space-grotesk font-medium" style={{ fontSize: '14.4px', lineHeight: '1.667em' }}>
                        @{market.creator.slice(2, 8)}
                      </span>
                      {market.volume > 1 && (
                        <span className="text-white font-space-grotesk font-normal text-right" style={{ fontSize: '14.1px', lineHeight: '1.418em' }}>
                          {market.volume.toFixed(2)} Vol.
                        </span>
                      )}
                    </div>
                    
                    {/* Bottom content - matching Figma specs */}
                    <div className="absolute" style={{ bottom: '24px', left: '24px', right: '24px' }}>
                      {/* Percentage */}
                      <div className="flex items-baseline mb-2">
                        <span className="font-space-grotesk font-medium text-[#FAF8FE]" style={{ fontSize: '67.5px', lineHeight: '1.067em' }}>
                          {market.yesPrice}
                        </span>
                        <span className="font-space-grotesk font-medium text-[#FAF8FE]" style={{ fontSize: '36px', lineHeight: '1em' }}>
                          %
                        </span>
                      </div>
                      
                      {/* Question text */}
                      <p className="text-[#FAF8FE] font-space-grotesk font-normal line-clamp-2" style={{ fontSize: '18.9px', lineHeight: '1.323em' }}>
                        {market.question}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category Filter */}
        <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-5 py-2.5 rounded-full font-medium font-space-grotesk whitespace-nowrap transition-all text-[15px] ${
                  selectedCategory === category
                    ? 'bg-[#222222] text-white'
                    : 'bg-[#010101] text-white hover:bg-[#333333] border border-white/10'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
          
          <button className="flex items-center gap-2 px-5 py-2.5 bg-[#222222] text-white rounded-full hover:bg-[#333333] transition-all whitespace-nowrap border border-white/10">
            <span className="text-[14px] font-medium font-space-grotesk">Sort by: Newest</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Markets Grid */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        ) : filteredMarkets.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">No markets found</p>
            <p className="text-gray-500 text-sm mt-2">Try creating one or check back later!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredMarkets.map((market) => (
              <div
                key={market.id}
                onClick={() => history.push(`/markets/${market.id}`)}
                className="rounded-[24px] overflow-hidden cursor-pointer transition-all duration-300 ease-out aspect-square relative border border-transparent shadow-[0_0_0_0_rgba(0,0,0,0)] hover:shadow-[0_0_45px_0_rgba(248,247,106,0.45)] hover:border-[#f5ff80] hover:scale-[1.02] hover:opacity-95"
                style={{
                  backgroundImage: `url(${getMarketImage(market)})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              >
                {/* Gradient overlay - matching Figma */}
                <div 
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(135deg, rgba(23, 23, 23, 1) 0%, rgba(23, 23, 23, 0) 100%)'
                  }}
                />
                
                <div className="relative h-full flex flex-col">
                  {/* Top badges - matching Figma specs */}
                  <div 
                    className="absolute flex items-center justify-between"
                    style={{
                      top: '24px',
                      left: '24px',
                      right: '24px',
                      height: '44px',
                      border: '2px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '9999px',
                      backdropFilter: 'blur(16px)',
                      padding: '10px'
                    }}
                  >
                    <span className="text-white font-space-grotesk font-medium" style={{ fontSize: '14.4px', lineHeight: '1.667em' }}>
                      @{market.creator.slice(2, 8)}
                    </span>
                    {market.volume > 1 && (
                      <span className="text-white font-space-grotesk font-normal text-right" style={{ fontSize: '14.1px', lineHeight: '1.418em' }}>
                        {market.volume.toFixed(2)} Vol.
                      </span>
                    )}
                  </div>
                  
                  {/* Bottom content - matching Figma specs */}
                  <div className="absolute" style={{ bottom: '24px', left: '24px', right: '24px' }}>
                    {/* Percentage */}
                    <div className="flex items-baseline mb-2">
                      <span className="font-space-grotesk font-medium text-[#FAF8FE]" style={{ fontSize: '67.5px', lineHeight: '1.067em' }}>
                        {market.yesPrice}
                      </span>
                      <span className="font-space-grotesk font-medium text-[#FAF8FE]" style={{ fontSize: '36px', lineHeight: '1em' }}>
                        %
                      </span>
                    </div>
                    
                    {/* Question text */}
                    <p className="text-[#FAF8FE] font-space-grotesk font-normal line-clamp-2" style={{ fontSize: '18.9px', lineHeight: '1.323em' }}>
                      {market.question}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-20">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex gap-6 text-sm">
              <button className="text-gray-400 hover:text-white transition-colors font-medium">
                Terms of Service
              </button>
              <button className="text-gray-400 hover:text-white transition-colors font-medium">
                Privacy Policy
              </button>
            </div>
            
            <button className="text-gray-400 hover:text-white transition-colors text-sm font-medium">
              How it Works?
            </button>
            
            <div className="flex gap-4">
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <a href="https://discord.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              </a>
              <a href="https://telegram.org" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12a12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472c-.18 1.898-.962 6.502-1.36 8.627c-.168.9-.499 1.201-.82 1.23c-.696.065-1.225-.46-1.9-.902c-1.056-.693-1.653-1.124-2.678-1.8c-1.185-.78-.417-1.21.258-1.91c.177-.184 3.247-2.977 3.307-3.23c.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345c-.48.33-.913.49-1.302.48c-.428-.008-1.252-.241-1.865-.44c-.752-.245-1.349-.374-1.297-.789c.027-.216.325-.437.893-.663c3.498-1.524 5.83-2.529 6.998-3.014c3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomeWormStyle;

