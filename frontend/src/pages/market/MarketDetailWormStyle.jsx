import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import { useWeb3 } from '../../hooks/useWeb3';
import { getCurrencySymbol } from '../../utils/currency';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import WormStyleNavbar from '../../components/modern/WormStyleNavbar';
import PolymarketChart from '../../components/charts/PolymarketChart';
import Web3TradingInterface from '../../components/trading/Web3TradingInterface';
import { CONTRACT_ADDRESS, CONTRACT_ABI, RPC_URL } from '../../contracts/eth-config';

const API_BASE = import.meta.env.VITE_API_BASE_URL || window.location.origin;

// Generate image URL based on category and market ID
const getMarketImage = (market, marketIdParam) => {
  if (!market) return 'https://source.unsplash.com/800x400/?abstract,pattern,design';
  
  const marketId = market.id?.toString() || marketIdParam?.toString() || '0';
  
  try {
    const marketImages = JSON.parse(localStorage.getItem('marketImages') || '{}');
    if (marketImages[marketId]) {
      return marketImages[marketId];
    }
  } catch (err) {
    console.log('Error reading market images from localStorage');
  }
  
  if (market?.imageUrl) {
    return market.imageUrl;
  }
  
  const category = market?.category || 'General';
  const categoryKeywords = {
    'Politics': 'politics,government,election',
    'Sports': 'sports,athlete,competition',
    'Crypto': 'cryptocurrency,bitcoin,blockchain',
    'Tech': 'technology,innovation,digital',
    'WTF': 'abstract,surreal,unusual',
    'General': 'abstract,gradient,modern'
  };
  
  const keywords = categoryKeywords[category] || categoryKeywords['General'];
  const seed = parseInt(marketId) % 1000;
  
  return `https://source.unsplash.com/800x400/?${keywords}&sig=${seed}`;
};

