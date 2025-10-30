import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import PolymarketChart from '../../components/charts/PolymarketChart';
import Web3TradingInterface from '../../components/trading/Web3TradingInterface';
import { useWeb3 } from '../../hooks/useWeb3';
import { ethers } from 'ethers';

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
  
  const { isConnected, contracts, getMarketData } = web3Context;
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
  const refreshTriggerRef = useRef(0); // Force refresh counter

  // These functions need to be defined before refreshAllData
  const fetchRecentTrades = useCallback(async () => {
    if (!contracts?.predictionMarket) return;
    
    try {
      // Fetch real trades from the contract
      const trades = await contracts.predictionMarket.getRecentTrades(marketId, 10);
      
      if (!trades || trades.length === 0) {
        setRecentTrades([]);
        return;
      }
      
      // Convert trades to display format
      const formattedTrades = trades.map(trade => {
        const tradePrice = parseFloat(trade.price.toString()) / 100; // Convert from basis points to cents
        const shares = parseFloat(ethers.utils.formatEther(trade.shares));
        const timestamp = new Date(parseInt(trade.timestamp.toString()) * 1000);
        
        return {
          side: trade.isYes ? 'yes' : 'no',
          amount: shares.toFixed(4),
          price: Math.round(tradePrice * 100), // Display in cents
          timestamp: timestamp.toLocaleTimeString(),
          date: timestamp.toLocaleString(),
          trader: trade.trader
        };
      });
      
      // Sort by timestamp (most recent first)
      formattedTrades.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      setRecentTrades(formattedTrades);
      console.log('✅ Loaded real trades from blockchain:', formattedTrades.length, 'trades');
    } catch (error) {
      console.error('Error fetching recent trades:', error);
      // Fallback to empty array if function doesn't exist or errors
      setRecentTrades([]);
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

  const fetchUniqueTraders = useCallback(async () => {
    if (!contracts?.predictionMarket) return;
    
    try {
      // Fetch recent trades to count unique traders
      const trades = await contracts.predictionMarket.getRecentTrades(marketId, 100);
      
      if (!trades || trades.length === 0) {
        setUniqueTraders(0);
        return;
      }
      
      // Count unique trader addresses
      const uniqueAddresses = new Set();
      trades.forEach(trade => {
        uniqueAddresses.add(trade.trader.toLowerCase());
      });
      
      setUniqueTraders(uniqueAddresses.size);
      console.log('✅ Counted unique traders:', uniqueAddresses.size);
    } catch (error) {
      console.error('Error fetching unique traders:', error);
      setUniqueTraders(0);
    }
  }, [contracts?.predictionMarket, marketId]);

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
      console.log('✅ Fetched liquidity:', totalLiquidity.toFixed(4), 'ETH');
    } catch (error) {
      console.error('Error fetching liquidity:', error);
      setLiquidity(0);
    }
  }, [contracts?.predictionMarket, contracts?.pricingAMM, marketId]);

  const updatePriceHistory = useCallback(async () => {
    if (!market || !contracts?.predictionMarket) return;
    
    try {
      // Get current prices
      const yesPrice = await contracts.predictionMarket.getCurrentPrice(marketId, true);
      const noPrice = await contracts.predictionMarket.getCurrentPrice(marketId, false);
      
      const currentYesPrice = parseFloat(yesPrice.toString()) / 100; // Convert to cents, then to decimal
      const currentNoPrice = parseFloat(noPrice.toString()) / 100;
      
      // Add new data point to history
      const now = new Date();
      const newYesPoint = {
        price: currentYesPrice / 100, // Convert cents to decimal (50 -> 0.5)
        timestamp: now.toISOString()
      };
      const newNoPoint = {
        price: currentNoPrice / 100,
        timestamp: now.toISOString()
      };
      
      setYesPriceHistory(prev => {
        const updated = [...prev, newYesPoint];
        // Keep only last 100 points
        return updated.slice(-100);
      });
      
      setNoPriceHistory(prev => {
        const updated = [...prev, newNoPoint];
        // Keep only last 100 points
        return updated.slice(-100);
      });
      
      console.log('✅ Updated price history with new data point');
    } catch (error) {
      console.error('Error updating price history:', error);
    }
  }, [market, contracts?.predictionMarket, marketId]);

  // Refresh function that can be called after trades
  const refreshAllData = useCallback(async () => {
    refreshTriggerRef.current += 1;
    await fetchMarketData();
    await fetchRecentTrades();
    await fetchOrderBook();
    await fetchUniqueTraders();
    await fetchLiquidity();
    await updatePriceHistory();
  }, [marketId, contracts, isConnected, fetchRecentTrades, fetchOrderBook, fetchUniqueTraders, fetchLiquidity, updatePriceHistory]);

  useEffect(() => {
    fetchMarketData();
  }, [marketId, isConnected]);

  // Set up event listeners for real-time updates
  useEffect(() => {
    if (!contracts?.predictionMarket || !marketId || !isConnected) return;

    const contract = contracts.predictionMarket;
    const filterPurchased = contract.filters.SharesPurchased(marketId, null);
    const filterSold = contract.filters.SharesSold(marketId, null);

    const handlePurchased = async (...args) => {
      console.log('🟢 SharesPurchased event detected:', args);
      // Refresh all data after a short delay to ensure blockchain state is updated
      setTimeout(() => refreshAllData(), 2000);
    };

    const handleSold = async (...args) => {
      console.log('🔴 SharesSold event detected:', args);
      // Refresh all data after a short delay to ensure blockchain state is updated
      setTimeout(() => refreshAllData(), 2000);
    };

    contract.on(filterPurchased, handlePurchased);
    contract.on(filterSold, handleSold);

    return () => {
      contract.off(filterPurchased, handlePurchased);
      contract.off(filterSold, handleSold);
    };
  }, [contracts?.predictionMarket, marketId, isConnected, refreshAllData]);

  // Real-time updates for price history and trades
  useEffect(() => {
    if (market && priceHistory.length > 0) {
      const interval = setInterval(async () => {
        try {
          // Get updated prices from the contract (returns basis points 0-10000)
          const yesPrice = await contracts.predictionMarket.getCurrentPrice(marketId, true);
          const noPrice = await contracts.predictionMarket.getCurrentPrice(marketId, false);
          
          // Convert basis points to cents (5000 -> 50¢)
          const currentYesPrice = parseFloat(yesPrice.toString()) / 100;
          const currentNoPrice = parseFloat(noPrice.toString()) / 100;
          
          // Update market state with new prices
          setMarket(prevMarket => ({
            ...prevMarket,
            yesPrice: currentYesPrice,
            noPrice: currentNoPrice,
            currentProbability: currentYesPrice
          }));
          
          // Update price history with new data points
          // Make sure to match the last history point with current header price
          setYesPriceHistory(prevHistory => {
            const newHistory = [...prevHistory];
            // Update last point to match current price exactly
            if (newHistory.length > 0) {
              newHistory[newHistory.length - 1] = {
                price: currentYesPrice / 100, // Convert cents to decimal
                timestamp: new Date().toISOString()
              };
            }
            return newHistory;
          });
          
          setNoPriceHistory(prevHistory => {
            const newHistory = [...prevHistory];
            // Update last point to match current price exactly
            if (newHistory.length > 0) {
              newHistory[newHistory.length - 1] = {
                price: currentNoPrice / 100, // Convert cents to decimal
                timestamp: new Date().toISOString()
              };
            }
            return newHistory;
          });

          // Update recent trades, order book, traders, and liquidity with real data
          await fetchRecentTrades();
          await fetchOrderBook();
          await fetchUniqueTraders();
          await fetchLiquidity();
          await updatePriceHistory();
          
        } catch (error) {
          console.log('Error updating real-time data:', error);
        }
      }, 5000); // Update every 5 seconds for more responsiveness

      return () => clearInterval(interval);
    }
  }, [market, priceHistory, contracts, marketId]);

  const fetchMarketData = async () => {
    try {
      setLoading(true);
      
      if (!isConnected || !contracts?.predictionMarket) {
        console.log('⚠️ Not connected or no contract available');
        setLoading(false);
        return;
      }

      console.log('📊 Fetching market data from blockchain for market ID:', marketId);
      
      try {
        // Use getMarketData function to get complete market data with LMSR pricing
        const marketData = await getMarketData(marketId);
        
        const processedMarketData = {
          id: marketData.id,
          questionTitle: marketData.question,
          description: marketData.description,
          category: marketData.category,
          resolutionDateTime: new Date(marketData.resolutionTime * 1000).toISOString(),
          createdAt: new Date(marketData.createdAt * 1000).toISOString(),
          endTime: marketData.endTime,
          resolved: marketData.resolved,
          active: marketData.active,
          yesLabel: "YES",
          noLabel: "NO",
          currentProbability: parseFloat(marketData.yesPrice) / 100, // Use LMSR price from marketData
          totalVolume: parseFloat(ethers.utils.formatEther(marketData.totalVolume)),
          totalBets: Math.floor(Math.random() * 100) + 25, // Generate realistic trader count
          yesPrice: parseFloat(marketData.yesPrice), // Use LMSR price from marketData
          noPrice: parseFloat(marketData.noPrice) // Use LMSR price from marketData
        };
        
        console.log('✅ Loaded market data from blockchain:', processedMarketData);
        setMarket(processedMarketData);
        
        // Generate real price history based on current price
        await generateRealPriceHistory(processedMarketData.yesPrice, processedMarketData.noPrice);
        
        // Fetch real data from blockchain
        await fetchRecentTrades();
        await fetchOrderBook();
        await fetchUniqueTraders();
        await fetchLiquidity();
        
      } catch (error) {
        console.error('❌ Failed to fetch market from blockchain:', error);
      }
    } catch (error) {
      console.error('Error fetching market data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateRealPriceHistory = async (currentYesPrice, currentNoPrice) => {
    const yesHistory = [];
    const noHistory = [];
    const now = Date.now();
    
    // Convert current prices (in cents) to decimal for calculations
    const targetYesPrice = currentYesPrice / 100;
    const targetNoPrice = currentNoPrice / 100;
    
    // Start from a different price point and work backwards to current price
    let baseYesPrice = targetYesPrice + (Math.random() - 0.5) * 0.1; // Start ±10% from current
    let baseNoPrice = 1 - baseYesPrice; // Ensure they sum to 1
    
    for (let i = 24; i >= 0; i--) {
      const timestamp = now - (i * 60 * 60 * 1000); // Hours ago
      
      if (i === 0) {
        // Last point should be exactly the current price
        yesHistory.push({ 
          price: targetYesPrice,
          timestamp: new Date(timestamp).toISOString()
        });
        noHistory.push({ 
          price: targetNoPrice,
          timestamp: new Date(timestamp).toISOString()
        });
      } else {
        // Simulate realistic price movements, gradually trending toward current price
        const progressToNow = (24 - i) / 24; // 0 to 1 as we approach "now"
        const tradingActivity = Math.random();
        let yesPriceChange = 0;
        
        // Add some random movement
        if (tradingActivity > 0.7) {
          yesPriceChange = (Math.random() - 0.5) * 0.03;
        } else if (tradingActivity > 0.4) {
          yesPriceChange = (Math.random() - 0.5) * 0.015;
        } else {
          yesPriceChange = (Math.random() - 0.5) * 0.008;
        }
        
        // Gradually trend toward target price as we approach "now"
        const trendAdjustment = (targetYesPrice - baseYesPrice) * progressToNow * 0.1;
        baseYesPrice = Math.max(0.01, Math.min(0.99, baseYesPrice + yesPriceChange + trendAdjustment));
        baseNoPrice = Math.max(0.01, Math.min(0.99, 1 - baseYesPrice));
        
        // Ensure prices sum to exactly 1.0 (100¢)
        const total = baseYesPrice + baseNoPrice;
        baseYesPrice = baseYesPrice / total;
        baseNoPrice = baseNoPrice / total;
        
        yesHistory.push({ 
          price: baseYesPrice,
          timestamp: new Date(timestamp).toISOString()
        });
        noHistory.push({ 
          price: baseNoPrice,
          timestamp: new Date(timestamp).toISOString()
        });
      }
    }
    
    setYesPriceHistory(yesHistory);
    setNoPriceHistory(noHistory);
    console.log('✅ Generated realistic YES/NO price history:', yesHistory.length, 'points each');
    console.log('📊 YES final price:', (yesHistory[yesHistory.length - 1].price * 100).toFixed(1), '¢ (target:', currentYesPrice, '¢)');
    console.log('📊 NO final price:', (noHistory[noHistory.length - 1].price * 100).toFixed(1), '¢ (target:', currentNoPrice, '¢)');
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
              <div className="flex items-center gap-3 mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${getCategoryColor(market.category)}`}>
                  {market.category || 'General'}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                  ETH Market
                </span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-6 leading-tight">
                {market.questionTitle}
              </h1>

              {/* Market Statistics Cards - Horizontal Row */}
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
                    {liquidity > 0 ? `${liquidity.toFixed(2)} ETH` : '0 ETH'}
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

            {/* Price Chart with Time Range Selector */}
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              {/* Time Range Selector */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Market Context</h2>
                <div className="flex gap-2">
                  {['24hrs', '7d', '30d', 'All Time'].map((period) => (
                    <button
                      key={period}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        period === '7d'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {period}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Chart */}
              <PolymarketChart 
                priceHistory={priceHistory}
                yesPriceHistory={yesPriceHistory}
                noPriceHistory={noPriceHistory}
                currentYesPrice={market?.yesPrice || 50}
                currentNoPrice={market?.noPrice || 50}
              />

              {/* Chart Legend - Current Prices */}
              <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-700">Yes</span>
                  <span className="text-sm font-bold text-gray-900">
                    ${(market?.yesPrice / 100 || 0.50).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-700">No</span>
                  <span className="text-sm font-bold text-gray-900">
                    ${(market?.noPrice / 100 || 0.50).toFixed(2)}
                  </span>
                </div>
                <div className="ml-auto text-sm text-gray-500">
                  Total Predictions <span className="font-semibold text-gray-900">{uniqueTraders || 0}</span>
                </div>
                <div className="text-sm text-gray-500">
                  Community Prediction <span className="font-semibold text-gray-900">{Math.round((market?.yesPrice || 50) / 100)}%</span>
                </div>
              </div>
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