import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import PolymarketChart from '../../components/charts/PolymarketChart';
import Web3TradingInterface from '../../components/trading/Web3TradingInterface';
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

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a5 5 0 00-10 0v4m10-4a5 5 0 0110 0v4m-10 0V7m0 4a4 4 0 00-4 4v1a4 4 0 004 4h0a4 4 0 004-4v-1a4 4 0 00-4-4z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Connect Your Wallet</h3>
          <p className="text-gray-600 mb-4">Connect MetaMask to view market details and trade directly on-chain.</p>
          <button
            onClick={() => history.push('/markets')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            Back to Markets
          </button>
        </div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Market Not Found</h3>
          <p className="text-gray-600 mb-4">The market you're looking for doesn't exist.</p>
          <button
            onClick={() => history.push('/markets')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            Back to Markets
          </button>
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Back Button */}
        <button
          onClick={() => history.push('/markets')}
          className="flex items-center text-gray-600 hover:text-gray-800 mb-6"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Markets
        </button>

        {/* Two Column Layout - Dribbble Style */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Section - Market Info & Chart (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header with Category & Market Title */}
            <div>
              <div className="flex items-start space-x-4 mb-4">
                {/* Market Image - Top Left Corner */}
                <div className="relative w-30 h-20 flex-shrink-0 rounded-xl overflow-hidden border-2 border-gray-200 bg-gradient-to-br from-gray-100 via-gray-50 to-gray-200">
                  <img
                    src={getMarketImage(market, marketId)}
                    alt={market.questionTitle || 'Market'}
                    className="w-full h-full object-cover"
                    onLoad={() => console.log('✅ Market image loaded successfully')}
                    onError={(e) => {
                      console.log('❌ Image failed to load, showing gradient fallback');
                      e.target.style.display = 'none';
                      e.target.parentElement.className = 'relative w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden border-2 border-gray-200 bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100';
                    }}
                  />
               
                </div>

                {/* Market Title and Tags */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${getCategoryColor(market.category)}`}>
                      {market.category || 'General'}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                      {currencySymbol} Market
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">
                    {market.questionTitle}
                  </h1>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="text-xs text-gray-500 mb-1">24hr Volume</div>
                  <div className="text-lg font-bold text-gray-900">
                    ${(market.totalVolume || 0).toFixed(2)}
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="text-xs text-gray-500 mb-1">Total Volume</div>
                  <div className="text-lg font-bold text-gray-900">
                    ${(market.totalVolume || 0).toFixed(2)}
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="text-xs text-gray-500 mb-1">Liquidity</div>
                  <div className="text-lg font-bold text-gray-900">
                    {liquidity > 0 ? `${liquidity.toFixed(2)} ${currencySymbol}` : `0 ${currencySymbol}`}
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="text-xs text-gray-500 mb-1">Expires</div>
                  <div className="text-lg font-bold text-gray-900">
                    {formatDate(market.resolutionDateTime)}
                  </div>
                </div>
              </div>
            </div>

            {/* Price Chart */}
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Market Context</h2>
              </div>
              
              {/* Chart */}
              <PolymarketChart 
                priceHistory={priceHistory}
                yesPriceHistory={yesPriceHistory}
                noPriceHistory={noPriceHistory}
                currentYesPrice={market?.yesPrice || 50}
                currentNoPrice={market?.noPrice || 50}
                selectedRange={timeframe}
                onRangeChange={handleTimeframeChange}
                ranges={[
                  { label: '1H', value: '1h' },
                  { label: '6H', value: '6h' },
                  { label: '1D', value: '1d' },
                  { label: '1W', value: '1w' },
                  { label: '1M', value: '1m' },
                  { label: 'ALL', value: 'all' }
                ]}
              />

              {/* Chart Legend - Current Prices */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium text-gray-700">YES</span>
                    <span className="text-sm font-semibold text-green-600">
                      {market?.yesPrice ? `${market.yesPrice.toFixed(1)}%` : '50.0%'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="text-sm font-medium text-gray-700">NO</span>
                    <span className="text-sm font-semibold text-red-600">
                      {market?.noPrice ? `${market.noPrice.toFixed(1)}%` : '50.0%'}
                    </span>
                  </div>
                  {market?.yesPrice && market?.noPrice && (
                    <div className="text-sm text-gray-500">
                      Difference: <span className="font-semibold">{(Math.abs(market.yesPrice - market.noPrice)).toFixed(1)}%</span>
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {yesPriceHistory.length + noPriceHistory.length > 0 
                    ? `${yesPriceHistory.length + noPriceHistory.length} historical points from DB`
                    : 'No historical data yet'}
                </div>
              </div>
            </div>

            {/* Trades Activity Section - Polymarket Style */}
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Activity</h2>
                <span className="text-sm text-gray-500">{recentTrades.length} trades</span>
              </div>
              
              {recentTrades.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-2">
                    <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-sm">No trades yet</p>
                  <p className="text-gray-400 text-xs mt-1">Be the first to trade on this market</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {recentTrades.slice(0, 50).map((trade, index) => {
                    const tradeTime = new Date(trade.timestamp);
                    const timeAgo = getTimeAgo(tradeTime);
                    const pricePercent = Math.round(trade.price * 100);
                    
                    return (
                      <div 
                        key={index} 
                        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {/* Side indicator */}
                          <div className={`flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 ${
                            trade.side === 'yes' ? 'bg-green-100' : 'bg-red-100'
                          }`}>
                            <span className={`text-xs font-semibold ${
                              trade.side === 'yes' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {trade.side === 'yes' ? 'YES' : 'NO'}
                            </span>
                          </div>
                          
                          {/* Trade details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-semibold ${
                                trade.side === 'yes' ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {pricePercent}%
                              </span>
                              <span className="text-xs text-gray-500">•</span>
                              <span className="text-sm text-gray-700 font-medium">
                                {parseFloat(trade.amount).toFixed(4)} {currencySymbol}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-500 truncate">
                                {trade.trader ? `${trade.trader.slice(0, 6)}...${trade.trader.slice(-4)}` : 'Unknown'}
                              </span>
                              <span className="text-xs text-gray-400">•</span>
                              <span className="text-xs text-gray-400">{timeAgo}</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Trade price badge */}
                        <div className={`px-2 py-1 rounded text-xs font-medium flex-shrink-0 ${
                          trade.side === 'yes' 
                            ? 'bg-green-50 text-green-700' 
                            : 'bg-red-50 text-red-700'
                        }`}>
                          {trade.side === 'yes' ? '↗' : '↘'} {pricePercent}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Section - Trading Interface (1/3 width) */}
          <div className="lg:col-span-1">
            <Web3TradingInterface 
              marketId={marketId}
              market={market}
              onTradeComplete={refreshAllData}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PolymarketStyleTrading;
