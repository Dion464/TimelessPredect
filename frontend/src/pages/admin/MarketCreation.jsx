import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useWeb3 } from '../../hooks/useWeb3';
import { useAuth } from '../../helpers/AuthContent';
import toast from 'react-hot-toast';

const MarketCreation = () => {
  const history = useHistory();
  const { createMarket, isConnected, connectWallet, provider } = useWeb3();
  const { isLoggedIn } = useAuth();
  
  const [formData, setFormData] = useState({
    question: '',
    description: '',
    category: 'general',
    endDate: '',
    endTime: '',
    resolutionDate: '',
    resolutionTime: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [estimatedFee, setEstimatedFee] = useState('0.001');

  const handleLogout = () => {
    localStorage.removeItem('isAdminLoggedIn');
    localStorage.removeItem('usertype');
    localStorage.removeItem('username');
    toast.success('Logged out successfully');
    history.push('/admin');
  };

  const categories = [
    { value: 'general', label: 'General' },
    { value: 'sports', label: 'Sports' },
    { value: 'politics', label: 'Politics' },
    { value: 'crypto', label: 'Crypto' },
    { value: 'entertainment', label: 'Entertainment' },
    { value: 'technology', label: 'Technology' },
    { value: 'economics', label: 'Economics' },
    { value: 'science', label: 'Science' }
  ];

  // Check admin access
  const isAdminLoggedIn = localStorage.getItem('isAdminLoggedIn') === 'true';
  const usertype = localStorage.getItem('usertype');
  
  // Check admin access - redirect to admin login if not authenticated
  React.useEffect(() => {
    if (!isAdminLoggedIn || usertype !== 'admin') {
      history.push('/admin');
    }
  }, [history, isAdminLoggedIn, usertype]);
  
  if (!isAdminLoggedIn || usertype !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Redirecting...</h2>
          <p className="text-gray-600 mb-6">Please wait while we redirect you to the admin login.</p>
        </div>
      </div>
    );
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const calculateTimestamps = () => {
    // Use UTC to avoid timezone issues
    const endDateTime = new Date(`${formData.endDate}T${formData.endTime}:00`);
    const resolutionDateTime = new Date(`${formData.resolutionDate}T${formData.resolutionTime}:00`);
    
    // Validate dates are valid
    if (isNaN(endDateTime.getTime())) {
      throw new Error('Invalid end date/time format');
    }
    if (isNaN(resolutionDateTime.getTime())) {
      throw new Error('Invalid resolution date/time format');
    }
    
    return {
      endTime: Math.floor(endDateTime.getTime() / 1000),
      resolutionTime: Math.floor(resolutionDateTime.getTime() / 1000)
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isConnected) {
      toast.error('Please connect your wallet first');
      return;
    }

    // Validation
    if (!formData.question.trim()) {
      toast.error('Question is required');
      return;
    }

    if (!formData.endDate || !formData.endTime || !formData.resolutionDate || !formData.resolutionTime) {
      toast.error('Please fill in all date and time fields');
      return;
    }

    let endTime, resolutionTime;
    try {
      const timestamps = calculateTimestamps();
      endTime = timestamps.endTime;
      resolutionTime = timestamps.resolutionTime;
    } catch (error) {
      toast.error(error.message || 'Invalid date/time format');
      return;
    }

    // Get current blockchain time instead of browser time
    let blockchainTime;
    try {
      if (provider) {
        const block = await provider.getBlock('latest');
        blockchainTime = block.timestamp;
      } else {
        // Fallback to browser time if no provider
        blockchainTime = Math.floor(Date.now() / 1000);
      }
    } catch (error) {
      console.warn('Could not get blockchain time, using browser time:', error);
      blockchainTime = Math.floor(Date.now() / 1000);
    }

    // Add 2 minute buffer to account for transaction processing time
    const minEndTime = blockchainTime + 120; // 2 minutes buffer
    const minResolutionTime = blockchainTime + 180; // 3 minutes minimum

    // Additional validation with detailed logging
    console.log('📅 Date Validation:');
    console.log('  End date/time:', formData.endDate, formData.endTime);
    console.log('  Resolution date/time:', formData.resolutionDate, formData.resolutionTime);
    console.log('  End timestamp:', endTime, new Date(endTime * 1000).toLocaleString());
    console.log('  Resolution timestamp:', resolutionTime, new Date(resolutionTime * 1000).toLocaleString());
    console.log('  Blockchain timestamp:', blockchainTime, new Date(blockchainTime * 1000).toLocaleString());
    console.log('  Minimum end time (with buffer):', minEndTime, new Date(minEndTime * 1000).toLocaleString());
    console.log('  End time is future:', endTime > minEndTime);
    console.log('  Resolution after end:', resolutionTime > endTime);

    if (endTime <= minEndTime) {
      const secondsUntilEnd = endTime - minEndTime;
      toast.error(`End time must be at least 2 minutes in the future. Please select a later date/time.`);
      console.error(`End time ${endTime} is not at least 2 minutes after blockchain time ${minEndTime}`);
      return;
    }

    if (resolutionTime <= endTime) {
      const secondsBetween = endTime - resolutionTime;
      toast.error(`Resolution time must be after end time. (Currently ${-secondsBetween} seconds before end)`);
      return;
    }

    // Validate timestamps are valid numbers
    if (isNaN(endTime) || isNaN(resolutionTime)) {
      toast.error('Invalid date/time format. Please check your input.');
      return;
    }

    setIsLoading(true);

    try {
      toast.loading('Creating market...');
      
      console.log('🚀 Attempting to create market with:');
      console.log('  Question:', formData.question);
      console.log('  Category:', formData.category);
      console.log('  End time:', endTime, new Date(endTime * 1000).toLocaleString());
      console.log('  Resolution time:', resolutionTime, new Date(resolutionTime * 1000).toLocaleString());
      
      const receipt = await createMarket(
        formData.question,
        formData.description || '',
        formData.category,
        endTime,
        resolutionTime
      );

      toast.success('Market created successfully!');
      
      // Reset form
      setFormData({
        question: '',
        description: '',
        category: 'general',
        endDate: '',
        endTime: '',
        resolutionDate: '',
        resolutionTime: ''
      });

      // Redirect to markets or new market
      // The new market ID would be in the events
      history.push('/markets');
    } catch (error) {
      console.error('❌ Error creating market:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        data: error.data,
        reason: error.reason
      });
      
      // Show user-friendly error message
      const errorMessage = error.message || 'Failed to create market';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
      toast.dismiss();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-display-sm font-semibold text-gray-900 mb-2">Create New Market</h1>
            <p className="text-lg text-gray-600">Create a prediction market for users to trade on</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-gray-600 hover:text-gray-900 text-sm font-medium flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Logout</span>
          </button>
        </div>

        {/* Wallet Connection Banner */}
        {!isConnected && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-6 h-6 text-yellow-600 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-yellow-800 font-medium">Connect your wallet to create markets</p>
            </div>
            <button
              onClick={connectWallet}
              className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors font-medium text-sm"
            >
              Connect Wallet
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="p-6 space-y-6">
            {/* Question */}
            <div>
              <label htmlFor="question" className="block text-sm font-medium text-gray-700 mb-2">
                Market Question <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="question"
                name="question"
                value={formData.question}
                onChange={handleInputChange}
                placeholder="e.g., Will Bitcoin reach $100k by end of 2024?"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                required
              />
              <p className="mt-1 text-sm text-gray-500">Make the question clear and specific</p>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows="4"
                placeholder="Provide additional context about the market..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
              />
            </div>

            {/* Category */}
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                {categories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            {/* End Date & Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-2">
                  End Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="endDate"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleInputChange}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  required
                />
              </div>
              <div>
                <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 mb-2">
                  End Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  id="endTime"
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  required
                />
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>End Time:</strong> No new trades can be placed after this time
              </p>
            </div>

            {/* Resolution Date & Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="resolutionDate" className="block text-sm font-medium text-gray-700 mb-2">
                  Resolution Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="resolutionDate"
                  name="resolutionDate"
                  value={formData.resolutionDate}
                  onChange={handleInputChange}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  required
                />
              </div>
              <div>
                <label htmlFor="resolutionTime" className="block text-sm font-medium text-gray-700 mb-2">
                  Resolution Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  id="resolutionTime"
                  name="resolutionTime"
                  value={formData.resolutionTime}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  required
                />
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <p className="text-sm text-purple-800">
                <strong>Resolution Time:</strong> The market must be resolved by this time
              </p>
            </div>

            {/* Estimated Fee */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Estimated Creation Fee</p>
                  <p className="text-xs text-gray-500">In ETH</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">{estimatedFee}</p>
                  <p className="text-xs text-gray-500">ETH</p>
                </div>
              </div>
            </div>
          </div>

          {/* Form Footer */}
          <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
            <button
              type="button"
              onClick={() => history.push('/markets')}
              className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isConnected || isLoading}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating...' : 'Create Market'}
            </button>
          </div>
        </form>

        {/* Info Section */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Market Creation Guidelines
          </h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Questions should be specific, measurable, and unambiguous</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Choose appropriate dates to allow sufficient trading activity</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Ensure you have sufficient ETH to cover the creation fee</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Markets become active immediately after creation</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default MarketCreation;

