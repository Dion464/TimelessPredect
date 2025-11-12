import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import PolymarketChart from '../../components/charts/PolymarketChart';
import Web3TradingInterface from '../../components/trading/Web3TradingInterface';
import WormStyleNavbar from '../../components/modern/WormStyleNavbar';
import { useWeb3 } from '../../hooks/useWeb3';
import { getCurrencySymbol } from '../../utils/currency';
import { ethers } from 'ethers';

// Generate image URL based on category and market ID (Polymarket-style)
const getMarketImage = (market, marketIdParam) => {
  if (!market) return 'https://source.unsplash.com/200x200/?abstract,pattern,design';
  
  // Get market ID - handle both string and number formats
  const marketId = market.id?.toString() || 
                   market.marketId?.toString() || 
                   marketIdParam?.toString() || 
                   String(market.id) ||
                   '0';
  
  // First, check if there's a stored image URL in localStorage
  try {
    const marketImages = JSON.parse(localStorage.getItem('marketImages') || '{}');
    
    // Try exact match first
    if (marketImages[marketId]) {
      return marketImages[marketId];
    }
    
    // Try number format
    const numId = parseInt(marketId);
    if (!isNaN(numId) && marketImages[numId.toString()]) {
      return marketImages[numId.toString()];
    }
    
    // Try all keys to find a match
    for (const key in marketImages) {
      if (parseInt(key) === numId || key === marketId) {
        return marketImages[key];
      }
    }
  } catch (err) {
    console.log('Error reading market images from localStorage:', err);
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
  
  return `https://source.unsplash.com/200x200/?${keywords}&sig=${seed}`;
};

const PolymarketStyleTrading = () => {
  const { marketId } = useParams();
  const history = useHistory();
  
  // Add error handling for Web3 context
  let web3Context;
  try {
    web3Context = useWeb3();
  } catch (error) {
    console.error('Web3 context error:', error);
    web3Context = { isConnected: false, contracts: {} };
  }
  
  const { isConnected, contracts, getMarketData, chainId } = web3Context;
  const currencySymbol = getCurrencySymbol(chainId);
  // Use current origin for API calls if VITE_API_BASE_URL is not set
  const API_BASE = import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  const [market, setMarket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('trade');
  const [selectedSide, setSelectedSide] = useState('yes');
  const [amount, setAmount] = useState('');
  const [priceHistory, setPriceHistory] = useState([]);
  const [yesPriceHistory, setYesPriceHistory] = useState([]);
  const [noPriceHistory, setNoPriceHistory] = useState([]);
  const [recentTrades, setRecentTrades] = useState([]);
  const [orderBook, setOrderBook] = useState({ yes: [], no: [] });
  const [uniqueTraders, setUniqueTraders] = useState(0);
  const [liquidity, setLiquidity] = useState(0);
  const [timeframe, setTimeframe] = useState('1d');
  const refreshTriggerRef = useRef(0); // Force refresh counter

  // These functions need to be defined before refreshAllData
  const fetchRecentTrades = useCallback(async () => {
    if (!contracts?.predictionMarket) {
      console.warn('Prediction market contract not available, skipping recent trades fetch');
      return;
    }

    try {
      const trades = await contracts.predictionMarket.getRecentTrades(marketId, 100);

      if (!trades || trades.length === 0) {
        setRecentTrades([]);
        setUniqueTraders(0);
        return;
      }

      const formattedTrades = trades.map(trade => {
        const priceBps = Number(trade.price?.toString?.() ?? trade.price ?? 0);
        const timestampSeconds = Number(trade.timestamp?.toString?.() ?? trade.timestamp ?? 0);
        const sharesWei = trade.shares?.toString?.() ?? trade.shares ?? '0';
        let sharesFormatted = '0';

        try {
          sharesFormatted = ethers.utils.formatEther(sharesWei);
        } catch (err) {
          sharesFormatted = sharesWei.toString();
        }

        const timestamp = new Date(timestampSeconds * 1000);

        return {
          side: trade.isYes ? 'yes' : 'no',
          amount: parseFloat(sharesFormatted).toFixed(4),
          price: priceBps / 10000,
          yesPrice: trade.isYes ? priceBps / 10000 : (10000 - priceBps) / 10000,
          noPrice: trade.isYes ? (10000 - priceBps) / 10000 : priceBps / 10000,
          timestamp: timestamp.toISOString(),
          trader: trade.trader
        };
      });

      // Sort newest first
      formattedTrades.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      setRecentTrades(formattedTrades);

      const uniqueAddresses = new Set(formattedTrades.map(trade => (trade.trader || '').toLowerCase()));
      setUniqueTraders(uniqueAddresses.size);

      console.log('✅ Loaded trades from blockchain:', formattedTrades.length);
    } catch (error) {
      console.error('Error fetching recent trades from blockchain:', error);
      setRecentTrades([]);
      setUniqueTraders(0);
    }
  }, [contracts?.predictionMarket, marketId]);

  const fetchOrderBook = useCallback(async () => {
    if (!contracts?.predictionMarket || !contracts?.pricingAMM) return;
    
    try {
      // Get current prices from PricingAMM
      const [yesPrice, noPrice] = await contracts.pricingAMM.calculatePrice(marketId);
      const currentYesPrice = yesPrice.toNumber(); // Basis points (5000 = 50%)
      const currentNoPrice = noPrice.toNumber();
      
      // Get market state from PricingAMM
      const marketState = await contracts.pricingAMM.getMarketState(marketId);
      const yesShares = parseFloat(ethers.utils.formatEther(marketState.yesShares));
      const noShares = parseFloat(ethers.utils.formatEther(marketState.noShares));
      
      // Create order book based on actual market state
      const yesOrders = [];
      const noOrders = [];
      
      // Calculate order amounts based on actual shares
      for (let i = 0; i < 5; i++) {
        // YES orders: prices slightly below current (bids)
        const priceOffset = i * 10; // 10 basis points = 0.1%
        const yesPriceBasis = Math.max(100, currentYesPrice - priceOffset); // Min 1%
        const yesPriceCents = Math.round(yesPriceBasis / 100); // Convert to cents
        
        // Amount based on YES shares available
        const yesAmount = (yesShares * (currentYesPrice - priceOffset) / currentYesPrice) || 0;
        
        yesOrders.push({ 
          price: yesPriceCents,
          amount: yesAmount.toFixed(2)
        });
        
        // NO orders: prices slightly below current (bids)
        const noPriceBasis = Math.max(100, currentNoPrice - priceOffset);
        const noPriceCents = Math.round(noPriceBasis / 100);
        
        // Amount based on NO shares available
        const noAmount = (noShares * (currentNoPrice - priceOffset) / currentNoPrice) || 0;
        
        noOrders.push({ 
          price: noPriceCents,
          amount: noAmount.toFixed(2)
        });
      }
      
      setOrderBook({ yes: yesOrders, no: noOrders });
      console.log('✅ Loaded real order book from market state');
    } catch (error) {
      console.error('Error fetching order book:', error);
      setOrderBook({ yes: [], no: [] });
    }
  }, [contracts?.predictionMarket, contracts?.pricingAMM, marketId]);

  const fetchLiquidity = useCallback(async () => {
    if (!contracts?.predictionMarket || !contracts?.pricingAMM) return;
    
    try {
      // Get market state for liquidity info
      const marketState = await contracts.pricingAMM.getMarketState(marketId);
      const liquidity = parseFloat(ethers.utils.formatEther(marketState.liquidity || '0'));
      
      // Also get contract balance as additional liquidity measure
      const provider = contracts.predictionMarket.provider;
      const contractAddress = contracts.predictionMarket.address;
      const contractBalance = await provider.getBalance(contractAddress);
      const balanceEth = parseFloat(ethers.utils.formatEther(contractBalance));
      
      // Use the higher of the two, or AMM liquidity if available
      const totalLiquidity = liquidity > 0 ? liquidity : balanceEth;
      
      setLiquidity(totalLiquidity);
      console.log('✅ Fetched liquidity:', totalLiquidity.toFixed(4), currencySymbol);
    } catch (error) {
      console.error('Error fetching liquidity:', error);
      setLiquidity(0);
    }
  }, [contracts?.predictionMarket, contracts?.pricingAMM, marketId]);

  // Function to record price snapshot to database
  const recordPriceSnapshot = useCallback(async (yesPriceBps, noPriceBps) => {
    try {
      if (!marketId || !API_BASE) {
        console.warn('Cannot record price snapshot: missing marketId or API_BASE');
        return;
      }

      // Validate prices before recording
      // Ensure prices are reasonable (between 10 bps = 0.1% and 9990 bps = 99.9%)
      if (yesPriceBps < 10 || yesPriceBps > 9990 || noPriceBps < 10 || noPriceBps > 9990) {
        console.warn('⚠️  Invalid prices detected, skipping price snapshot:', {
          marketId: marketId.toString(),
          yesPriceBps,
          noPriceBps,
          yesPricePercent: (yesPriceBps / 100).toFixed(2),
          noPricePercent: (noPriceBps / 100).toFixed(2)
        });
        return;
      }

      // Ensure YES + NO = 10000 (within rounding tolerance)
      const total = yesPriceBps + noPriceBps;
      if (Math.abs(total - 10000) > 100) { // Allow 1% tolerance
        console.warn('⚠️  Price sum mismatch, normalizing before recording:', {
          yesPriceBps,
          noPriceBps,
          total
        });
        // Normalize to ensure they sum to 10000
        const scale = 10000 / total;
        yesPriceBps = Math.round(yesPriceBps * scale);
        noPriceBps = 10000 - yesPriceBps;
      }

      console.log('📊 Recording price snapshot to DB:', {
        marketId: marketId.toString(),
        yesPriceBps: yesPriceBps,
        noPriceBps: noPriceBps,
        yesPriceCents: (yesPriceBps / 100).toFixed(2),
        noPriceCents: (noPriceBps / 100).toFixed(2),
        sum: yesPriceBps + noPriceBps
      });

      const response = await fetch(`${API_BASE}/api/record-price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketId: marketId.toString(),
          yesPriceBps: yesPriceBps,
          noPriceBps: noPriceBps
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to record price snapshot:', errorText);
      } else {
        const result = await response.json();
        console.log('✅ Price snapshot recorded successfully:', result);
      }
    } catch (error) {
      console.error('❌ Error recording price snapshot:', error);
      // Don't throw - this is non-critical
    }
  }, [API_BASE, marketId]);

  const fetchPriceHistoryFromDb = useCallback(async (range = timeframe) => {
    try {
      if (!marketId) {
        return;
      }

      const response = await fetch(`${API_BASE}/api/price-history?marketId=${marketId}&timeframe=${range}`);
      if (!response.ok) {
        throw new Error('Failed to fetch price history');
      }

      const raw = await response.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch (err) {
        throw new Error('Price history endpoint did not return JSON. Ensure the API backend is running.');
      }
      const intervals = Array.isArray(data.intervals) ? data.intervals : [];

      if (intervals.length === 0) {
        setYesPriceHistory([]);
        setNoPriceHistory([]);
        setPriceHistory([]);
        return;
      }

      // Use all actual timestamps from database - don't fill gaps, show real price history
      const sorted = intervals
        .map(entry => ({
          yesPrice: entry.yesPrice, // Already in decimal (0-1) from API
          noPrice: entry.noPrice,   // Already in decimal (0-1) from API
          timestamp: new Date(entry.intervalStart).getTime()
        }))
        .sort((a, b) => a.timestamp - b.timestamp);

      // Convert to chart format - prices are already in decimal (0-1) from database
      // Chart expects prices in decimal format (0-1), not cents
      const yesHistory = sorted.map(point => ({
        price: point.yesPrice, // Already decimal, e.g., 0.50 = 50%
        timestamp: new Date(point.timestamp).toISOString()
      }));

      const noHistory = sorted.map(point => ({
        price: point.noPrice, // Already decimal, e.g., 0.50 = 50%
        timestamp: new Date(point.timestamp).toISOString()
      }));

      console.log('📊 Loaded price history from database:', {
        intervals: intervals.length,
        yesHistory: yesHistory.length,
        noHistory: noHistory.length,
        yesPrices: yesHistory.map(p => (p.price * 100).toFixed(2) + '%').slice(0, 5),
        noPrices: noHistory.map(p => (p.price * 100).toFixed(2) + '%').slice(0, 5)
      });

      setYesPriceHistory(yesHistory);
      setNoPriceHistory(noHistory);
      setPriceHistory(yesHistory);

      // Don't update market prices from DB - prices come from chain
    } catch (error) {
      console.error('Error fetching price history from database:', error);
      setYesPriceHistory([]);
      setNoPriceHistory([]);
      setPriceHistory([]);
    }
  }, [API_BASE, marketId, timeframe]);

  const fetchMarketData = useCallback(async () => {
    try {
      setLoading(true);

      if (!isConnected || !contracts?.predictionMarket) {
        console.warn('Wallet not connected or contracts unavailable. Connect wallet to view market data.');
        setMarket(null);
        setOrderBook({ yes: [], no: [] });
        setLiquidity(0);
        setRecentTrades([]);
        setUniqueTraders(0);
        return;
      }

      const marketData = await getMarketData(marketId);

      const processedMarket = {
        id: Number(marketData.id),
        questionTitle: marketData.question,
        description: marketData.description,
        category: marketData.category || 'General',
        resolutionDateTime: new Date(Number(marketData.resolutionTime) * 1000).toISOString(),
        createdAt: new Date(Number(marketData.createdAt) * 1000).toISOString(),
        endTime: Number(marketData.endTime),
        creatorUsername: marketData.creator,
        isResolved: marketData.resolved,
        totalVolume: parseFloat(ethers.utils.formatEther(marketData.totalVolume)),
        yesPrice: marketData.yesPrice ?? 50,
        noPrice: marketData.noPrice ?? 50,
        currentProbability: (marketData.yesPrice ?? 50) / 100
      };

      setMarket(processedMarket);

      // Fetch all data in parallel for better performance
      await Promise.all([
        fetchPriceHistoryFromDb(),
        fetchRecentTrades(),
        fetchOrderBook(),
        fetchLiquidity()
      ]);
    } catch (error) {
      console.error('Error fetching market data:', error);
      setMarket(null);
    } finally {
      setLoading(false);
    }
  }, [contracts?.predictionMarket, fetchLiquidity, fetchOrderBook, fetchPriceHistoryFromDb, fetchRecentTrades, getMarketData, isConnected, marketId]);

  const handleTimeframeChange = useCallback(async (range) => {
    setTimeframe(range);
    await fetchPriceHistoryFromDb(range);
  }, [fetchPriceHistoryFromDb]);

  // Refresh function that can be called after trades
  const refreshAllData = useCallback(async () => {
    refreshTriggerRef.current += 1;
    await fetchMarketData();
  }, [fetchMarketData]);

  useEffect(() => {
    fetchMarketData();
    
    // Auto-refresh market data every 60 seconds only if connected (reduced from 10 seconds)
    const refreshInterval = setInterval(() => {
      if (isConnected && contracts?.predictionMarket && marketId) {
        fetchMarketData();
      }
    }, 60000); // 60 seconds
    
    return () => clearInterval(refreshInterval);
  }, [fetchMarketData, isConnected, contracts?.predictionMarket, marketId]);

  // Set up event listeners for real-time updates
  useEffect(() => {
    if (!contracts?.predictionMarket || !marketId || !isConnected) return;

    const contract = contracts.predictionMarket;
    const filterPurchased = contract.filters.SharesPurchased(marketId, null);
    const filterSold = contract.filters.SharesSold(marketId, null);

    const handlePurchased = async (...args) => {
      console.log('🟢 SharesPurchased event detected:', args);
      // Wait for blockchain state to update, then refresh data and record price
      setTimeout(async () => {
        // Force price recording after trade FIRST, then refresh chart
        if (contracts?.predictionMarket && marketId) {
          try {
            const yesPrice = await contracts.predictionMarket.getCurrentPrice(marketId, true);
            const noPrice = await contracts.predictionMarket.getCurrentPrice(marketId, false);
            const yesPriceBps = parseFloat(yesPrice.toString());
            const noPriceBps = parseFloat(noPrice.toString());
            console.log('🔄 Recording price after buy trade:', { yesPriceBps, noPriceBps });
            await recordPriceSnapshot(yesPriceBps, noPriceBps);
            // Wait a bit for DB to commit, then refresh chart
            setTimeout(() => {
              refreshAllData();
            }, 500);
          } catch (err) {
            console.error('Failed to record price after trade:', err);
            // Still refresh even if price recording failed
            await refreshAllData();
          }
        } else {
          await refreshAllData();
        }
      }, 2000);
    };

    const handleSold = async (...args) => {
      console.log('🔴 SharesSold event detected:', args);
      // Wait for blockchain state to update, then refresh data and record price
      setTimeout(async () => {
        // Force price recording after trade FIRST, then refresh chart
        if (contracts?.predictionMarket && marketId) {
          try {
            const yesPrice = await contracts.predictionMarket.getCurrentPrice(marketId, true);
            const noPrice = await contracts.predictionMarket.getCurrentPrice(marketId, false);
            const yesPriceBps = parseFloat(yesPrice.toString());
            const noPriceBps = parseFloat(noPrice.toString());
            console.log('🔄 Recording price after sell trade:', { yesPriceBps, noPriceBps });
            await recordPriceSnapshot(yesPriceBps, noPriceBps);
            // Wait a bit for DB to commit, then refresh chart
            setTimeout(() => {
              refreshAllData();
            }, 500);
          } catch (err) {
            console.error('Failed to record price after trade:', err);
            // Still refresh even if price recording failed
            await refreshAllData();
          }
        } else {
          await refreshAllData();
        }
      }, 2000);
    };

    contract.on(filterPurchased, handlePurchased);
    contract.on(filterSold, handleSold);

    return () => {
      contract.off(filterPurchased, handlePurchased);
      contract.off(filterSold, handleSold);
    };
  }, [contracts?.predictionMarket, marketId, isConnected, refreshAllData, recordPriceSnapshot]);

  // Real-time price updates from chain - records to DB and updates UI
  useEffect(() => {
    if (!isConnected || !contracts?.predictionMarket || !marketId) return;

    let lastYesPriceBps = null;
    let lastNoPriceBps = null;

    const updatePrices = async () => {
      try {
        // Fetch current prices from chain
        const yesPrice = await contracts.predictionMarket.getCurrentPrice(marketId, true);
        const noPrice = await contracts.predictionMarket.getCurrentPrice(marketId, false);
        
        // Convert to basis points (prices come as basis points from contract)
        const yesPriceBps = parseFloat(yesPrice.toString());
        const noPriceBps = parseFloat(noPrice.toString());
        
        // Convert to cents for display (5000 -> 50¢)
        const yesPriceCents = yesPriceBps / 100;
        const noPriceCents = noPriceBps / 100;

        // Update market state with prices from chain
        setMarket(prev => prev ? {
          ...prev,
          yesPrice: yesPriceCents,
          noPrice: noPriceCents,
          currentProbability: yesPriceBps / 10000
        } : prev);

        // Record price snapshot to DB if price changed
        if (lastYesPriceBps !== yesPriceBps || lastNoPriceBps !== noPriceBps) {
          console.log('💰 Price changed! Recording to DB:', {
            previous: { yes: lastYesPriceBps, no: lastNoPriceBps },
            current: { yes: yesPriceBps, no: noPriceBps }
          });
          await recordPriceSnapshot(yesPriceBps, noPriceBps);
          lastYesPriceBps = yesPriceBps;
          lastNoPriceBps = noPriceBps;
        } else {
          console.log('💰 Price unchanged, skipping DB record:', {
            yes: yesPriceBps,
            no: noPriceBps
          });
        }
      } catch (err) {
        console.log('Failed to update prices from chain:', err.message);
      }
    };

    // Update prices every 30 seconds and only record if price changed
    const interval = setInterval(async () => {
      try {
        // Only update if price actually changed
        const currentYesPrice = await contracts.predictionMarket.getCurrentPrice(marketId, true);
        const currentNoPrice = await contracts.predictionMarket.getCurrentPrice(marketId, false);
        const yesPriceBps = parseFloat(currentYesPrice.toString());
        const noPriceBps = parseFloat(currentNoPrice.toString());
        
        // Check if prices changed before recording
        const yesPriceCents = yesPriceBps / 100;
        const noPriceCents = noPriceBps / 100;
        
        // Only record if price changed significantly (at least 0.01 cent difference)
        const priceChanged = Math.abs(yesPriceCents - (market?.yesPrice || 0)) > 0.01 ||
                            Math.abs(noPriceCents - (market?.noPrice || 0)) > 0.01;
        
        if (priceChanged) {
          await recordPriceSnapshot(yesPriceBps, noPriceBps);
        }
      } catch (err) {
        console.log('Failed to update prices from chain:', err.message);
      }
    }, 30000); // Check every 30 seconds (reduced from 5 seconds)
    
    updatePrices(); // Initial update
    return () => clearInterval(interval);
  }, [isConnected, contracts?.predictionMarket, marketId, recordPriceSnapshot]);

  // Periodic refresh of DB-backed data (price history)
  useEffect(() => {
    if (!marketId || !isConnected || !contracts?.predictionMarket) {
      return;
    }

    const interval = setInterval(async () => {
      await fetchPriceHistoryFromDb();
    }, 60000); // Refresh every 60 seconds (reduced from 20 seconds)

    return () => clearInterval(interval);
  }, [contracts?.predictionMarket, fetchPriceHistoryFromDb, isConnected, marketId]);

  const getTimeAgo = (date) => {
    const now = new Date();
    const diffMs = now - date;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading market data from blockchain...</p>
        </div>
      </div>
    );
  }

  // Remove the wallet connection check - allow viewing without wallet
  // if (!isConnected) {
  //   return (
  //     <div className="min-h-screen bg-[#171717]" style={{ fontFamily: 'gilroy, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
  //       <WormStyleNavbar />
  //       <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 80px)' }}>
  //         <div className="text-center max-w-md">
  //           <div className="text-gray-400 mb-4">
  //             <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  //               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a5 5 0 00-10 0v4m10-4a5 5 0 0110 0v4m-10 0V7m0 4a4 4 0 00-4 4v1a4 4 0 004 4h0a4 4 0 004-4v-1a4 4 0 00-4-4z" />
  //             </svg>
  //           </div>
  //           <h3 className="text-lg font-medium text-white mb-2">Connect Your Wallet</h3>
  //           <p className="text-gray-400 mb-4">Connect MetaMask to view market details and trade directly on-chain.</p>
  //           <button
  //             onClick={() => history.push('/markets')}
  //             className="bg-white text-[#171717] px-6 py-3 rounded-full font-bold hover:bg-gray-100 transition-all"
  //           >
  //             Back to Markets
  //           </button>
  //         </div>
  //       </div>
  //     </div>
  //   );
  // }

  if (!market) {
    return (
      <div className="min-h-screen bg-[#171717]" style={{ fontFamily: 'gilroy, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <WormStyleNavbar />
        <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 80px)' }}>
          <div className="text-center">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Market Not Found</h3>
            <p className="text-gray-400 mb-4">The market you're looking for doesn't exist.</p>
            <button
              onClick={() => history.push('/markets')}
              className="bg-white text-[#171717] px-6 py-3 rounded-full font-bold hover:bg-gray-100 transition-all"
            >
              Back to Markets
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getCategoryColor = (category) => {
    const colors = {
      'Technology': 'bg-blue-500',
      'Crypto': 'bg-blue-600',
      'Sports': 'bg-green-500',
      'Politics': 'bg-red-500',
      'Entertainment': 'bg-purple-500',
      'Economics': 'bg-yellow-500',
      'Science': 'bg-indigo-500',
      'Medical': 'bg-teal-500',
      'AI': 'bg-orange-500',
      'Startups': 'bg-pink-500',
      'default': 'bg-gray-500'
    };
    return colors[category] || colors.default;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleString('default', { month: 'short' }).toUpperCase();
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  return (
    <div className="min-h-screen bg-[#0E0E0E]" style={{ fontFamily: 'gilroy, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <WormStyleNavbar />
      
      <div className="max-w-7xl mx-auto px-4 pt-24 pb-12">
        {/* Two Column Layout - Reversed */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Section - Trading Interface (1/3 width) */}
          <div className="lg:col-span-4">
            <Web3TradingInterface 
              marketId={marketId}
              market={market}
              onTradeComplete={refreshAllData}
            />
          </div>

          {/* Right Section - Market Info (2/3 width) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Market Header */}
            <div className="bg-white/[0.08] backdrop-blur-xl rounded-[24px] p-6 border border-white/20 shadow-lg">
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1">
                  {/* Creator Info */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <span>Creator:</span>
                      <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        <span className="text-white font-semibold">@{market.creator ? market.creator.slice(2, 8) : 'creator'}</span>
                      </div>
                      <div className="bg-white/15 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                        <span className="text-white text-xs font-semibold">UMA</span>
                      </div>
                    </div>
                    <button className="p-2 hover:bg-white/15 rounded-lg transition-colors backdrop-blur-md">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                    </button>
                  </div>

                  {/* Question */}
                  <h1 className="text-2xl font-bold text-white leading-tight">
                    {market.questionTitle}
                  </h1>
                </div>

                {/* Market Image - Right Side */}
                <div className="relative rounded-[16px] overflow-hidden flex-shrink-0 border border-white/20 shadow-lg" style={{ width: '200px', height: '150px' }}>
                  <img
                    src={getMarketImage(market, marketId)}
                    alt={market.questionTitle}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.parentElement.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Percentage Display */}
            <div className="bg-white/[0.08] backdrop-blur-xl rounded-[24px] p-8 border border-white/20 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-4">
                  <div className="text-6xl font-bold text-white font-space-grotesk">{market?.yesPrice ? `${market.yesPrice.toFixed(0)}%` : '50%'}</div>
                  <div className="text-gray-400 text-lg">chance</div>
                </div>
                <button className="p-2 hover:bg-white/15 rounded-lg transition-colors backdrop-blur-md">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="bg-white/[0.08] backdrop-blur-xl rounded-[24px] border border-white/20 overflow-hidden shadow-lg">
              <div className="flex border-b border-white/20">
                {['market', 'rules', 'holders'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-4 text-sm font-semibold capitalize transition-all backdrop-blur-md ${
                      activeTab === tab
                        ? 'bg-white/15 text-white'
                        : 'text-gray-400 hover:text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    {tab === 'holders' ? 'Top Holders' : tab}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="p-6">
              {activeTab === 'market' && (
                <div className="space-y-4">
                  <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/15">
                    <p className="text-sm text-gray-400 mb-4">
                      This market was created on X. Create a market yourself below
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center text-xs font-bold flex-shrink-0 text-white">
                          1
                        </div>
                        <p className="text-sm text-gray-300">Click create on X</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center text-xs font-bold flex-shrink-0 text-white">
                          2
                        </div>
                        <p className="text-sm text-gray-300">Tag @WormPredict and make your prediction</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'rules' && (
                <div className="space-y-4">
                  <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/15">
                    <p className="text-sm text-gray-400 mb-4">
                      This market will resolve based on verifiable information and predetermined criteria.
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center text-xs font-bold flex-shrink-0 text-white">
                          1
                        </div>
                        <p className="text-sm text-gray-300">The outcome must be verifiable through official sources</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center text-xs font-bold flex-shrink-0 text-white">
                          2
                        </div>
                        <p className="text-sm text-gray-300">Resolution will occur after the event date has passed</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center text-xs font-bold flex-shrink-0 text-white">
                          3
                        </div>
                        <p className="text-sm text-gray-300">In case of ambiguity, the market creator's interpretation will be final</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'holders' && (
                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/15 text-center">
                  <p className="text-gray-400 text-sm">No positions yet. Be the first to trade!</p>
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-20">
        <div className="max-w-7xl mx-auto px-4 py-8">
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

export default PolymarketStyleTrading;