const MarketDetailWormStyle = () => {
  const { id } = useParams();
  const history = useHistory();
  
  let web3Context;
  try {
    web3Context = useWeb3();
  } catch (error) {
    console.error('Web3 context error:', error);
    web3Context = {
      isConnected: false,
      account: null,
      contracts: {},
      buyShares: null,
      sellShares: null,
      getUserPosition: null,
      getMarketData: null,
      signer: null,
      ethBalance: '0',
      chainId: null,
      connectWallet: () => {}
    };
  }
  
  const {
    contracts,
    provider,
    chainId,
    account,
    isConnected,
    connectWallet,
    buyShares,
    sellShares,
    getUserPosition,
    getMarketData,
    signer,
    ethBalance
  } = web3Context;
  
  const [market, setMarket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('market');
  const [position, setPosition] = useState({ yesShares: '0', noShares: '0', totalInvested: '0' });
  const [marketData, setMarketData] = useState(null);
  const [priceHistory, setPriceHistory] = useState([]);
  const [yesPriceHistory, setYesPriceHistory] = useState([]);
  const [noPriceHistory, setNoPriceHistory] = useState([]);
  const [timeframe, setTimeframe] = useState('1h');
  const [trendingMarkets, setTrendingMarkets] = useState([]);

  // Fetch trending markets for sidebar
  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/markets?limit=3&sort=volume`);
        if (response.ok) {
          const data = await response.json();
          setTrendingMarkets((data.markets || []).filter(m => m.marketId?.toString() !== id?.toString()).slice(0, 2));
        }
      } catch (err) {
        console.log('Could not fetch trending markets');
      }
    };
    fetchTrending();
  }, [id]);

  // Helper function to record price after trades
  const recordPriceAfterTrade = useCallback(async () => {
    if (!contracts?.predictionMarket || !id) return;

    try {
      const yesPrice = await contracts.predictionMarket.getCurrentPrice(id, true);
      const noPrice = await contracts.predictionMarket.getCurrentPrice(id, false);
      
      const yesPriceBps = parseFloat(yesPrice.toString());
      const noPriceBps = parseFloat(noPrice.toString());

      await fetch(`${API_BASE}/api/record-price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketId: id.toString(),
          yesPriceBps: Math.round(yesPriceBps),
          noPriceBps: Math.round(noPriceBps),
          blockNumber: null
        })
      });
    } catch (err) {
      console.error('Failed to record price after trade:', err);
    }
  }, [contracts?.predictionMarket, id]);

  // Fetch market data and user position
  const fetchData = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      let contractToUse = contracts?.predictionMarket;
      
      if (!contractToUse) {
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
      
      const marketInfo = await contractToUse.getMarket(id);
      
      const totalYes = parseFloat(ethers.utils.formatEther(marketInfo.totalYesShares));
      const totalNo = parseFloat(ethers.utils.formatEther(marketInfo.totalNoShares));
      const total = totalYes + totalNo;
      
      const yesPrice = total > 0 ? Math.round((totalYes / total) * 100) : 50;
      const noPrice = 100 - yesPrice;

      const marketState = {
        id: id,
        question: marketInfo.question,
        category: marketInfo.category || 'General',
        yesPrice,
        noPrice,
        totalYesShares: totalYes,
        totalNoShares: totalNo,
        volume: totalYes + totalNo,
        creator: marketInfo.creator,
        resolved: marketInfo.resolved,
        active: marketInfo.active,
        createdAt: marketInfo.createdAt ? new Date(marketInfo.createdAt.toNumber() * 1000) : new Date(),
        endTime: marketInfo.endTime ? new Date(marketInfo.endTime.toNumber() * 1000).toISOString() : null,
        resolutionTime: marketInfo.resolutionTime ? new Date(marketInfo.resolutionTime.toNumber() * 1000).toISOString() : null,
      };

      setMarket(marketState);
      setMarketData(marketState);

      if (isConnected && getUserPosition) {
        try {
          const userPos = await getUserPosition(id);
          setPosition(userPos);
        } catch (err) {
          console.log('Could not fetch user position:', err.message);
        }
      }

      try {
        const response = await fetch(`${API_BASE}/api/price-history?marketId=${id}&timeframe=${timeframe}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setYesPriceHistory(data.data.yesPriceHistory || []);
            setNoPriceHistory(data.data.noPriceHistory || []);
            setPriceHistory(data.data.priceHistory || []);
          }
        }
      } catch (err) {
        console.log('Could not fetch price history:', err.message);
      }
    } catch (error) {
      console.error('Error fetching market:', error);
    } finally {
      setLoading(false);
    }
  }, [contracts, id, isConnected, getUserPosition, timeframe]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Event-driven price updates
  useEffect(() => {
    if (!contracts.predictionMarket || !id) return;

    const contract = contracts.predictionMarket;
    let normalizedMarketId;
    try {
      normalizedMarketId = ethers.BigNumber.from(id);
    } catch {
      return;
    }

    let lastYesPriceBps = null;
    let lastNoPriceBps = null;

    const updatePricesFromEvent = async (newPriceBps, isYes) => {
      const yesPriceBps = isYes ? newPriceBps : (10000 - newPriceBps);
      const noPriceBps = isYes ? (10000 - newPriceBps) : newPriceBps;
      const yesPriceCents = yesPriceBps / 100;
      const noPriceCents = noPriceBps / 100;

      setMarketData(prev => ({ ...prev, yesPrice: yesPriceCents, noPrice: noPriceCents }));
      setMarket(prev => prev ? { ...prev, yesPrice: Math.round(yesPriceCents), noPrice: Math.round(noPriceCents) } : prev);

      if (lastYesPriceBps !== yesPriceBps || lastNoPriceBps !== noPriceBps) {
        try {
          await fetch(`${API_BASE}/api/record-price`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              marketId: id.toString(),
              yesPriceBps: Math.round(yesPriceBps),
              noPriceBps: Math.round(noPriceBps),
              blockNumber: null
            })
          });
          lastYesPriceBps = yesPriceBps;
          lastNoPriceBps = noPriceBps;
          fetchData();
        } catch (err) {
          // Silent fail
        }
      }
    };

    const handleTradeEvent = (eventMarketId, _addr, isYes, _shares, _amount, newPrice) => {
      if (!eventMarketId.eq(normalizedMarketId)) return;
      updatePricesFromEvent(parseFloat(newPrice.toString()), isYes);
    };

    const fetchInitialPrices = async () => {
      try {
        const yesPrice = await contract.getCurrentPrice(id, true);
        const noPrice = await contract.getCurrentPrice(id, false);
        const yesPriceBps = parseFloat(yesPrice.toString());
        const noPriceBps = parseFloat(noPrice.toString());
        lastYesPriceBps = yesPriceBps;
        lastNoPriceBps = noPriceBps;
        setMarketData(prev => ({ ...prev, yesPrice: yesPriceBps / 100, noPrice: noPriceBps / 100 }));
        setMarket(prev => prev ? { ...prev, yesPrice: Math.round(yesPriceBps / 100), noPrice: Math.round(noPriceBps / 100) } : prev);
      } catch (err) {
        // Silent fail
      }
    };

    const purchaseFilter = contract.filters.SharesPurchased(id);
    const sellFilter = contract.filters.SharesSold(id);
    contract.on(purchaseFilter, handleTradeEvent);
    contract.on(sellFilter, handleTradeEvent);

    fetchInitialPrices();

    const fallbackInterval = setInterval(fetchInitialPrices, 300000);

    return () => {
      contract.off(purchaseFilter, handleTradeEvent);
      contract.off(sellFilter, handleTradeEvent);
      clearInterval(fallbackInterval);
    };
  }, [contracts.predictionMarket, id, fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0E0E0E] flex items-center justify-center" style={{ fontFamily: 'Clash Grotesk, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFE600]"></div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="min-h-screen bg-[#0E0E0E] flex items-center justify-center" style={{ fontFamily: 'Clash Grotesk, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <div className="text-center bg-[#171717] rounded-[24px] p-8 border border-white/10">
          <p className="text-white text-xl mb-4">Market not found</p>
          <button
            onClick={() => history.push('/')}
            className="px-6 py-2.5 bg-[#FFE600] hover:bg-[#FFE600]/90 text-black rounded-full font-bold transition-all"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }
  
  const isMarketEnded = market.endTime && new Date(market.endTime) <= new Date();

  return (
    <div className="min-h-screen bg-[#0E0E0E]" style={{ fontFamily: 'Clash Grotesk, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <WormStyleNavbar />
      
      <div className="max-w-[1488px] mx-auto px-4 lg:px-[111px] pt-24 pb-12">
        {/* Main Two-Column Layout */}
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* LEFT COLUMN - Market Info */}
          <div className="flex-1 space-y-6">
            
            {/* Market Hero Card with Image */}
            <div className="relative rounded-[24px] overflow-hidden border border-white/10" style={{ minHeight: '240px' }}>
              {/* Background Image - positioned on the right */}
              <div className="absolute right-0 top-0 bottom-0 w-[60%] lg:w-[45%]">
                <img
                  src={getMarketImage(market, id)}
                  alt={market.question}
                  className="w-full h-full object-cover"
                />
                {/* Left gradient overlay for text readability */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#0E0E0E] via-[#0E0E0E]/80 to-transparent"></div>
              </div>
              
              {/* Content */}
              <div className="relative z-10 p-6 lg:p-10">
                {/* Creator Badge */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex items-center gap-2 px-3 py-2 bg-[#2F2F2F]/80 backdrop-blur-md rounded-full">
                    <span className="text-white/50 text-sm font-light">Creator:</span>
                    <span className="text-white text-sm font-medium">@{market.creator?.slice(2, 8)}</span>
                  </div>
                  <button className="w-10 h-10 flex items-center justify-center bg-[#2F2F2F]/50 backdrop-blur-md rounded-full border border-white/10 hover:bg-[#2F2F2F]/70 transition-colors">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </button>
                </div>
                
                {/* Market Question */}
                <h1 className="text-3xl lg:text-[40px] font-medium text-white leading-tight max-w-[700px]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  {market.question}
                </h1>
              </div>
            </div>

            {/* Probability + Chart Toggle Row */}
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-1">
                <span className="text-[22px] font-medium text-white">{market.yesPrice}%</span>
                <span className="text-base text-white/50 font-light">chance</span>
              </div>
              <button className="p-1.5 hover:bg-white/10 rounded transition-colors">
                <svg className="w-5 h-5 text-[#D1D1D1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="rounded-[16px] border border-white/10 overflow-hidden">
              <div className="flex">
                {[
                  { key: 'market', label: 'Market' },
                  { key: 'rules', label: 'Rules' },
                  { key: 'holders', label: 'Top Holders' }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex-1 py-4 text-sm font-normal transition-all ${
                      activeTab === tab.key
                        ? 'text-white border-b border-[#FFE600]'
                        : 'text-[#A3A3A3] hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="rounded-[16px] border border-white/10 p-4">
              {activeTab === 'market' && (
                <div className="space-y-4">
                  {/* Comments Section */}
                  <div className="flex items-center gap-2 px-4 py-3 bg-transparent border border-[#FFE600] rounded-xl">
                    <input
                      type="text"
                      placeholder="Add a comment"
                      className="flex-1 bg-transparent text-white placeholder:text-white/50 focus:outline-none text-sm"
                    />
                    <button className="text-white/50 text-sm font-bold hover:text-white transition-colors">
                      Post
                    </button>
                  </div>
                  <div className="text-center py-4 text-white/50 text-sm">
                    Be the first to comment!
                  </div>
                </div>
              )}

              {activeTab === 'rules' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-white">Market Rules</h3>
                  <p className="text-white/70 text-sm">This market will resolve based on verifiable information.</p>
                  <div>
                    <h4 className="font-medium text-white mb-2 text-sm">Resolution Criteria:</h4>
                    <ul className="list-disc list-inside space-y-1 text-white/70 text-sm">
                      <li>The outcome must be verifiable through official sources</li>
                      <li>Resolution will occur after the event date has passed</li>
                      <li>In case of ambiguity, the market creator's interpretation will be final</li>
                    </ul>
                  </div>
                </div>
              )}

              {activeTab === 'holders' && (
                <div className="text-center py-8 text-white/50 text-sm">
                  No positions yet. Be the first to trade!
                </div>
              )}
            </div>

            {/* Chart Section */}
            <div className="mt-6">
              <PolymarketChart
                yesPriceHistory={yesPriceHistory}
                noPriceHistory={noPriceHistory}
                priceHistory={priceHistory}
                currentYesPrice={market?.yesPrice || 50}
                currentNoPrice={market?.noPrice || 50}
                height={250}
                selectedRange={timeframe}
                onRangeChange={setTimeframe}
                ranges={[
                  { label: '1H', value: '1h' },
                  { label: '6H', value: '6h' },
                  { label: '1D', value: '1d' },
                  { label: '1W', value: '1w' },
                  { label: '1M', value: '1m' },
                  { label: 'ALL', value: 'all' }
                ]}
              />
            </div>
          </div>
          
          {/* RIGHT COLUMN - Trading Interface */}
          <div className="w-full lg:w-[384px] flex-shrink-0 space-y-4">
            {/* Trading Card */}
            <div className="rounded-[16px] border border-white/10 p-4">
              {isMarketEnded ? (
                <div className="text-center py-12">
                  <div className="mb-4">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-500/30 mb-4">
                      <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Market Has Ended</h3>
                  <p className="text-white/50 text-sm mb-6">
                    Trading is no longer available. Awaiting resolution.
                  </p>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white/50 text-sm">Final Prices</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-[#FFE600]"></div>
                        <span className="text-white font-medium">Yes</span>
                      </div>
                      <span className="text-white font-bold text-lg">{market.yesPrice}%</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-[#E13737]"></div>
                        <span className="text-white font-medium">No</span>
                      </div>
                      <span className="text-white font-bold text-lg">{market.noPrice}%</span>
                    </div>
                  </div>
                </div>
              ) : (
                <Web3TradingInterface
                  marketId={id}
                  market={market}
                  onTradeComplete={fetchData}
                />
              )}
            </div>

            {/* Trending Markets Section */}
            <div className="space-y-3">
              <h3 className="text-white font-normal text-base">Trending Markets</h3>
              <div className="flex items-center gap-3">
                {/* Trending market cards */}
                {trendingMarkets.length > 0 ? (
                  trendingMarkets.map((tm, index) => (
                    <button
                      key={tm.marketId}
                      onClick={() => history.push(`/market/${tm.marketId}`)}
                      className="relative w-[120px] h-[120px] rounded-[24px] overflow-hidden border border-white/10 hover:border-white/30 transition-all group"
                    >
                      <img
                        src={tm.imageUrl || getMarketImage(tm, tm.marketId)}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#171717] to-transparent"></div>
                      <div className="absolute bottom-2 left-3 text-left">
                        <div className="flex items-baseline">
                          <span className="text-[23px] font-medium text-white">{Math.round(tm.yesPrice || 50)}</span>
                          <span className="text-lg text-white">%</span>
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <>
                    <div className="w-[120px] h-[120px] rounded-[24px] bg-white/5 border border-white/10 animate-pulse"></div>
                    <div className="w-[120px] h-[120px] rounded-[24px] bg-white/5 border border-white/10 animate-pulse"></div>
                  </>
                )}
                
                {/* See More button */}
                <button
                  onClick={() => history.push('/')}
                  className="w-[120px] h-[120px] rounded-[24px] border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors"
                >
                  <span className="text-white text-base">See More</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-20 bg-[#171717]">
        <div className="max-w-[1536px] mx-auto px-4 py-3">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex gap-6 text-sm">
              <button className="text-[#747474] hover:text-white transition-colors">
                Terms of Service
              </button>
              <button className="text-[#747474] hover:text-white transition-colors">
                Privacy Policy
              </button>
            </div>
            
            <button className="text-[#FFE600] hover:text-[#FFE600]/80 transition-colors text-xl">
              How it Works?
            </button>
            
            <div className="flex gap-1">
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <a href="https://discord.com" target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              </a>
              <a href="https://telegram.org" target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
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

export default MarketDetailWormStyle;
