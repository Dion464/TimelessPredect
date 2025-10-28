import { useState, useEffect, useCallback } from 'react';
import useWebSocket from './useWebSocket';

const useMarketData = (marketId = null) => {
  const [markets, setMarkets] = useState([]);
  const [priceHistory, setPriceHistory] = useState({});
  const [orderBook, setOrderBook] = useState({});
  const [recentTrades, setRecentTrades] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      const response = await fetch('http://localhost:8080/v0/markets');
      if (!response.ok) {
        throw new Error('Failed to fetch markets');
      }
      
      const data = await response.json();
      
      // Transform the nested market data structure
      const transformedMarkets = (data.markets || []).map(item => ({
        id: item.market.id,
        questionTitle: item.market.questionTitle,
        description: item.market.description,
        category: item.market.category || 'General',
        currentProbability: item.lastProbability || item.market.initialProbability,
        initialProbability: item.market.initialProbability,
        totalVolume: item.totalVolume || 0,
        totalBets: item.numUsers || 0,
        resolutionDateTime: item.market.resolutionDateTime,
        yesLabel: item.market.yesLabel,
        noLabel: item.market.noLabel,
        creatorUsername: item.market.creatorUsername,
        isResolved: item.market.isResolved
      }));
      
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
      console.error('Error fetching markets:', error);
      setError(error.message);
      
      // Fallback to mock data for development
      generateMockData();
    } finally {
      setLoading(false);
    }
  }, []);

  // Generate mock data for development
  const generateMockData = useCallback(() => {
    const mockMarkets = [
      {
        id: 1,
        questionTitle: "Will Bitcoin reach $100,000 by end of 2024?",
        category: "Technology",
        currentProbability: 0.65,
        totalVolume: 125000,
        totalBets: 1250,
        resolutionDateTime: "2024-12-31T23:59:59Z",
        yesLabel: "Yes",
        noLabel: "No"
      },
      {
        id: 2,
        questionTitle: "Will the Lakers win the NBA Championship?",
        category: "Sports",
        currentProbability: 0.35,
        totalVolume: 85000,
        totalBets: 890,
        resolutionDateTime: "2024-06-30T23:59:59Z",
        yesLabel: "Yes",
        noLabel: "No"
      },
      {
        id: 3,
        questionTitle: "Will AI achieve AGI by 2025?",
        category: "Technology",
        currentProbability: 0.25,
        totalVolume: 200000,
        totalBets: 2100,
        resolutionDateTime: "2025-12-31T23:59:59Z",
        yesLabel: "Yes",
        noLabel: "No"
      }
    ];

    setMarkets(mockMarkets);
    
    // Initialize mock price history
    const mockHistory = {};
    mockMarkets.forEach(market => {
      const history = [];
      const basePrice = market.currentProbability;
      
      // Generate 24 hours of mock price data
      for (let i = 24; i >= 0; i--) {
        const timestamp = Date.now() - (i * 60 * 60 * 1000); // Hours ago
        const volatility = 0.05; // 5% volatility
        const change = (Math.random() - 0.5) * volatility;
        const price = Math.max(0.01, Math.min(0.99, basePrice + change));
        
        history.push({ price, timestamp });
      }
      
      mockHistory[market.id] = history;
    });
    
    setPriceHistory(mockHistory);
  }, []);

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
  const placeOrder = useCallback(async (marketId, side, amount, price) => {
    try {
      const response = await fetch('http://localhost:8080/v0/bet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          marketId,
          side, // 'yes' or 'no'
          amount,
          price,
          type: 'limit'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to place order');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error placing order:', error);
      throw error;
    }
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
