import React, { useState, useEffect } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import useMarketData from '../../hooks/useMarketData';
import useWallet from '../../hooks/useWallet';
import AdvancedTradingInterface from '../../components/trading/AdvancedTradingInterface';
import PriceChart from '../../components/charts/PriceChart';

const MarketDetail = () => {
  const { id } = useParams();
  const history = useHistory();
  const [activeTab, setActiveTab] = useState('trade');

  const { 
    getMarket, 
    getPriceHistory, 
    loading, 
    error 
  } = useMarketData();

  const { isConnected, account } = useWallet();

  const market = getMarket(id);
  const priceHistory = getPriceHistory(parseInt(id));

  useEffect(() => {
    if (!loading && !market) {
      // Redirect to markets page if market not found
      history.push('/markets');
    }
  }, [market, loading, history]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading market data...</p>
        </div>
      </div>
    );
  }

  if (error || !market) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Market Not Found</h1>
          <p className="text-gray-600 mb-4">The market you're looking for doesn't exist.</p>
          <button
            onClick={() => history.push('/markets')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Back to Markets
          </button>
        </div>
      </div>
    );
  }

  const yesPrice = Math.round(market.currentProbability * 100);
  const noPrice = 100 - yesPrice;

  const getCategoryColor = (category) => {
    const colors = {
      'Technology': 'bg-blue-500',
      'Sports': 'bg-green-500',
      'Politics': 'bg-red-500',
      'Entertainment': 'bg-purple-500',
      'Economics': 'bg-yellow-500',
      'Science': 'bg-indigo-500',
      'default': 'bg-gray-500'
    };
    return colors[category] || colors.default;
  };

  const getTimeRemaining = (resolutionDate) => {
    if (!resolutionDate) return 'No end date';
    const now = new Date();
    const end = new Date(resolutionDate);
    const diff = end - now;
    
    if (diff <= 0) return 'Ended';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h remaining`;
    return `${hours}h remaining`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => history.goBack()}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-3">
                <span className={`px-3 py-1 rounded-full text-sm font-medium text-white ${getCategoryColor(market.category)}`}>
                  {market.category || 'General'}
                </span>
                <span className="text-sm text-gray-500">
                  {getTimeRemaining(market.resolutionDateTime)}
                </span>
              </div>
              
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                {market.questionTitle}
              </h1>

              {/* Current Prices */}
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                  <span className="text-lg font-medium text-gray-700">{market.yesLabel || 'Yes'}</span>
                  <span className="text-2xl font-bold text-green-600">{yesPrice}¢</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                  <span className="text-lg font-medium text-gray-700">{market.noLabel || 'No'}</span>
                  <span className="text-2xl font-bold text-red-600">{noPrice}¢</span>
                </div>
              </div>
            </div>

            {/* Market Stats */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 ml-8">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    ${market.totalVolume?.toLocaleString() || 0}
                  </div>
                  <div className="text-sm text-gray-600">Volume</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    {market.totalBets?.toLocaleString() || 0}
                  </div>
                  <div className="text-sm text-gray-600">Traders</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'trade', label: 'Trade' },
              { id: 'chart', label: 'Chart' },
              { id: 'about', label: 'About' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {activeTab === 'trade' && (
              <div>
                <PriceChart 
                  priceHistory={priceHistory} 
                  marketId={parseInt(id)}
                  height={400}
                />
              </div>
            )}

            {activeTab === 'chart' && (
              <div>
                <PriceChart 
                  priceHistory={priceHistory} 
                  marketId={parseInt(id)}
                  height={500}
                />
                
                {/* Additional chart controls could go here */}
                <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Market Activity</h3>
                  <div className="text-sm text-gray-600">
                    <p>Real-time price updates and trading activity will be displayed here.</p>
                    <p className="mt-2">Features coming soon:</p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Volume indicators</li>
                      <li>Technical analysis tools</li>
                      <li>Historical volatility</li>
                      <li>Market depth visualization</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'about' && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">About This Market</h3>
                <div className="space-y-4 text-gray-700">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Question</h4>
                    <p>{market.questionTitle}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Resolution Criteria</h4>
                    <p>This market will resolve based on official sources and predetermined criteria. 
                    The resolution date is {new Date(market.resolutionDateTime).toLocaleDateString()}.</p>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Market Details</h4>
                    <ul className="space-y-2">
                      <li><strong>Category:</strong> {market.category}</li>
                      <li><strong>Created:</strong> {new Date().toLocaleDateString()}</li>
                      <li><strong>Resolution:</strong> {new Date(market.resolutionDateTime).toLocaleDateString()}</li>
                      <li><strong>Total Volume:</strong> ${market.totalVolume?.toLocaleString() || 0}</li>
                      <li><strong>Total Traders:</strong> {market.totalBets?.toLocaleString() || 0}</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">How It Works</h4>
                    <p>Prediction markets allow you to trade on the outcome of future events. 
                    Prices represent the market's collective belief about the probability of an outcome.</p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Buy "Yes" shares if you think the event will happen</li>
                      <li>Buy "No" shares if you think it won't happen</li>
                      <li>Shares pay out $1.00 if you're correct, $0.00 if you're wrong</li>
                      <li>You can sell your shares anytime before resolution</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Trading Sidebar */}
          <div className="lg:col-span-1">
            <AdvancedTradingInterface marketId={parseInt(id)} market={market} />

            {/* Wallet Status */}
            {!isConnected && (
              <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <h4 className="text-sm font-medium text-yellow-800">Connect Your Wallet</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      Connect your wallet to start trading on this market.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Market Info */}
            <div className="mt-6 bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Market Information</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Market ID:</span>
                  <span className="text-gray-900">#{market.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className="text-green-600 font-medium">Active</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Fee:</span>
                  <span className="text-gray-900">2%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Min Bet:</span>
                  <span className="text-gray-900">$1.00</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketDetail;
