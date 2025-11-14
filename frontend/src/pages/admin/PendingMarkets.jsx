import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { useWeb3 } from '../../hooks/useWeb3';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../../contracts/eth-config';
import { showGlassToast, showTransactionToast } from '../../utils/toastUtils';

const ADMIN_ADDRESSES = [
  '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', // Hardhat account #0
  // Add more admin addresses here
].map(addr => addr.toLowerCase());

const PendingMarkets = () => {
  const history = useHistory();
  const { account, isConnected, signer } = useWeb3();
  const [pendingMarkets, setPendingMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING'); // PENDING, APPROVED, REJECTED, ALL
  const [processingId, setProcessingId] = useState(null);

  const clashFont = {
    fontFamily: 'Clash Grotesk Variable, -apple-system, BlinkMacSystemFont, sans-serif'
  };

  // Check if user is admin
  const isAdmin = isConnected && account && ADMIN_ADDRESSES.includes(account.toLowerCase());

  useEffect(() => {
    if (!isConnected) {
      history.push('/admin');
      return;
    }

    if (!isAdmin) {
      showGlassToast('Access denied. Admin only.', '🚫', 'error');
      history.push('/');
      return;
    }

    fetchPendingMarkets();
  }, [isConnected, isAdmin, filter]);

  const fetchPendingMarkets = async () => {
    try {
      setLoading(true);
      const apiBaseUrl = window.location.origin;
      const url = filter === 'ALL' 
        ? `${apiBaseUrl}/api/pending-markets`
        : `${apiBaseUrl}/api/pending-markets?status=${filter}`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setPendingMarkets(data.pendingMarkets);
      }
    } catch (error) {
      console.error('Error fetching pending markets:', error);
      showGlassToast('Failed to fetch pending markets', '❌', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (pendingMarket) => {
    if (!signer) {
      showGlassToast('Please connect your wallet', '⚠️', 'warning');
      return;
    }

    setProcessingId(pendingMarket.id);

    try {
      // Create market on-chain
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      
      const endTime = Math.floor(new Date(pendingMarket.endTime).getTime() / 1000);
      const resolutionTime = Math.floor(new Date(pendingMarket.resolutionTime).getTime() / 1000);
      
      showGlassToast('Creating market on-chain...', '⏳', 'info');
      
      const tx = await contract.createMarket(
        pendingMarket.question,
        pendingMarket.description || '',
        pendingMarket.category,
        endTime,
        resolutionTime,
        { value: ethers.utils.parseEther('0.01') } // Market creation fee
      );

      showGlassToast('Transaction submitted. Waiting for confirmation...', '⏳', 'info');
      const receipt = await tx.wait();

      // Get market ID from event
      const marketCreatedEvent = receipt.events?.find(e => e.event === 'MarketCreated');
      const marketId = marketCreatedEvent?.args?.marketId?.toString();

      if (!marketId) {
        throw new Error('Failed to get market ID from transaction');
      }

      showTransactionToast('Market created on-chain!', receipt.transactionHash, 'success');

      // Save image if exists
      if (pendingMarket.imageUrl) {
        try {
          await fetch(`${window.location.origin}/api/market-images`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              marketId: marketId,
              imageUrl: pendingMarket.imageUrl
            })
          });
        } catch (imgError) {
          console.error('Error saving image:', imgError);
        }
      }

      // Save rules if exists
      if (pendingMarket.rules && pendingMarket.rules.length > 0) {
        try {
          const rulesMap = JSON.parse(localStorage.getItem('marketRules') || '{}');
          rulesMap[marketId] = pendingMarket.rules;
          localStorage.setItem('marketRules', JSON.stringify(rulesMap));
        } catch (rulesError) {
          console.error('Error saving rules:', rulesError);
        }
      }

      // Update pending market status in database
      const apiBaseUrl = window.location.origin;
      await fetch(`${apiBaseUrl}/api/pending-markets/${pendingMarket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          approvedBy: account,
          marketId: marketId
        })
      });

      showGlassToast('Market approved and deployed! 🎉', '✅', 'success');
      fetchPendingMarkets();

    } catch (error) {
      console.error('Error approving market:', error);
      showGlassToast(error.message || 'Failed to approve market', '❌', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (pendingMarket) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    setProcessingId(pendingMarket.id);

    try {
      const apiBaseUrl = window.location.origin;
      const response = await fetch(`${apiBaseUrl}/api/pending-markets/${pendingMarket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          rejectionReason: reason
        })
      });

      const data = await response.json();

      if (data.success) {
        showGlassToast('Market rejected', '✅', 'success');
        fetchPendingMarkets();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error rejecting market:', error);
      showGlassToast('Failed to reject market', '❌', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  if (!isConnected || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0E0E0E]" style={clashFont}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Pending Markets</h1>
          <p className="text-gray-400">Review and approve market submissions</p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-6 py-2 rounded-[12px] font-medium transition-all ${
                filter === status
                  ? 'bg-[#FFE600] text-black'
                  : 'text-gray-400 hover:text-white'
              }`}
              style={filter !== status ? {
                background: 'linear-gradient(180deg, rgba(32,32,32,0.92) 0%, rgba(14,14,14,0.68) 100%)',
                border: '1px solid rgba(255,255,255,0.1)'
              } : {}}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Markets List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFE600] mx-auto mb-4"></div>
            <p className="text-gray-400">Loading markets...</p>
          </div>
        ) : pendingMarkets.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">No {filter.toLowerCase()} markets found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingMarkets.map(market => (
              <div
                key={market.id}
                className="glass-card rounded-[16px] p-6"
                style={{
                  background: 'linear-gradient(180deg, rgba(15,15,15,0.92) 0%, rgba(8,8,8,0.78) 100%)',
                  backdropFilter: 'blur(32px)'
                }}
              >
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Image */}
                  {market.imageUrl && (
                    <img
                      src={market.imageUrl}
                      alt={market.question}
                      className="w-full md:w-32 h-32 object-cover rounded-[12px]"
                    />
                  )}

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-xl font-bold text-white">{market.question}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        market.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' :
                        market.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {market.status}
                      </span>
                    </div>

                    {market.description && (
                      <p className="text-gray-400 text-sm mb-3">{market.description}</p>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
                      <div>
                        <span className="text-gray-500">Category:</span>
                        <span className="text-white ml-2">{market.category}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Creator:</span>
                        <span className="text-white ml-2">{market.creator.slice(0, 6)}...{market.creator.slice(-4)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">End Date:</span>
                        <span className="text-white ml-2">{new Date(market.endTime).toLocaleDateString()}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Resolution:</span>
                        <span className="text-white ml-2">{new Date(market.resolutionTime).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {market.rules && market.rules.length > 0 && (
                      <div className="mb-4">
                        <p className="text-gray-500 text-sm mb-2">Rules:</p>
                        <ul className="list-disc list-inside text-gray-400 text-sm space-y-1">
                          {market.rules.map((rule, idx) => (
                            <li key={idx}>{rule}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {market.rejectionReason && (
                      <div className="mb-4 p-3 rounded-[8px] bg-red-500/10 border border-red-500/20">
                        <p className="text-red-400 text-sm">
                          <strong>Rejection Reason:</strong> {market.rejectionReason}
                        </p>
                      </div>
                    )}

                    {market.status === 'APPROVED' && market.marketId && (
                      <div className="mb-4 p-3 rounded-[8px] bg-green-500/10 border border-green-500/20">
                        <p className="text-green-400 text-sm">
                          <strong>Market ID:</strong> {market.marketId.toString()}
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    {market.status === 'PENDING' && (
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleApprove(market)}
                          disabled={processingId === market.id}
                          className="px-6 py-2 rounded-[12px] bg-green-500 text-white font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {processingId === market.id ? 'Processing...' : 'Approve & Deploy'}
                        </button>
                        <button
                          onClick={() => handleReject(market)}
                          disabled={processingId === market.id}
                          className="px-6 py-2 rounded-[12px] bg-red-500 text-white font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PendingMarkets;

