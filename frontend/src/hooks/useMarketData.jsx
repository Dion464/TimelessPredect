import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import useWebSocket from './useWebSocket';
import { useWeb3 } from './useWeb3';

const useMarketData = (marketId = null) => {
  const [markets, setMarkets] = useState([]);
  const [priceHistory, setPriceHistory] = useState({});
  const [orderBook, setOrderBook] = useState({});
  const [recentTrades, setRecentTrades] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { isConnected, contracts, getMarketData } = useWeb3();

  // For now, disable WebSocket connection since backend doesn't have WebSocket server
  // We'll simulate real-time updates with intervals instead
  const connectionStatus = 'Simulated';
  const lastMessage = null;
  const sendMessage = () => {};

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((data) => {
    switch (data.type) {
      case 'price_update':
        updateMarketPrice(data.marketId, data.price, data.timestamp);
        break;
      case 'order_book_update':
        updateOrderBook(data.marketId, data.orderBook);
        break;
      case 'trade':
        addRecentTrade(data.marketId, data.trade);
        break;
      case 'market_update':
        updateMarket(data.market);
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  }, []);

  // Update market price and add to history
  const updateMarketPrice = useCallback((marketId, price, timestamp) => {
    setMarkets(prevMarkets => 
      prevMarkets.map(market => 
        market.id === marketId 
          ? { ...market, currentProbability: price, lastUpdated: timestamp }
          : market
      )
    );

    setPriceHistory(prevHistory => ({
      ...prevHistory,
      [marketId]: [
        ...(prevHistory[marketId] || []).slice(-99), // Keep last 100 points
        { price, timestamp: timestamp || Date.now() }
      ]
    }));
  }, []);

  // Update order book
  const updateOrderBook = useCallback((marketId, orderBook) => {
    setOrderBook(prevOrderBook => ({
      ...prevOrderBook,
      [marketId]: orderBook
    }));
  }, []);

  // Add recent trade
  const addRecentTrade = useCallback((marketId, trade) => {
    setRecentTrades(prevTrades => ({
      ...prevTrades,
      [marketId]: [
        trade,
        ...(prevTrades[marketId] || []).slice(0, 49) // Keep last 50 trades
      ]
    }));
  }, []);

  // Update entire market data
  const updateMarket = useCallback((market) => {
    setMarkets(prevMarkets => {
      const existingIndex = prevMarkets.findIndex(m => m.id === market.id);
      if (existingIndex >= 0) {
        const newMarkets = [...prevMarkets];
        newMarkets[existingIndex] = { ...newMarkets[existingIndex], ...market };
        return newMarkets;
      } else {
        return [...prevMarkets, market];
      }
    });
  }, []);

  // Fetch initial market data
  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (!isConnected || !contracts?.predictionMarket) {
        setMarkets([]);
        setPriceHistory({});
        setError('Connect your wallet to load markets from the blockchain');
        return;
      }

      const activeMarketIds = await contracts.predictionMarket.getActiveMarkets();
      const marketsData = await Promise.all(
        activeMarketIds.map(async (rawMarketId) => {
          try {
            const marketData = await getMarketData(rawMarketId.toString());
            const probability = (marketData.yesPrice ?? 50) / 100;
            return {
              id: Number(marketData.id),
              questionTitle: marketData.question,
              description: marketData.description,
              category: marketData.category || 'General',
              currentProbability: probability,
              initialProbability: probability,
              totalVolume: parseFloat(ethers.utils.formatEther(marketData.totalVolume)),
              totalBets: 0,
              resolutionDateTime: new Date(Number(marketData.resolutionTime) * 1000).toISOString(),
              yesLabel: 'YES',
              noLabel: 'NO',
              creatorUsername: marketData.creator,
              isResolved: marketData.resolved
            };
          } catch (err) {
            console.error('Failed to load market from blockchain:', err);
            return null;
          }
        })
      );

      const transformedMarkets = marketsData.filter(Boolean);
      
      setMarkets(transformedMarkets);
      
      // Initialize price history for each market
      const initialHistory = {};
      transformedMarkets.forEach(market => {
        initialHistory[market.id] = [{
          price: market.currentProbability || market.initialProbability || 0.5,
          timestamp: Date.now()
        }];
      });
      setPriceHistory(initialHistory);

    } catch (error) {
      console.error('Error fetching markets from blockchain:', error);
      setError(error.message);
      setMarkets([]);
      setPriceHistory({});
    } finally {
      setLoading(false);
    }
  }, [contracts?.predictionMarket, getMarketData, isConnected]);

  // Generate mock data for development
  // Simulate real-time price updates for development
  useEffect(() => {
    if (markets.length === 0) return;

    const interval = setInterval(() => {
      markets.forEach(market => {
        const currentPrice = market.currentProbability;
        const volatility = 0.02; // 2% volatility
        const change = (Math.random() - 0.5) * volatility;
        const newPrice = Math.max(0.01, Math.min(0.99, currentPrice + change));
        
        updateMarketPrice(market.id, newPrice, Date.now());
      });
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [markets, updateMarketPrice]);

  // Fetch data on mount
  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  // Place order function
  const placeOrder = useCallback(async () => {
    throw new Error('Direct order placement via API is disabled. Use the on-chain trading interface.');
  }, []);

  // Get market by ID
  const getMarket = useCallback((id) => {
    return markets.find(market => market.id === parseInt(id));
  }, [markets]);

  // Get price history for a market
  const getPriceHistory = useCallback((id) => {
    return priceHistory[id] || [];
  }, [priceHistory]);

  // Get order book for a market
  const getOrderBook = useCallback((id) => {
    return orderBook[id] || { bids: [], asks: [] };
  }, [orderBook]);

  // Get recent trades for a market
  const getRecentTrades = useCallback((id) => {
    return recentTrades[id] || [];
  }, [recentTrades]);

  return {
    // Data
    markets,
    priceHistory,
    orderBook,
    recentTrades,
    
    // State
    loading,
    error,
    connectionStatus,
    
    // Actions
    fetchMarkets,
    placeOrder,
    
    // Getters
    getMarket,
    getPriceHistory,
    getOrderBook,
    getRecentTrades,
    
    // Utils
    updateMarketPrice,
    updateOrderBook,
    addRecentTrade
  };
};

export default useMarketData;
