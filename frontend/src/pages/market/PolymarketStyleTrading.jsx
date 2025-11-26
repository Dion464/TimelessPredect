import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import PolymarketChart from '../../components/charts/PolymarketChart';
import Web3TradingInterface from '../../components/trading/Web3TradingInterface';
import WormStyleNavbar from '../../components/modern/WormStyleNavbar';
import { useWeb3 } from '../../hooks/useWeb3';
import { getCurrencySymbol } from '../../utils/currency';
import { CONTRACT_ADDRESS, CONTRACT_ABI, RPC_URL, BLOCK_EXPLORER_URL } from '../../contracts/eth-config';
import { ethers } from 'ethers';
import './MarketDetailGlass.css'; // Import glassmorphism styles

const SkeletonBlock = ({ className = '', style = {} }) => (
  <div
    className={`bg-white/5 animate-pulse rounded-[12px] ${className}`}
    style={{
      minHeight: '16px',
      ...style
    }}
  />
);

const MarketDetailSkeleton = () => (
  <div className="min-h-screen bg-[#0E0E0E] text-white" style={{ fontFamily: 'gilroy, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
    <WormStyleNavbar />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 sm:pt-24 pb-12 space-y-8">
      <div className="glass-card rounded-[20px] p-6 sm:p-8 backdrop-blur-[32px] border border-white/10">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 space-y-4">
            <SkeletonBlock className="h-6 w-32" />
            <SkeletonBlock className="h-10 w-3/4" />
            <div className="grid grid-cols-2 gap-4">
              <SkeletonBlock className="h-20" />
              <SkeletonBlock className="h-20" />
            </div>
          </div>
          <SkeletonBlock className="w-full lg:w-[240px] h-[160px]" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
          <SkeletonBlock className="h-[320px]" />
          <div className="space-y-4">
            <SkeletonBlock className="h-12 w-5/6 mx-auto rounded-full" />
            <SkeletonBlock className="h-[260px]" />
          </div>
        </div>
        <div className="lg:col-span-5">
          <SkeletonBlock className="h-[540px]" />
        </div>
      </div>
    </div>
  </div>
);

// Generate image URL based on category and market ID (Polymarket-style)
const getMarketImage = (market, marketIdParam) => {
  if (!market) return 'https://source.unsplash.com/200x200/?abstract,pattern,design';
  
  if (market?.imageUrl) {
    return market.imageUrl;
  }
  
  if (market?.description && market.description.startsWith('data:image')) {
    return market.description;
  }

  const marketId = market.id?.toString?.() || market.marketId?.toString?.() || marketIdParam?.toString?.() || '0';
  const category = market?.category || 'General';
  
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
  const seed = parseInt(marketId, 10) % 1000;
  
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
  const resolveApiBase = () => {
    const envBase = import.meta.env.VITE_API_BASE_URL;
    const isLocal8080 = envBase && /localhost:8080|127\.0\.0\.1:8080/i.test(envBase);
    if (envBase && !isLocal8080) {
      return envBase;
    }
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
    return '';
  };
  // Use current origin for API calls if VITE_API_BASE_URL is not set
  const API_BASE = resolveApiBase();
  const [market, setMarket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('trades');
  const [selectedSide, setSelectedSide] = useState('yes');
  const [amount, setAmount] = useState('');
  const [recentTrades, setRecentTrades] = useState([]);
  const [orderBook, setOrderBook] = useState({
    yes: { bids: [], asks: [] },
    no: { bids: [], asks: [] }
  });
  const [uniqueTraders, setUniqueTraders] = useState(0);
  const [liquidity, setLiquidity] = useState(0);
  const [timeframe, setTimeframe] = useState('1d');
  const refreshTriggerRef = useRef(0); // Force refresh counter
  const [customRules, setCustomRules] = useState([]);
  const fallbackContractRef = useRef(null);
  const [yesPriceHistory, setYesPriceHistory] = useState([]);
  const [noPriceHistory, setNoPriceHistory] = useState([]);
  const [priceHistory, setPriceHistory] = useState([]);

  const safeToNumber = (value) => {
    if (value === null || value === undefined) return 0;
    if (ethers.BigNumber.isBigNumber(value)) {
      return Number(value.toString());
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const formatEtherNumber = (value) => {
    if (value === null || value === undefined) return 0;
    try {
      if (ethers.BigNumber.isBigNumber(value)) {
        return parseFloat(ethers.utils.formatEther(value));
      }
      if (typeof value === 'string') {
        const numeric = parseFloat(value);
        return Number.isFinite(numeric) ? numeric : 0;
      }
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : 0;
    } catch (err) {
      const numeric = parseFloat(value);
      return Number.isFinite(numeric) ? numeric : 0;
    }
  };

  const getStoredRules = useCallback((id) => {
    try {
      if (!id) return [];
      const rulesMap = JSON.parse(localStorage.getItem('marketRules') || '{}');
      const key = id.toString();
      if (Array.isArray(rulesMap[key]) && rulesMap[key].length > 0) {
        return rulesMap[key];
      }
      const numericKey = parseInt(key, 10);
      if (!isNaN(numericKey)) {
        const altKey = numericKey.toString();
        if (Array.isArray(rulesMap[altKey]) && rulesMap[altKey].length > 0) {
          return rulesMap[altKey];
        }
      }
    } catch (err) {
      console.warn('Error reading stored rules:', err);
    }
    return [];
  }, []);

  const formatCreatorHandle = useCallback((creator) => {
    if (!creator) return '@unknown';
    if (creator.startsWith('@')) return creator;
    if (creator.length <= 12) return `@${creator}`;
    return `@${creator.slice(0, 4)}…${creator.slice(-4)}`;
  }, []);

  const getBlockExplorerUrl = useCallback((txHash) => {
    if (!txHash) return null;
    const explorerBase = BLOCK_EXPLORER_URL || 'https://etherscan.io';
    // Remove trailing slash if present
    const base = explorerBase.replace(/\/$/, '');
    return `${base}/tx/${txHash}`;
  }, []);

  const handleShareClick = useCallback(async () => {
    try {
      if (typeof window === 'undefined') return;
      const shareUrl = window.location?.href || `${API_BASE}/markets/${marketId}`;
      const shareData = {
        title: market?.questionTitle || 'PolyDegen Market',
        text: market?.questionTitle || 'Check out this PolyDegen market',
        url: shareUrl
      };

      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      if (navigator.clipboard && shareUrl) {
        await navigator.clipboard.writeText(shareUrl);
      }
    } catch (err) {
      console.warn('Share failed:', err);
    }
  }, [API_BASE, market?.questionTitle, marketId]);

  const getPredictionMarketContract = useCallback(async () => {
    if (contracts?.predictionMarket) {
      return contracts.predictionMarket;
    }
    if (fallbackContractRef.current) {
      return fallbackContractRef.current;
    }
    if (!RPC_URL || !CONTRACT_ADDRESS) {
      return null;
    }
    try {
      const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      fallbackContractRef.current = contract;
      return contract;
    } catch (err) {
      console.error('Failed to initialize fallback contract:', err);
      return null;
    }
  }, [contracts?.predictionMarket]);

  const fetchMarketDataDirect = useCallback(async () => {
    const contract = await getPredictionMarketContract();
    if (!contract) {
      throw new Error('Prediction market contract unavailable');
    }
    const normalizedMarketId = ethers.BigNumber.from(marketId);
    const market = await contract.getMarket(normalizedMarketId);
    const yesPrice = await contract.getCurrentPrice(normalizedMarketId, true);
    const noPrice = await contract.getCurrentPrice(normalizedMarketId, false);

    return {
      id: Number(market.id),
      question: market.question,
      description: market.description,
      category: market.category,
      resolutionTime: market.resolutionTime?.toString?.() ?? '0',
      createdAt: market.createdAt?.toString?.() ?? '0',
      endTime: market.endTime?.toString?.() ?? '0',
      creator: market.creator,
      resolved: market.resolved,
      totalVolume: market.totalVolume ? ethers.utils.formatEther(market.totalVolume) : '0',
      yesPrice: yesPrice?.toNumber?.() ? yesPrice.toNumber() / 100 : 50,
      noPrice: noPrice?.toNumber?.() ? noPrice.toNumber() / 100 : 50
    };
  }, [getPredictionMarketContract, marketId]);

  // These functions need to be defined before refreshAllData
  const fetchRecentTrades = useCallback(async () => {
    if (!contracts?.predictionMarket || !marketId) {
        setRecentTrades([]);
        setUniqueTraders(0);
        return;
      }

    try {
      let formattedTrades = [];

      // Try to use getRecentTrades if available
      if (typeof contracts.predictionMarket.getRecentTrades === 'function') {
        try {
          const trades = await contracts.predictionMarket.getRecentTrades(marketId, 1000);
          
          if (trades && trades.length > 0) {
            formattedTrades = trades.map(trade => {
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
          trader: trade.trader,
          txHash: trade.txHash || trade.transactionHash || null
        };
      });
          }
        } catch (getRecentTradesError) {
          console.warn('getRecentTrades() failed, trying blockchain events:', getRecentTradesError);
        }
      }

      // Fallback: Query blockchain events if getRecentTrades not available or failed
      if (formattedTrades.length === 0) {
        try {
          let provider = null;
          let contractToQuery = null;

          // Try to get provider from contract
          if (contracts.predictionMarket) {
            provider = contracts.predictionMarket.provider;
            contractToQuery = contracts.predictionMarket;
          }

          // If no provider, try to create one - MetaMask only
          if (!provider) {
            // Helper to get MetaMask provider only
            const getMetaMaskProvider = () => {
              if (typeof window === 'undefined' || typeof window.ethereum === 'undefined') {
                return null;
              }
              // If multiple providers exist, find MetaMask only
              if (window.ethereum.providers && Array.isArray(window.ethereum.providers)) {
                const metamaskProvider = window.ethereum.providers.find(
                  (p) => p.isMetaMask && !p.isBraveWallet
                );
                return metamaskProvider || null;
              }
              // If it's MetaMask directly, use it
              return window.ethereum.isMetaMask ? window.ethereum : null;
            };
            
            const metamaskProvider = getMetaMaskProvider();
            if (metamaskProvider) {
              provider = new ethers.providers.Web3Provider(metamaskProvider);
            } else if (RPC_URL) {
              provider = new ethers.providers.JsonRpcProvider(RPC_URL);
            }
          }

          if (provider && CONTRACT_ADDRESS) {
            // Create contract instance if we don't have one
            if (!contractToQuery) {
              contractToQuery = new ethers.Contract(
                CONTRACT_ADDRESS,
                CONTRACT_ABI,
                provider
              );
            }

            // Get current block number
            const currentBlock = await provider.getBlockNumber();
            const fromBlock = Math.max(0, currentBlock - 10000); // Last ~10k blocks

            // Query SharesPurchased events
            const purchaseFilter = contractToQuery.filters.SharesPurchased(marketId, null);
            const purchaseEvents = await contractToQuery.queryFilter(purchaseFilter, fromBlock);

            // Query SharesSold events
            const sellFilter = contractToQuery.filters.SharesSold(marketId, null);
            const sellEvents = await contractToQuery.queryFilter(sellFilter, fromBlock);

            const allEvents = [...purchaseEvents, ...sellEvents].sort((a, b) => {
              if (a.blockNumber !== b.blockNumber) {
                return b.blockNumber - a.blockNumber;
              }
              return b.logIndex - a.logIndex;
            });

            formattedTrades = await Promise.all(
              allEvents.slice(0, 1000).map(async (event) => {
                const args = event.args;
                const isPurchase = event.event === 'SharesPurchased';
                const isYes = args.isYes || args[2];
                const shares = args.shares || args[3];
                const newPrice = args.newPrice || args[5] || args[4];
                const trader = args.buyer || args.seller || args[1];
                
                const block = await event.getBlock();
                const priceBps = newPrice ? Number(newPrice.toString()) : 5000;
                const sharesWei = shares?.toString?.() || shares || '0';
                
                let sharesFormatted = '0';
                try {
                  sharesFormatted = ethers.utils.formatEther(sharesWei);
                } catch (err) {
                  sharesFormatted = sharesWei.toString();
                }

                return {
                  side: isYes ? 'yes' : 'no',
                  amount: parseFloat(sharesFormatted).toFixed(4),
                  price: priceBps / 10000,
                  yesPrice: isYes ? priceBps / 10000 : (10000 - priceBps) / 10000,
                  noPrice: isYes ? (10000 - priceBps) / 10000 : priceBps / 10000,
                  timestamp: new Date(block.timestamp * 1000).toISOString(),
                  trader: trader,
                  txHash: event.transactionHash || null
                };
              })
            );
          }
        } catch (eventError) {
          console.error('Error querying blockchain events:', eventError);
        }
      }

      // Sort newest first
      formattedTrades.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      setRecentTrades(formattedTrades);

      const uniqueAddresses = new Set(formattedTrades.map(trade => (trade.trader || '').toLowerCase()));
      setUniqueTraders(uniqueAddresses.size);

      console.log('✅ Loaded trades:', formattedTrades.length);
    } catch (error) {
      console.error('Error fetching recent trades:', error);
      setRecentTrades([]);
      setUniqueTraders(0);
    }
  }, [contracts?.predictionMarket, marketId]);

  const fetchOrderBook = useCallback(async () => {
    if (!marketId || !API_BASE) return;

    try {
      const [yesResponse, noResponse] = await Promise.all([
        fetch(`${API_BASE}/api/orders?marketId=${marketId}&outcomeId=0&depth=20`),
        fetch(`${API_BASE}/api/orders?marketId=${marketId}&outcomeId=1&depth=20`)
      ]);

      if (!yesResponse.ok || !noResponse.ok) {
        throw new Error('Failed to load order book from API');
      }

      const yesData = await yesResponse.json();
      const noData = await noResponse.json();

      setOrderBook({
        yes: {
          bids: yesData.bids || [],
          asks: yesData.asks || []
        },
        no: {
          bids: noData.bids || [],
          asks: noData.asks || []
        }
      });
    } catch (error) {
      console.error('Error fetching order book from API:', error);
      setOrderBook({
        yes: { bids: [], asks: [] },
        no: { bids: [], asks: [] }
      });
    }
  }, [API_BASE, marketId]);

  const fetchLiquidity = useCallback(async () => {
    // Liquidity is no longer sourced from an AMM
      setLiquidity(0);
  }, []);

  const recordPriceSnapshot = useCallback(async (yesPriceBps, noPriceBps, blockNumber = null) => {
      if (!marketId || !API_BASE) {
        console.warn('Cannot record price snapshot: missing marketId or API_BASE');
        return;
      }

    try {
      const response = await fetch(`${API_BASE}/api/record-price`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          marketId: marketId.toString(),
          yesPriceBps: Math.round(yesPriceBps),
          noPriceBps: Math.round(noPriceBps),
          blockNumber: blockNumber ? blockNumber.toString() : null
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to record price snapshot:', response.status, errorText);
        return;
      }

      const data = await response.json();
      console.log('✅ Price snapshot recorded:', data);
    } catch (error) {
      console.error('Error recording price snapshot:', error);
    }
  }, [marketId, API_BASE]);

  const fetchPriceHistoryFromDb = useCallback(async (timeframeParam = timeframe) => {
    if (!marketId || !API_BASE) {
      console.warn('Cannot fetch price history: missing marketId or API_BASE');
        return;
      }

    try {
      const response = await fetch(`${API_BASE}/api/price-history?marketId=${marketId}&timeframe=${timeframeParam}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to fetch price history:', response.status, errorText);
        return;
      }

      const data = await response.json();
      
      if (data.success && data.data) {
        setYesPriceHistory(data.data.yesPriceHistory || []);
        setNoPriceHistory(data.data.noPriceHistory || []);
        setPriceHistory(data.data.priceHistory || []);
        console.log(`✅ Loaded ${data.data.count || 0} price snapshots for timeframe: ${timeframeParam}`);
      }
    } catch (error) {
      console.error('Error fetching price history:', error);
    }
  }, [marketId, API_BASE, timeframe]);

  const fetchMarketData = useCallback(async () => {
    try {
      setLoading(true);

      let marketData = null;
      if (isConnected && contracts?.predictionMarket && typeof getMarketData === 'function') {
        try {
          marketData = await getMarketData(marketId);
        } catch (primaryError) {
          console.warn('Primary market fetch failed, falling back to direct provider:', primaryError);
        }
      }
      if (!marketData) {
        marketData = await fetchMarketDataDirect();
      }

      const processedMarket = {
        id: Number(marketData.id),
        questionTitle: marketData.question,
        description: marketData.description,
        category: marketData.category || 'General',
        resolutionDateTime: new Date(safeToNumber(marketData.resolutionTime) * 1000).toISOString(),
        createdAt: new Date(safeToNumber(marketData.createdAt) * 1000).toISOString(),
        endTime: safeToNumber(marketData.endTime),
        creatorUsername: marketData.creator,
        isResolved: marketData.resolved,
        totalVolume: formatEtherNumber(marketData.totalVolume),
        yesPrice: Number(marketData.yesPrice ?? 50),
        noPrice: Number(marketData.noPrice ?? 50),
        currentProbability: Number(marketData.yesPrice ?? 50) / 100
      };

      try {
        const imageResponse = await fetch(`${API_BASE}/api/market-images?marketId=${processedMarket.id}`);
        if (imageResponse.ok) {
          const imageData = await imageResponse.json();
          if (imageData?.imageUrl) {
            processedMarket.imageUrl = imageData.imageUrl;
          }
        }
      } catch (imageErr) {
        console.warn('Unable to load market image from API:', imageErr);
      }

      setMarket(processedMarket);
      const storedRules = getStoredRules(processedMarket.id);
      setCustomRules(storedRules);

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
      setCustomRules([]);
    } finally {
      setLoading(false);
    }
  }, [contracts?.predictionMarket, fetchLiquidity, fetchOrderBook, fetchPriceHistoryFromDb, fetchRecentTrades, fetchMarketDataDirect, getMarketData, getStoredRules, isConnected, marketId]);

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
    
    const refreshInterval = setInterval(() => {
        fetchMarketData();
    }, 60000); // 60 seconds
    
    return () => clearInterval(refreshInterval);
  }, [fetchMarketData]);

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
            await recordPriceSnapshot(yesPriceBps, noPriceBps, null);
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
            await recordPriceSnapshot(yesPriceBps, noPriceBps, null);
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

  // Initial price fetch only (events handle real-time updates)
  useEffect(() => {
    if (!isConnected || !contracts?.predictionMarket || !marketId) return;

    const fetchInitialPrices = async () => {
      try {
        const yesPrice = await contracts.predictionMarket.getCurrentPrice(marketId, true);
        const noPrice = await contracts.predictionMarket.getCurrentPrice(marketId, false);
        
        const yesPriceBps = parseFloat(yesPrice.toString());
        const noPriceBps = parseFloat(noPrice.toString());
        const yesPriceCents = yesPriceBps / 100;
        const noPriceCents = noPriceBps / 100;

        setMarket(prev => prev ? {
          ...prev,
          yesPrice: yesPriceCents,
          noPrice: noPriceCents,
          currentProbability: yesPriceBps / 10000
        } : prev);
      } catch (err) {
        // Silent fail - events will update prices
      }
    };

    fetchInitialPrices();

    // Fallback: poll every 5 minutes as safety net
    const fallbackInterval = setInterval(fetchInitialPrices, 300000);
    
    return () => clearInterval(fallbackInterval);
  }, [isConnected, contracts?.predictionMarket, marketId]);

  // Periodic refresh of DB-backed data (price history) - events trigger immediate refresh
  useEffect(() => {
    if (!marketId || !isConnected || !contracts?.predictionMarket) {
      return;
    }

    // Fallback: refresh every 5 minutes (events handle immediate updates)
    const interval = setInterval(async () => {
      await fetchPriceHistoryFromDb();
    }, 300000);

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
    return <MarketDetailSkeleton />;
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

  const defaultRules = [
    "This market will resolve to 'Yes' if the stated outcome occurs before the resolution time; otherwise it resolves to 'No'.",
    'Official confirmation must be available from a reputable public source (press release, official website, or governing body).',
    'If the event is postponed beyond the resolution time, the market resolves to the most recent verifiable outcome.',
    'If no definitive information can be found, the admin team will determine the result using best available evidence.'
  ];

  const rulesToRender = customRules.length > 0
    ? customRules
    : (Array.isArray(market?.rules) && market.rules.length > 0 ? market.rules : defaultRules);

  const tradesToDisplay = Array.isArray(recentTrades) ? recentTrades : [];
  const creatorHandle = formatCreatorHandle(market?.creatorUsername || market?.creator);
  const heroImageUrl = getMarketImage(market, marketId);

  return (
    <div className="min-h-screen bg-[#0E0E0E]" style={{ fontFamily: 'gilroy, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <WormStyleNavbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 sm:pt-24 pb-12">
        {/* Market Header - Full Width */}
        <div className="mb-6 sm:mb-8">
          <div className="glass-card rounded-[24px] p-4 sm:p-6 lg:p-8 border border-white/20 bg-transparent shadow-lg relative overflow-hidden min-h-[200px] lg:min-h-[240px]">
            {/* Image overlay for desktop */}
            <div className="hidden sm:block absolute inset-y-0 right-0 w-1/2 max-w-[420px] min-w-[260px]">
              <div className="relative h-full bg-white/5" style={{ borderRadius: '0px 24px 24px 0px' }}>
                <img
                  src={heroImageUrl}
                  alt={market.questionTitle}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    const parent = e.target.parentElement;
                    if (parent) {
                      parent.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                    }
                  }}
                />
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-[#0E0E0E] via-[#0E0E0E]/60 to-transparent" />
              </div>
            </div>

            <div className="relative z-10 sm:pr-[45%] lg:pr-[420px]">
            {/* Creator badge */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/15 bg-white/5 backdrop-blur-md">
                <span className="text-white/60 text-[11px] tracking-[0.35em] uppercase">Creator</span>
                <span className="text-white text-sm font-semibold tracking-wide">{creatorHandle}</span>
              </div>
              <button
                type="button"
                onClick={handleShareClick}
                className="w-9 h-9 rounded-full border border-white/15 bg-white/5 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                title="Share market"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 6l-4-4-4 4" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v14" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-4 sm:gap-6">
              <h1
                className="flex-1 text-white font-space-grotesk font-medium leading-[1.32]"
                style={{
                  fontWeight: 500,
                  fontSize: '24px',
                  lineHeight: '1.32',
                  letterSpacing: '-0.01em'
                }}
              >
                <span className="block text-[24px] sm:text-[32px] lg:text-[40px] max-w-[700px]">
                  {market.questionTitle}
                </span>
              </h1>
              {/* Mobile image */}
              <div className="sm:hidden rounded-[20px] bg-white/5 overflow-hidden">
                <div className="relative h-[180px]">
                  <img
                    src={heroImageUrl}
                    alt={market.questionTitle}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      const parent = e.target.parentElement;
                      if (parent) {
                        parent.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                      }
                    }}
                  />
                  <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-[#0E0E0E] via-transparent to-transparent" />
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>

        {/* Two Column Layout - Mobile: Stack vertically, Desktop: Side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8">
          {/* Mobile: Trading Interface First, Desktop: Left Side (1/3 width) */}
          <div className="lg:col-span-4 order-1 lg:order-1">
            <Web3TradingInterface 
              marketId={marketId}
              market={market}
              onTradeComplete={refreshAllData}
            />
          </div>

          {/* Mobile: Market Info Second, Desktop: Right Side (2/3 width) */}
          <div className="lg:col-span-8 space-y-4 sm:space-y-6 order-2 lg:order-2">
            {/* Percentage Display */}
           

            {/* Price History Chart */}
            <div>
              <PolymarketChart 
                yesPriceHistory={yesPriceHistory}
                noPriceHistory={noPriceHistory}
                priceHistory={priceHistory}
                currentYesPrice={market?.yesPrice ? market.yesPrice / 100 : 0.5}
                currentNoPrice={market?.noPrice ? market.noPrice / 100 : 0.5}
                height={300}
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
            </div>

            {/* Tabs */}
            <div className="space-y-4 sm:space-y-6">
              <div className="flex items-center justify-between border border-white/25 rounded-[18px] sm:rounded-[22px] px-1 sm:px-2 py-1">
                {['trades', 'market', 'rules'].map((tab) => {
                  const isActive = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 text-center text-xs sm:text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? 'text-white border border-[#FFE600]'
                          : 'text-[#9F9F9F] border border-transparent hover:text-white'
                      }`}
                      style={{
                        fontFamily: 'gilroy, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        padding: '8px 0',
                        borderRadius: '16px',
                        background: isActive ? 'rgba(255,255,255,0.04)' : 'transparent'
                      }}
                    >
                      {tab === 'trades' ? 'Trades' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  );
                })}
              </div>
              
              {/* Tab Content */}
              <div className="glass-card rounded-[16px] sm:rounded-[24px] border border-white/20 backdrop-blur-2xl px-4 sm:px-6 lg:px-9 pb-8 sm:pb-10 lg:pb-12 pt-6 sm:pt-8 lg:pt-10" style={{ background: 'rgba(12,12,12,0.55)' }}>
                {activeTab === 'market' && (
                  <div className="space-y-8 text-[#E4E4E4]" style={{ fontFamily: 'gilroy, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
                    <div className="space-y-3">
                      <h3 className="text-[12px] font-semibold uppercase tracking-[0.3em] text-[#969696] letter-[0.32em]">Description</h3>
                      <p className="text-[16px] leading-7 text-[#EFEFEF]">
                        {market.description ||
                          "Will the Phoenix Suns defeat the Dallas Mavericks in the NBA game held at the American Airlines Center, Dallas, Texas, on 12 November 2025? Market resolves to 'Yes' if the Suns are the official winner. Outcome certified by the NBA's official box score."}
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === 'rules' && (
                  <div className="space-y-6 text-[#E4E4E4]" style={{ fontFamily: 'gilroy, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
                    <p className="text-sm text-white/45 tracking-[0.2em] uppercase">Creator Rules</p>
                    <div className="space-y-4 text-[#D8D8D8] text-[15px] leading-7">
                      {rulesToRender.map((rule, index) => (
                        <div key={`rules-tab-${index}`} className="flex gap-5 items-start">
                          <div
                            className="w-10 h-10 rounded-full border border-white/15 bg-[rgba(45,45,45,0.4)] flex items-center justify-center text-sm font-medium text-white"
                            style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}
                          >
                            {index + 1}
                          </div>
                          <p className="pt-1">{rule}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'trades' && (
                  <div className="space-y-4" style={{ fontFamily: 'gilroy, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
                    {tradesToDisplay.length === 0 ? (
                      <div className="text-white/50 text-sm text-center py-16">
                        No trades yet. Activity will appear here once trading begins.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {tradesToDisplay.map((trade, index) => (
                          <div
                            key={`${trade.timestamp}-${index}`}
                            className="glass-card border border-white/12 rounded-[20px] px-5 py-4 bg-transparent flex flex-col gap-2"
                          >
                            <div className="flex items-center justify-between text-sm">
                              <span className={`uppercase tracking-[0.28em] ${trade.side === 'yes' ? 'text-[#FFE600]' : 'text-white/60'}`}>
                                {trade.side === 'yes' ? 'Yes' : 'No'}
                              </span>
                              <span className="text-white/70">{(trade.price * 100).toFixed(1)}%</span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-white/50">
                              <span>{parseFloat(trade.amount).toFixed(2)} shares</span>
                              <span>{new Date(trade.timestamp).toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              {trade.trader && (
                                <span className="text-white/30 text-[11px] tracking-[0.3em] uppercase">
                                  {trade.trader.slice(0, 6)}…{trade.trader.slice(-4)}
                                </span>
                              )}
                              {trade.txHash && (
                                <a
                                  href={getBlockExplorerUrl(trade.txHash)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#FFE600] hover:text-[#FFD700] text-[11px] tracking-[0.1em] uppercase transition-colors flex items-center gap-1"
                                  title="View on block explorer"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                  TX
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
