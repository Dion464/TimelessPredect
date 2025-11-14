import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import WormStyleNavbar from '../../components/modern/WormStyleNavbar';
import { useWeb3 } from '../../hooks/useWeb3';
import toast from 'react-hot-toast';
import { showGlassToast } from '../../utils/toastUtils';

const CreateMarket = () => {
  const history = useHistory();
  const { account, isConnected } = useWeb3();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    question: '',
    description: '',
    category: 'General',
    imageUrl: '',
    endDate: '',
    endTime: '23:59',
    resolutionDate: '',
    resolutionTime: '23:59',
    rules: []
  });

  const [currentRule, setCurrentRule] = useState('');

  const clashFont = {
    fontFamily: 'Clash Grotesk Variable, -apple-system, BlinkMacSystemFont, sans-serif'
  };

  const categories = [
    'General',
    'Technology',
    'Crypto',
    'Sports',
    'Politics',
    'Entertainment',
    'Economics',
    'Science'
  ];

  const handleAddRule = () => {
    if (currentRule.trim()) {
      setFormData(prev => ({
        ...prev,
        rules: [...prev.rules, currentRule.trim()]
      }));
      setCurrentRule('');
    }
  };

  const handleRemoveRule = (index) => {
    setFormData(prev => ({
      ...prev,
      rules: prev.rules.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isConnected) {
      showGlassToast('Please connect your wallet to submit a market', '⚠️', 'warning');
      return;
    }

    // Validation
    if (!formData.question.trim()) {
      showGlassToast('Please enter a question', '⚠️', 'warning');
      return;
    }

    if (!formData.endDate || !formData.resolutionDate) {
      showGlassToast('Please set end date and resolution date', '⚠️', 'warning');
      return;
    }

    const endTime = new Date(`${formData.endDate}T${formData.endTime}`);
    const resolutionTime = new Date(`${formData.resolutionDate}T${formData.resolutionTime}`);
    const now = new Date();

    if (endTime <= now) {
      showGlassToast('End date must be in the future', '⚠️', 'warning');
      return;
    }

    if (resolutionTime <= endTime) {
      showGlassToast('Resolution date must be after end date', '⚠️', 'warning');
      return;
    }

    setIsSubmitting(true);

    try {
      const apiBaseUrl = window.location.origin;
      const response = await fetch(`${apiBaseUrl}/api/pending-markets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question: formData.question.trim(),
          description: formData.description.trim() || null,
          category: formData.category,
          imageUrl: formData.imageUrl.trim() || null,
          endTime: endTime.toISOString(),
          resolutionTime: resolutionTime.toISOString(),
          rules: formData.rules.length > 0 ? formData.rules : null,
          creator: account.toLowerCase()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit market');
      }

      showGlassToast('Market submitted for approval! 🎉', '✅', 'success');
      
      // Reset form
      setFormData({
        question: '',
        description: '',
        category: 'General',
        imageUrl: '',
        endDate: '',
        endTime: '23:59',
        resolutionDate: '',
        resolutionTime: '23:59',
        rules: []
      });

      // Redirect to home after 2 seconds
      setTimeout(() => {
        history.push('/');
      }, 2000);

    } catch (error) {
      console.error('Error submitting market:', error);
      showGlassToast(error.message || 'Failed to submit market', '❌', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0E0E0E]" style={clashFont}>
      <WormStyleNavbar />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
        <div className="glass-card rounded-[24px] p-8" style={{
          background: 'linear-gradient(180deg, rgba(15,15,15,0.92) 0%, rgba(8,8,8,0.78) 100%)',
          backdropFilter: 'blur(32px)'
        }}>
          <h1 className="text-3xl font-bold text-white mb-2">Create Market</h1>
          <p className="text-gray-400 mb-8">
            Submit a prediction market for admin approval. Once approved, it will be deployed on-chain.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Question */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Question *
              </label>
              <input
                type="text"
                value={formData.question}
                onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                placeholder="Will Bitcoin reach $100,000 by end of 2025?"
                className="w-full px-4 py-3 rounded-[12px] glass-card text-white placeholder-gray-500"
                style={{
                  background: 'linear-gradient(180deg, rgba(32,32,32,0.92) 0%, rgba(14,14,14,0.68) 100%)',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Additional details about the market..."
                rows={4}
                className="w-full px-4 py-3 rounded-[12px] glass-card text-white placeholder-gray-500"
                style={{
                  background: 'linear-gradient(180deg, rgba(32,32,32,0.92) 0%, rgba(14,14,14,0.68) 100%)',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-3 rounded-[12px] glass-card text-white"
                style={{
                  background: 'linear-gradient(180deg, rgba(32,32,32,0.92) 0%, rgba(14,14,14,0.68) 100%)',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}
                required
              >
                {categories.map(cat => (
                  <option key={cat} value={cat} className="bg-[#1a1a1a]">{cat}</option>
                ))}
              </select>
            </div>

            {/* Image URL */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Image URL (optional)
              </label>
              <input
                type="url"
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                placeholder="https://example.com/image.jpg"
                className="w-full px-4 py-3 rounded-[12px] glass-card text-white placeholder-gray-500"
                style={{
                  background: 'linear-gradient(180deg, rgba(32,32,32,0.92) 0%, rgba(14,14,14,0.68) 100%)',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}
              />
            </div>

            {/* End Date & Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  End Date *
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-4 py-3 rounded-[12px] glass-card text-white"
                  style={{
                    background: 'linear-gradient(180deg, rgba(32,32,32,0.92) 0%, rgba(14,14,14,0.68) 100%)',
                    border: '1px solid rgba(255,255,255,0.05)'
                  }}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  End Time *
                </label>
                <input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  className="w-full px-4 py-3 rounded-[12px] glass-card text-white"
                  style={{
                    background: 'linear-gradient(180deg, rgba(32,32,32,0.92) 0%, rgba(14,14,14,0.68) 100%)',
                    border: '1px solid rgba(255,255,255,0.05)'
                  }}
                  required
                />
              </div>
            </div>

            {/* Resolution Date & Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Resolution Date *
                </label>
                <input
                  type="date"
                  value={formData.resolutionDate}
                  onChange={(e) => setFormData({ ...formData, resolutionDate: e.target.value })}
                  className="w-full px-4 py-3 rounded-[12px] glass-card text-white"
                  style={{
                    background: 'linear-gradient(180deg, rgba(32,32,32,0.92) 0%, rgba(14,14,14,0.68) 100%)',
                    border: '1px solid rgba(255,255,255,0.05)'
                  }}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Resolution Time *
                </label>
                <input
                  type="time"
                  value={formData.resolutionTime}
                  onChange={(e) => setFormData({ ...formData, resolutionTime: e.target.value })}
                  className="w-full px-4 py-3 rounded-[12px] glass-card text-white"
                  style={{
                    background: 'linear-gradient(180deg, rgba(32,32,32,0.92) 0%, rgba(14,14,14,0.68) 100%)',
                    border: '1px solid rgba(255,255,255,0.05)'
                  }}
                  required
                />
              </div>
            </div>

            {/* Rules */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Market Rules (optional)
              </label>
              <div className="space-y-2">
                {formData.rules.map((rule, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="flex-1 px-4 py-2 rounded-[12px] glass-card text-white text-sm"
                      style={{
                        background: 'linear-gradient(180deg, rgba(32,32,32,0.92) 0%, rgba(14,14,14,0.68) 100%)',
                        border: '1px solid rgba(255,255,255,0.05)'
                      }}>
                      {index + 1}. {rule}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveRule(index)}
                      className="px-3 py-2 rounded-[8px] text-red-400 hover:bg-red-500/10"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={currentRule}
                    onChange={(e) => setCurrentRule(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddRule();
                      }
                    }}
                    placeholder="Add a rule..."
                    className="flex-1 px-4 py-3 rounded-[12px] glass-card text-white placeholder-gray-500"
                    style={{
                      background: 'linear-gradient(180deg, rgba(32,32,32,0.92) 0%, rgba(14,14,14,0.68) 100%)',
                      border: '1px solid rgba(255,255,255,0.05)'
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddRule}
                    className="px-6 py-3 rounded-[12px] text-white"
                    style={{
                      background: 'linear-gradient(180deg, rgba(15,15,15,0.92) 0%, rgba(8,8,8,0.78) 100%)',
                      border: '1px solid #FFE600'
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => history.push('/')}
                className="flex-1 py-4 rounded-[12px] text-white font-medium"
                style={{
                  background: 'linear-gradient(180deg, rgba(32,32,32,0.92) 0%, rgba(14,14,14,0.68) 100%)',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !isConnected}
                className="flex-1 py-4 rounded-[12px] text-black font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: isConnected ? '#FFE600' : 'rgba(255,230,0,0.3)',
                  border: '1px solid #FFE600'
                }}
              >
                {isSubmitting ? 'Submitting...' : isConnected ? 'Submit for Approval' : 'Connect Wallet'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateMarket;

