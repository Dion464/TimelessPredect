import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import { useWeb3 } from '../../hooks/useWeb3';
import { getCurrencySymbol } from '../../utils/currency';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import WormStyleNavbar from '../../components/modern/WormStyleNavbar';
import PolymarketChart from '../../components/charts/PolymarketChart';
import MarketCountdown from '../../components/common/MarketCountdown';
import Web3TradingInterface from '../../components/trading/Web3TradingInterface';
import { 
  createOrderWithDefaults, 
  signOrder, 
  validateOrder, 
  centsToTicks,
  ticksToCents
} from '../../utils/eip712';
import { CONTRACT_ADDRESS, CONTRACT_ABI, RPC_URL } from '../../contracts/eth-config';

const INCENTIV_EXCHANGE_ADDRESS = '0x8cF17Ff1Abe81B5c74f78edb62b0AeF31936642C';
const EXCHANGE_CONTRACT = import.meta.env.VITE_EXCHANGE_CONTRACT_ADDRESS || INCENTIV_EXCHANGE_ADDRESS;
const API_BASE = import.meta.env.VITE_API_BASE_URL || window.location.origin;

// Generate image URL based on category and market ID
const getMarketImage = (market, marketIdParam) => {
  if (!market) return 'https://source.unsplash.com/800x400/?abstract,pattern,design';
  
  const marketId = market.id?.toString() || marketIdParam?.toString() || '0';
  
  // Check localStorage for custom images
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
  
  // Add error handling for Web3 context
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
  const [tradeType, setTradeType] = useState('buy'); // 'buy' or 'sell'
  const [outcome, setOutcome] = useState('yes'); // 'yes' or 'no'
  const [amount, setAmount] = useState('');
  const [isTrading, setIsTrading] = useState(false);
  const [position, setPosition] = useState({ yesShares: '0', noShares: '0', totalInvested: '0' });
  const [marketData, setMarketData] = useState(null);
  const [estimatedShares, setEstimatedShares] = useState('0');
  const [priceHistory, setPriceHistory] = useState([]);
  const [yesPriceHistory, setYesPriceHistory] = useState([]);
  const [noPriceHistory, setNoPriceHistory] = useState([]);
  const [orderType, setOrderType] = useState('market'); // 'market' or 'limit'
  const [limitPrice, setLimitPrice] = useState('');
  const [timeframe, setTimeframe] = useState('1h');
  
  const currencySymbol = getCurrencySymbol(chainId);

  // Helper function to record price after trades
  const recordPriceAfterTrade = useCallback(async () => {
    if (!contracts?.predictionMarket || !id) return;

    try {
      // Get prices immediately (blockchain updates are fast)
      const yesPrice = await contracts.predictionMarket.getCurrentPrice(id, true);
      const noPrice = await contracts.predictionMarket.getCurrentPrice(id, false);
      
      const yesPriceBps = parseFloat(yesPrice.toString());
      const noPriceBps = parseFloat(noPrice.toString());

      console.log('📊 Recording price after trade:', { yesPriceBps, noPriceBps });

      const response = await fetch(`${API_BASE}/api/record-price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketId: id.toString(),
          yesPriceBps: Math.round(yesPriceBps),
          noPriceBps: Math.round(noPriceBps),
          blockNumber: null
        })
      });

      if (response.ok) {
        console.log('✅ Price recorded after trade');
      }
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

      // Fetch user position if connected
      if (isConnected && getUserPosition) {
        try {
          const userPos = await getUserPosition(id);
          setPosition(userPos);
        } catch (err) {
          console.log('Could not fetch user position:', err.message);
        }
      }

      // Fetch price history
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

  // Real-time price updates with recording
  useEffect(() => {
    if (!contracts.predictionMarket || !id) return;

    let lastYesPriceBps = null;
    let lastNoPriceBps = null;

    const updatePrices = async () => {
      try {
        const yesPrice = await contracts.predictionMarket.getCurrentPrice(id, true);
        const noPrice = await contracts.predictionMarket.getCurrentPrice(id, false);
        
        const yesPriceBps = parseFloat(yesPrice.toString());
        const noPriceBps = parseFloat(noPrice.toString());
        const yesPriceCents = yesPriceBps / 100;
        const noPriceCents = noPriceBps / 100;
        
        // Update UI
        setMarketData(prev => {
          if (prev?.yesPrice === yesPriceCents && prev?.noPrice === noPriceCents) {
            return prev;
          }
          return {
            ...prev,
            yesPrice: yesPriceCents,
            noPrice: noPriceCents
          };
        });

        // Also update market state
        setMarket(prev => prev ? {
          ...prev,
          yesPrice: Math.round(yesPriceCents),
          noPrice: Math.round(noPriceCents)
        } : prev);

        // Record price snapshot to DB if price changed
        if (lastYesPriceBps !== yesPriceBps || lastNoPriceBps !== noPriceBps) {
          console.log('💰 Price changed! Recording to DB:', {
            previous: { yes: lastYesPriceBps, no: lastNoPriceBps },
            current: { yes: yesPriceBps, no: noPriceBps }
          });

          try {
            const response = await fetch(`${API_BASE}/api/record-price`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                marketId: id.toString(),
                yesPriceBps: Math.round(yesPriceBps),
                noPriceBps: Math.round(noPriceBps),
                blockNumber: null
              })
            });

            if (response.ok) {
              console.log('✅ Price snapshot recorded');
              lastYesPriceBps = yesPriceBps;
              lastNoPriceBps = noPriceBps;
              
              // Refresh price history immediately
              fetchData();
            }
          } catch (err) {
            console.error('Failed to record price snapshot:', err);
          }
        }
      } catch (err) {
        console.log('Failed to update prices:', err.message);
      }
    };

    const interval = setInterval(updatePrices, 30000); // Every 30 seconds
    updatePrices(); // Initial update

    return () => clearInterval(interval);
  }, [contracts.predictionMarket, id]);

  const handleTrade = async () => {
    if (!isConnected) {
      connectWallet();
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (tradeType === 'buy') {
      await handleBuy();
    } else {
      await handleSell();
    }
  };

  const handleBuy = async () => {
    if (parseFloat(amount) > parseFloat(ethBalance)) {
      toast.error(`Insufficient ${currencySymbol} balance`);
      return;
    }

    setIsTrading(true);

    try {
      if (orderType === 'limit') {
        // Place limit order
        if (!limitPrice || parseFloat(limitPrice) <= 0 || parseFloat(limitPrice) > 100) {
          toast.error('Please enter a valid limit price (0.01-1.00)');
          setIsTrading(false);
          return;
        }

        if (!signer) {
          toast.error('Please connect your wallet');
          setIsTrading(false);
          return;
        }

        const outcomeId = outcome === 'yes' ? 0 : 1;
        const orderData = {
          maker: account,
          marketId: id.toString(),
          outcomeId: outcomeId.toString(),
          price: centsToTicks(parseFloat(limitPrice)).toString(),
          size: ethers.utils.parseUnits(amount || '0', 18).toString(),
          side: true // true = buy
        };

        const order = createOrderWithDefaults(orderData);
        const validation = validateOrder(order);
        
        if (!validation.valid) {
          toast.error(validation.error);
          setIsTrading(false);
          return;
        }

        const signature = await signOrder(order, chainId, EXCHANGE_CONTRACT, signer);

        const response = await fetch(`${API_BASE}/api/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order, signature, isMarketOrder: false })
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to place limit order');
        }

        if (result.status === 'matched') {
          toast.success('Order matched! Settling on-chain...');
        } else {
          toast.success(`Limit order placed at ${limitPrice}¢!`);
        }

        setAmount('');
        setLimitPrice('');
        
        // Record price after trade (non-blocking)
        recordPriceAfterTrade();
        fetchData();
      } else {
        // Market order
        if (!signer || !buyShares) {
          toast.error('Please connect your wallet');
          setIsTrading(false);
          return;
        }

        const outcomeId = outcome === 'yes' ? 0 : 1;
        const currentPrice = outcome === 'yes' ? market.yesPrice : market.noPrice;
        
        const orderData = {
          maker: account,
          marketId: id.toString(),
          outcomeId: outcomeId.toString(),
          price: centsToTicks(currentPrice).toString(),
          size: ethers.utils.parseUnits(amount || '0', 18).toString(),
          side: true
        };

        const order = createOrderWithDefaults(orderData);
        const signature = await signOrder(order, chainId, EXCHANGE_CONTRACT, signer);

        const response = await fetch(`${API_BASE}/api/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order, signature, isMarketOrder: true })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to place market order' }));
          throw new Error(errorData.error || 'Failed to place market order');
        }

        const result = await response.json();

        if (result.status === 'matched' && result.matches && result.matches.length > 0) {
          toast.success('Order matched! Settling on-chain...');
        } else if (result.status === 'partial') {
          toast.success('Order partially filled!');
        } else {
          // Fallback to AMM (pass human-readable ETH amount; hook handles conversion)
          const tx = await buyShares(id, outcome === 'yes', amount);
          toast.success(`Bought ${outcome.toUpperCase()} shares via AMM!`);
        }

        setAmount('');
        
        // Record price after trade (non-blocking)
        recordPriceAfterTrade();
        fetchData();
      }
    } catch (error) {
      console.error('Buy error:', error);
      toast.error(error.message || 'Transaction failed');
    } finally {
      setIsTrading(false);
    }
  };

  const handleSell = async () => {
    const availableShares = outcome === 'yes' ? position.yesShares : position.noShares;
    
    if (parseFloat(amount) > parseFloat(availableShares)) {
      toast.error(`Insufficient ${outcome.toUpperCase()} shares`);
      return;
    }

    setIsTrading(true);

    try {
      if (orderType === 'limit') {
        // Place limit sell order
        if (!limitPrice || parseFloat(limitPrice) <= 0 || parseFloat(limitPrice) > 100) {
          toast.error('Please enter a valid limit price (0.01-1.00)');
          setIsTrading(false);
          return;
        }

        if (!signer) {
          toast.error('Please connect your wallet');
          setIsTrading(false);
          return;
        }

        const outcomeId = outcome === 'yes' ? 0 : 1;
        const orderData = {
          maker: account,
          marketId: id.toString(),
          outcomeId: outcomeId.toString(),
          price: centsToTicks(parseFloat(limitPrice)).toString(),
          size: ethers.utils.parseUnits(amount || '0', 18).toString(),
          side: false // false = sell
        };

        const order = createOrderWithDefaults(orderData);
        const validation = validateOrder(order);
        
        if (!validation.valid) {
          toast.error(validation.error);
          setIsTrading(false);
          return;
        }

        const signature = await signOrder(order, chainId, EXCHANGE_CONTRACT, signer);

        const response = await fetch(`${API_BASE}/api/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order, signature, isMarketOrder: false })
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to place limit sell order');
        }

        if (result.status === 'matched') {
          toast.success('Order matched! Settling on-chain...');
        } else {
          toast.success(`Limit sell order placed at ${limitPrice}¢!`);
        }

        setAmount('');
        setLimitPrice('');
        
        // Record price after trade (non-blocking)
        recordPriceAfterTrade();
        fetchData();
      } else {
        // Market sell order
        if (!signer || !sellShares) {
          toast.error('Please connect your wallet');
          setIsTrading(false);
          return;
        }

        const outcomeId = outcome === 'yes' ? 0 : 1;
        const currentPrice = outcome === 'yes' ? market.yesPrice : market.noPrice;
        
        const orderData = {
          maker: account,
          marketId: id.toString(),
          outcomeId: outcomeId.toString(),
          price: centsToTicks(currentPrice).toString(),
          size: ethers.utils.parseUnits(amount || '0', 18).toString(),
          side: false
        };

        const order = createOrderWithDefaults(orderData);
        const signature = await signOrder(order, chainId, EXCHANGE_CONTRACT, signer);

        const response = await fetch(`${API_BASE}/api/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order, signature, isMarketOrder: true })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to place market sell order' }));
          throw new Error(errorData.error || 'Failed to place market sell order');
        }

        const result = await response.json();

        if (result.status === 'matched' && result.matches && result.matches.length > 0) {
          toast.success('Order matched! Settling on-chain...');
        } else if (result.status === 'partial') {
          toast.success('Order partially filled!');
        } else {
          // Fallback to AMM
          const amountWei = ethers.utils.parseUnits(amount, 18);
          const tx = await sellShares(id, outcome === 'yes', amountWei);
          await tx.wait();
          toast.success(`Sold ${outcome.toUpperCase()} shares via AMM!`);
        }

        setAmount('');
        
        // Record price after trade (non-blocking)
        recordPriceAfterTrade();
        fetchData();
      }
    } catch (error) {
      console.error('Sell error:', error);
      toast.error(error.message || 'Transaction failed');
    } finally {
      setIsTrading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0E0E0E] flex items-center justify-center" style={{ fontFamily: 'gilroy, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="min-h-screen bg-[#0E0E0E] flex items-center justify-center" style={{ fontFamily: 'gilroy, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <div className="text-center bg-white/[0.08] backdrop-blur-xl rounded-[24px] p-8 border border-white/20 shadow-lg">
          <p className="text-white text-xl mb-4 font-space-grotesk">Market not found</p>
          <button
            onClick={() => history.push('/')}
            className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full font-bold transition-all backdrop-blur-md border border-white/20 font-space-grotesk"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const potentialWin = amount ? (parseFloat(amount) / (market[`${outcome}Price`] / 100)).toFixed(2) : '0';
  
  // Check if market has ended
  const isMarketEnded = market.endTime && new Date(market.endTime) <= new Date();

  return (
    <div className="min-h-screen bg-[#0E0E0E]" style={{ fontFamily: 'gilroy, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <WormStyleNavbar />
      
      <div className="max-w-7xl mx-auto px-4 pt-24 pb-12">
        {/* Full Width Title Section at Top */}
        <div className="mb-8">
          {/* Creator Info */}
          <div className="flex items-center justify-between bg-white/[0.08] backdrop-blur-xl rounded-[16px] p-4 border border-white/20 shadow-lg mb-4">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span className="font-space-grotesk">Creator:</span>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 backdrop-blur-md rounded-lg border border-white/10 text-white hover:text-gray-300 transition-colors cursor-pointer">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                <span className="font-space-grotesk font-medium">@{market.creator.slice(2, 8)}</span>
              </div>
            </div>
            <button className="p-2 hover:bg-white/15 rounded-lg transition-colors backdrop-blur-md">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </button>
          </div>

          {/* Market Countdown */}
          <div className="flex justify-center mb-4">
            <MarketCountdown 
              endTime={market.endTime} 
              variant="detail"
              showLabel={true}
            />
          </div>

          {/* Full Width Question/Title */}
          <div className="bg-white/[0.08] backdrop-blur-xl rounded-[24px] p-6 sm:p-8 border border-white/20 shadow-lg mb-8">
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-white leading-tight font-space-grotesk break-words text-center">
              {market.question}
            </h1>
          </div>

          {/* Trading Interface - Full Width Below Title */}
          <div className="bg-white/[0.08] backdrop-blur-xl rounded-[24px] p-6 border border-white/20 shadow-lg">
            {isMarketEnded ? (
              /* Market Ended Message */
              <div className="text-center py-12">
                <div className="mb-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-500/30 mb-4">
                    <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-white mb-2 font-space-grotesk">Market Has Ended</h3>
                <p className="text-gray-400 text-sm font-space-grotesk mb-6">
                  Trading is no longer available for this market. Awaiting resolution.
                </p>
                <div className="bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm font-space-grotesk">Final Prices</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-white font-semibold font-space-grotesk">Yes</span>
                    </div>
                    <span className="text-white font-bold text-lg font-space-grotesk">{market.yesPrice}%</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <span className="text-white font-semibold font-space-grotesk">No</span>
                    </div>
                    <span className="text-white font-bold text-lg font-space-grotesk">{market.noPrice}%</span>
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
        </div>

        <div className="grid grid-cols-1 gap-8 mt-8">
          {/* Full Width Market Info */}
          <div className="space-y-6">
            {/* Market Image */}
            <div className="relative rounded-[24px] overflow-hidden border border-white/20 shadow-lg" style={{ height: '300px' }}>
              <img
                src={getMarketImage(market, id)}
                alt={market.question}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
            </div>

            {/* Chart Section */}
            <PolymarketChart
              yesPriceHistory={yesPriceHistory}
              noPriceHistory={noPriceHistory}
              priceHistory={priceHistory}
              currentYesPrice={market?.yesPrice || 50}
              currentNoPrice={market?.noPrice || 50}
              height={300}
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

            {/* Tabs */}
            <div className="bg-white/[0.08] backdrop-blur-xl rounded-[24px] border border-white/20 shadow-lg overflow-hidden">
              <div className="flex gap-0 border-b border-white/10">
                {['market', 'rules', 'holders'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-4 text-sm font-semibold capitalize transition-all font-space-grotesk ${
                      activeTab === tab
                        ? 'text-white bg-white/10'
                        : 'text-gray-400 hover:text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    {tab === 'holders' ? 'Top Holders' : tab}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {activeTab === 'market' && (
                  <div className="space-y-6">
                    {/* Market Info Card */}
                    <div className="bg-white/10 backdrop-blur-lg rounded-[20px] p-6 border border-white/15">
                      <p className="text-gray-300 text-sm mb-4 font-space-grotesk">
                        This market was created on DegenPoly. Create a market yourself!
                      </p>
                      <div className="space-y-3 mb-6">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-purple-600/80 backdrop-blur-md flex items-center justify-center text-white text-xs font-bold flex-shrink-0 border border-purple-400/30">
                            1
                          </div>
                          <p className="text-white text-sm font-space-grotesk">Connect your wallet</p>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-purple-600/80 backdrop-blur-md flex items-center justify-center text-white text-xs font-bold flex-shrink-0 border border-purple-400/30">
                            2
                          </div>
                          <p className="text-white text-sm font-space-grotesk">Create your prediction market</p>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-purple-600/80 backdrop-blur-md flex items-center justify-center text-white text-xs font-bold flex-shrink-0 border border-purple-400/30">
                            3
                          </div>
                          <p className="text-white text-sm font-space-grotesk">Share your market-link and earn!</p>
                        </div>
                      </div>
                      <button
                        onClick={() => history.push('/admin/create-market')}
                        className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-full font-bold transition-all backdrop-blur-md border border-white/20 font-space-grotesk"
                      >
                        Create Market
                      </button>
                    </div>

                    {/* Comments Section */}
                    <div className="bg-white/10 backdrop-blur-lg rounded-[20px] p-6 border border-white/15">
                      <div className="flex gap-3 mb-4">
                        <input
                          type="text"
                          placeholder="Add a comment"
                          className="flex-1 bg-white/5 text-white px-4 py-3 rounded-full border border-white/10 focus:border-white/30 focus:outline-none placeholder:text-gray-500 backdrop-blur-md font-space-grotesk"
                        />
                        <button
                          disabled
                          className="px-6 py-3 bg-white/5 text-gray-500 rounded-full font-bold cursor-not-allowed backdrop-blur-md border border-white/10 font-space-grotesk"
                        >
                          Post
                        </button>
                      </div>
                      <div className="text-center py-8 text-gray-500 font-space-grotesk">
                        Be the first to comment!
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'rules' && (
                  <div className="bg-white/10 backdrop-blur-lg rounded-[20px] p-6 border border-white/15">
                    <h3 className="text-xl font-bold text-white mb-4 font-space-grotesk">Market Rules</h3>
                    <div className="space-y-4 text-gray-300">
                      <p className="font-space-grotesk">This market will resolve based on verifiable information and predetermined criteria.</p>
                      <div>
                        <h4 className="font-semibold text-white mb-2 font-space-grotesk">Resolution Criteria:</h4>
                        <ul className="list-disc list-inside space-y-2 text-sm font-space-grotesk">
                          <li>The outcome must be verifiable through official sources</li>
                          <li>Resolution will occur after the event date has passed</li>
                          <li>In case of ambiguity, the market creator's interpretation will be final</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'holders' && (
                  <div className="bg-white/10 backdrop-blur-lg rounded-[20px] p-6 border border-white/15">
                    <h3 className="text-xl font-bold text-white mb-4 font-space-grotesk">Top Holders</h3>
                    <div className="text-center py-8 text-gray-500 font-space-grotesk">
                      No positions yet. Be the first to trade!
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/20 mt-20 bg-white/[0.05] backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex gap-6 text-sm">
              <button className="text-gray-400 hover:text-white transition-colors font-medium font-space-grotesk">
                Terms of Service
              </button>
              <button className="text-gray-400 hover:text-white transition-colors font-medium font-space-grotesk">
                Privacy Policy
              </button>
            </div>
            
            <button className="text-gray-400 hover:text-white transition-colors text-sm font-medium font-space-grotesk">
              How it Works?
            </button>
            
            <div className="flex gap-4">
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-white transition-colors hover:bg-white/10 rounded-lg backdrop-blur-md">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <a href="https://discord.com" target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-white transition-colors hover:bg-white/10 rounded-lg backdrop-blur-md">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              </a>
              <a href="https://telegram.org" target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-white transition-colors hover:bg-white/10 rounded-lg backdrop-blur-md">
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

export default MarketDetailWormStyle;

