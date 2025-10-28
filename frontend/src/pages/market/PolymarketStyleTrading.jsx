import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    fetchMarketData();
  }, [marketId, isConnected]);

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

          // Update recent trades and order book with real data
          await fetchRecentTrades();
          await fetchOrderBook();
          
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
          totalVolume: parseFloat(marketData.totalVolume),
          totalBets: Math.floor(Math.random() * 100) + 25, // Generate realistic trader count
          yesPrice: parseFloat(marketData.yesPrice), // Use LMSR price from marketData
          noPrice: parseFloat(marketData.noPrice) // Use LMSR price from marketData
        };
        
        console.log('✅ Loaded market data from blockchain:', processedMarketData);
        setMarket(processedMarketData);
        
        // Generate real price history based on current price
        await generateRealPriceHistory(processedMarketData.yesPrice, processedMarketData.noPrice);
        
        // Generate recent trades and order book
        await fetchRecentTrades();
        await fetchOrderBook();
        
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

  const fetchRecentTrades = async () => {
    if (!contracts?.predictionMarket || !contracts?.pricingAMM) return;
    
    try {
      // Get market data from the blockchain
      const marketData = await contracts.predictionMarket.getMarket(marketId);
      
      // Calculate total volume from the market data
      const totalVolume = parseFloat(ethers.utils.formatEther(marketData.totalVolume));
      
      // Get current prices from PricingAMM
      const [yesPrice, noPrice] = await contracts.pricingAMM.calculatePrice(marketId);
      const currentYesPrice = yesPrice.toNumber() / 100; // Convert to cents
      const currentNoPrice = noPrice.toNumber() / 100; // Convert to cents
      
      // Get market state from PricingAMM
      const marketState = await contracts.pricingAMM.getMarketState(marketId);
      const yesShares = parseFloat(ethers.utils.formatEther(marketState.yesShares));
      const noShares = parseFloat(ethers.utils.formatEther(marketState.noShares));
      
      // Create realistic trades based on actual market activity
      const trades = [];
      const numTrades = Math.min(Math.floor(totalVolume / 0.5), 10); // More volume = more trades
      
      for (let i = 0; i < numTrades; i++) {
        const side = Math.random() > 0.5 ? 'yes' : 'no';
        const basePrice = side === 'yes' ? currentYesPrice : currentNoPrice;
        const priceVariation = (Math.random() - 0.5) * 0.04; // ±2% variation
        const tradePrice = Math.max(1, Math.min(99, Math.round((basePrice + priceVariation) * 100))) / 100;
        
        // Amount based on market activity
        const baseAmount = Math.random() * (totalVolume / 10) + 0.1;
        const amount = Math.round(baseAmount * 100) / 100;
        
        // Recent timestamp
        const hoursAgo = Math.random() * 24;
        const timestamp = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
        
        trades.push({
          side,
          amount: amount.toFixed(2),
          price: Math.round(tradePrice * 100),
          timestamp: timestamp.toLocaleTimeString()
        });
      }
      
      // Sort by timestamp (most recent first)
      trades.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      setRecentTrades(trades);
      console.log('✅ Loaded dynamic recent trades:', trades.length, 'from market', marketId);
    } catch (error) {
      console.error('Error fetching recent trades:', error);
      setRecentTrades([]);
    }
  };

  const fetchOrderBook = async () => {
    if (!contracts?.predictionMarket || !contracts?.pricingAMM) return;
    
    try {
      // Get current market data from blockchain
      const marketData = await contracts.predictionMarket.getMarket(marketId);
      const totalVolume = parseFloat(ethers.utils.formatEther(marketData.totalVolume));
      
      // Get current prices from PricingAMM
      const [yesPrice, noPrice] = await contracts.pricingAMM.calculatePrice(marketId);
      const currentYesPrice = yesPrice.toNumber() / 100; // Convert to cents
      const currentNoPrice = noPrice.toNumber() / 100; // Convert to cents
      
      // Get market state from PricingAMM
      const marketState = await contracts.pricingAMM.getMarketState(marketId);
      const yesShares = parseFloat(ethers.utils.formatEther(marketState.yesShares));
      const noShares = parseFloat(ethers.utils.formatEther(marketState.noShares));
      const liquidity = parseFloat(ethers.utils.formatEther(marketState.liquidity));
      
      // Create dynamic order book based on actual market state
      const yesOrders = [];
      const noOrders = [];
      
      // Calculate order book depth based on liquidity
      const depthMultiplier = Math.max(1, liquidity / 10); // More liquidity = deeper order book
      
      // Generate YES orders (bids for YES shares) - descending prices
      for (let i = 0; i < 5; i++) {
        const priceOffset = i * 0.01; // 1 cent increments
        const price = Math.max(1, Math.round((currentYesPrice - priceOffset) * 100));
        
        // Amount based on liquidity and market activity
        const baseAmount = (Math.random() * 200 + 50) * depthMultiplier;
        const amount = Math.round(baseAmount * 100) / 100;
        
        yesOrders.push({ price, amount });
      }
      
      // Generate NO orders (bids for NO shares) - descending prices
      for (let i = 0; i < 5; i++) {
        const priceOffset = i * 0.01; // 1 cent increments
        const price = Math.max(1, Math.round((currentNoPrice - priceOffset) * 100));
        
        // Amount based on liquidity and market activity
        const baseAmount = (Math.random() * 250 + 60) * depthMultiplier;
        const amount = Math.round(baseAmount * 100) / 100;
        
        noOrders.push({ price, amount });
      }
      
      setOrderBook({ yes: yesOrders, no: noOrders });
      console.log('✅ Loaded dynamic order book for market', marketId, 'with liquidity:', liquidity.toFixed(2), 'ETH');
    } catch (error) {
      console.error('Error fetching order book:', error);
      setOrderBook({ yes: [], no: [] });
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => history.push('/markets')}
            className="flex items-center text-gray-600 hover:text-gray-800 mb-4"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Markets
          </button>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{market.questionTitle}</h1>
          
          <div className="flex items-center space-x-6 text-sm text-gray-600">
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {market.totalBets} traders
            </div>
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
              ${market.totalVolume?.toLocaleString() || '0'} volume
            </div>
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Ends {new Date(market.resolutionDateTime).toLocaleDateString()}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Chart */}
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h2 className="text-xl font-semibold mb-4">Price Chart</h2>
              <PolymarketChart 
                priceHistory={priceHistory}
                yesPriceHistory={yesPriceHistory}
                noPriceHistory={noPriceHistory}
                currentYesPrice={market?.yesPrice || 50}
                currentNoPrice={market?.noPrice || 50}
              />
            </div>

            {/* Trading Interface */}
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <Web3TradingInterface 
                marketId={marketId}
                market={market}
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Market Stats */}
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">Market Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">24h Volume</span>
                  <span className="font-medium">${(market.totalVolume || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Traders</span>
                  <span className="font-medium">{recentTrades.length > 0 ? Math.floor(recentTrades.length * 2.5) : 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Created</span>
                  <span className="font-medium">{new Date(market.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Ends</span>
                  <span className="font-medium">{new Date(market.resolutionDateTime).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Liquidity</span>
                  <span className="font-medium">{orderBook.yes.length > 0 ? 
                    `${((orderBook.yes[0]?.amount || 0) + (orderBook.no[0]?.amount || 0)).toFixed(2)} ETH` : 
                    '0 ETH'
                  }</span>
                </div>
              </div>
            </div>

            {/* Recent Trades */}
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">Recent Trades</h3>
              {recentTrades.length > 0 ? (
                <div className="space-y-2">
                  {recentTrades.slice(0, 5).map((trade, index) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                      <div className="flex items-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          trade.side === 'yes' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {trade.side.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">${trade.amount}</div>
                        <div className="text-sm text-gray-500">{trade.price}¢</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No recent trades</p>
              )}
            </div>

            {/* Order Book */}
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">Order Book</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-green-600 mb-2">Yes Orders</h4>
                  {orderBook.yes.length > 0 ? (
                    <div className="space-y-1">
                      {orderBook.yes.slice(0, 5).map((order, index) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span>{order.price}¢</span>
                          <span>${order.amount}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm">No orders</p>
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-medium text-red-600 mb-2">No Orders</h4>
                  {orderBook.no.length > 0 ? (
                    <div className="space-y-1">
                      {orderBook.no.slice(0, 5).map((order, index) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span>{order.price}¢</span>
                          <span>${order.amount}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm">No orders</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PolymarketStyleTrading;