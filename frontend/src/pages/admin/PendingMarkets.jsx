import React, { useState, useEffect, useMemo } from 'react';
import { useHistory } from 'react-router-dom';
import { useWeb3 } from '../../hooks/useWeb3';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI, BLOCK_EXPLORER_URL } from '../../contracts/eth-config';
import { showGlassToast, showTransactionToast } from '../../utils/toastUtils';
import WormStyleNavbar from '../../components/modern/WormStyleNavbar';

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

  const explorerBase = (BLOCK_EXPLORER_URL || 'https://explorer.incentiv.io/').replace(/\/?$/, '/');

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

  const statusOptions = ['PENDING', 'APPROVED', 'REJECTED', 'ALL'];
  const summary = useMemo(() => (
    statusOptions.map(status => ({
      status,
      count:
        status === 'ALL'
          ? pendingMarkets.length
          : pendingMarkets.filter(pm => pm.status === status).length
    }))
  ), [pendingMarkets]);

  return (
    <div className="min-h-screen bg-[#050505]" style={clashFont}>
      <WormStyleNavbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12 space-y-8">
        <div className="glass-card rounded-[24px] border border-white/10 bg-white/5 px-6 sm:px-8 py-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/60 mb-2">Admin Console</p>
              <h1 className="text-3xl sm:text-4xl font-semibold text-white mb-3">Community Market Submissions</h1>
              <p className="text-gray-300 max-w-2xl">Review user-created markets, verify their rule sets, and push the best ones on-chain. Each submission includes a 1&nbsp;TCENT bond to discourage spam.</p>
            </div>
            <button
              onClick={() => history.push('/admin/resolve')}
              className="px-5 py-2.5 rounded-full border border-white/10 bg-white/5 text-sm font-medium text-white hover:text-black hover:bg-white/90 transition-all"
            >
              Go to Resolution Desk
            </button>
          </div>
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {summary.map(item => (
              <div key={item.status} className="rounded-[16px] border border-white/10 bg-white/5 px-4 py-3 text-center">
                <p className="text-xs uppercase tracking-widest text-white/60">{item.status}</p>
                <p className="text-2xl font-semibold text-white">{item.count}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {statusOptions.map(status => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                  filter === status
                    ? 'bg-[#FFE600] text-black shadow-lg'
                    : 'text-white/70 border border-white/10 hover:text-white bg-white/5'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="glass-card rounded-[20px] border border-white/10 bg-white/5 text-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFE600] mx-auto mb-4"></div>
            <p className="text-gray-300">Loading submissions...</p>
          </div>
        ) : pendingMarkets.length === 0 ? (
          <div className="glass-card rounded-[20px] border border-white/10 bg-white/5 text-center py-16">
            <p className="text-gray-300 text-lg">No {filter.toLowerCase()} markets right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {pendingMarkets.map(market => (
              <div
                key={market.id}
                className="glass-card rounded-[20px] border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-6 sm:p-7 backdrop-blur-[30px]"
              >
                <div className="flex flex-col md:flex-row gap-6">
                  {market.imageUrl && (
                    <img
                      src={market.imageUrl}
                      alt={market.question}
                      className="w-full md:w-36 h-36 object-cover rounded-[16px] border border-white/10"
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                      <div>
                        <p className="text-xs tracking-widest text-white/50 uppercase">{market.category}</p>
                        <h3 className="text-2xl font-semibold">{market.question}</h3>
                      </div>
                      <span className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide ${
                        market.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-300' :
                        market.status === 'APPROVED' ? 'bg-green-500/20 text-green-300' :
                        'bg-red-500/20 text-red-300'
                      }`}>
                        {market.status}
                      </span>
                    </div>

                    {market.description && (
                      <p className="text-gray-300 text-sm mb-4">{market.description}</p>
                    )}

                    {market.feeAmountWei && (
                      <div className="mb-5 flex flex-col gap-2 text-sm">
                        <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-[14px] px-4 py-2">
                          <span className="text-white/60">Submission Fee</span>
                          <span className="text-white font-medium">{Number(ethers.utils.formatEther(market.feeAmountWei)).toFixed(4)} TCENT</span>
                        </div>
                        {market.feeTxHash && (
                          <a
                            href={`${explorerBase}tx/${market.feeTxHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-[#FFE600] hover:underline"
                          >
                            View fee transaction
                          </a>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4 text-sm text-white/80">
                      <div><span className="text-white/40">Creator</span><p className="text-white">{market.creator.slice(0, 6)}...{market.creator.slice(-4)}</p></div>
                      <div><span className="text-white/40">End Date</span><p className="text-white">{new Date(market.endTime).toLocaleDateString()}</p></div>
                      <div><span className="text-white/40">Resolution</span><p className="text-white">{new Date(market.resolutionTime).toLocaleDateString()}</p></div>
                      <div><span className="text-white/40">Rules</span><p className="text-white">{market.rules?.length || 0}</p></div>
                    </div>

                    {market.rules && market.rules.length > 0 && (
                      <div className="mb-4 bg-white/5 border border-white/10 rounded-[14px] px-4 py-3">
                        <p className="text-white/60 text-xs uppercase tracking-wide mb-2">Rules</p>
                        <ul className="space-y-1 text-sm text-white/80 list-disc list-inside">
                          {market.rules.map((rule, idx) => (
                            <li key={idx}>{rule}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {market.rejectionReason && (
                      <div className="mb-4 p-3 rounded-[12px] bg-red-500/10 border border-red-500/20">
                        <p className="text-red-300 text-sm">
                          <strong>Rejection Reason:</strong> {market.rejectionReason}
                        </p>
                      </div>
                    )}

                    {market.status === 'APPROVED' && market.marketId && (
                      <div className="mb-4 p-3 rounded-[12px] bg-green-500/10 border border-green-500/20">
                        <p className="text-green-300 text-sm">
                          <strong>Market ID:</strong> {market.marketId.toString()}
                        </p>
                      </div>
                    )}

                    {market.status === 'PENDING' && (
                      <div className="flex flex-col sm:flex-row gap-3">
                        <button
                          onClick={() => handleApprove(market)}
                          disabled={processingId === market.id}
                          className="flex-1 px-6 py-3 rounded-[14px] bg-gradient-to-r from-green-400 to-green-500 text-black font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {processingId === market.id ? 'Processing...' : 'Approve & Deploy'}
                        </button>
                        <button
                          onClick={() => handleReject(market)}
                          disabled={processingId === market.id}
                          className="flex-1 px-6 py-3 rounded-[14px] border border-red-500/40 text-red-300 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
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
