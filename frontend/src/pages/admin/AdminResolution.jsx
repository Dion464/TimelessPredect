import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useWeb3 } from '../../hooks/useWeb3';
import WormStyleNavbar from '../../components/modern/WormStyleNavbar';
import { showGlassToast, showTransactionToast } from '../../utils/toastUtils';

const AdminResolution = () => {
  const history = useHistory();
  const { isConnected, account, contracts, getMarketData, getActiveMarkets } = useWeb3();
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState(null);

  const loadMarkets = useCallback(async () => {
    if (!contracts?.predictionMarket) {
      setMarkets([]);
      return;
    }

    try {
      setLoading(true);
      const ids = await getActiveMarkets();
      if (!ids || ids.length === 0) {
        setMarkets([]);
        return;
      }

      const marketData = await Promise.all(
        ids.map(async (id) => {
          try {
            const data = await getMarketData(id);
            return data;
          } catch (err) {
            console.error('Failed to fetch market data', err);
            return null;
          }
        })
      );

      setMarkets(marketData.filter(Boolean));
    } catch (err) {
      console.error('Failed to load active markets', err);
      showGlassToast({ title: 'Failed to load markets', icon: '❌' });
    } finally {
      setLoading(false);
    }
  }, [contracts?.predictionMarket, getActiveMarkets, getMarketData]);

  useEffect(() => {
    if (isConnected) {
      loadMarkets();
    } else {
      setMarkets([]);
    }
  }, [isConnected, loadMarkets]);

  const actionableMarkets = useMemo(
    () =>
      markets.filter((market) => {
        if (!market) return false;
        const resolutionTimestamp = Number(market.resolutionTime) * 1000;
        return !market.resolved && Date.now() >= resolutionTimestamp;
      }),
    [markets]
  );

  const resolvedMarkets = useMemo(
    () => markets.filter((market) => market?.resolved),
    [markets]
  );

  const handleResolve = async (marketId, outcome) => {
    if (!contracts?.predictionMarket) {
      showGlassToast({ title: 'Connect an admin wallet to resolve markets', icon: '⚠️' });
      return;
    }

    try {
      setResolvingId(marketId);
      showGlassToast({ title: 'Submitting resolution...', icon: '⏳' });
      const tx = await contracts.predictionMarket.resolveMarket(marketId, outcome);
      showTransactionToast({ title: 'Resolution submitted', txHash: tx.hash });
      await tx.wait();
      showGlassToast({ title: `Market resolved as ${outcome === 1 ? 'YES' : 'NO'}`, icon: '✅' });
      await loadMarkets();
    } catch (err) {
      console.error('Failed to resolve market', err);
      showGlassToast({ title: err?.message || 'Failed to resolve market', icon: '❌' });
    } finally {
      setResolvingId(null);
    }
  };

  if (!isConnected || !account) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <WormStyleNavbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12 space-y-8">
        <div className="glass-card rounded-[24px] border border-white/10 bg-white/5 px-6 sm:px-8 py-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/60 mb-2">Resolution Desk</p>
              <h1 className="text-3xl sm:text-4xl font-semibold text-white mb-3">Announce Market Winners</h1>
              <p className="text-gray-300 max-w-2xl">
                Resolve completed markets by selecting the winning side. Winners receive 1&nbsp;TCENT per share and losers forfeit their
                stake.
              </p>
            </div>
            <button
              onClick={() => history.push('/admin/pending')}
              className="px-5 py-2.5 rounded-full border border-white/10 bg-white/5 text-sm font-medium text-white hover:text-black hover:bg-white/90 transition-all"
            >
              Review Pending Submissions
            </button>
          </div>
        </div>

        <section className="glass-card rounded-[20px] border border-white/10 bg-white/5 px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Markets Awaiting Resolution</h2>
            <span className="text-sm text-white/60">{actionableMarkets.length} ready</span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-white/60">Loading markets...</div>
          ) : actionableMarkets.length === 0 ? (
            <div className="py-12 text-center text-white/60">No markets ready for resolution yet.</div>
          ) : (
            <div className="space-y-5">
              {actionableMarkets.map((market) => {
                const yesShares = Number(market.totalYesShares) / 1e18;
                const noShares = Number(market.totalNoShares) / 1e18;
                return (
                  <div
                    key={market.id}
                    className="rounded-[18px] border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                      <div>
                        <p className="text-xs uppercase tracking-widest text-white/50">{market.category}</p>
                        <h3 className="text-2xl font-semibold">{market.question}</h3>
                        <p className="text-white/60 text-sm">
                          Resolution window began{' '}
                          {new Date(Number(market.resolutionTime) * 1000).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 w-full sm:w-auto">
                        <div className="rounded-[14px] border border-white/10 bg-white/5 px-4 py-2 text-center">
                          <p className="text-xs uppercase tracking-wide text-white/50">YES Pool</p>
                          <p className="text-xl font-semibold">{yesShares.toFixed(2)}</p>
                        </div>
                        <div className="rounded-[14px] border border-white/10 bg-white/5 px-4 py-2 text-center">
                          <p className="text-xs uppercase tracking-wide text-white/50">NO Pool</p>
                          <p className="text-xl font-semibold">{noShares.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={() => handleResolve(market.id, 1)}
                        disabled={resolvingId === market.id}
                        className="flex-1 px-5 py-3 rounded-[14px] bg-gradient-to-r from-green-400 to-green-500 text-black font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {resolvingId === market.id ? 'Resolving...' : 'Declare YES Winner'}
                      </button>
                      <button
                        onClick={() => handleResolve(market.id, 2)}
                        disabled={resolvingId === market.id}
                        className="flex-1 px-5 py-3 rounded-[14px] border border-red-500/40 text-red-300 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {resolvingId === market.id ? 'Resolving...' : 'Declare NO Winner'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="glass-card rounded-[20px] border border-white/10 bg-white/3 px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Recently Resolved</h2>
            <span className="text-sm text-white/60">{resolvedMarkets.length} markets</span>
          </div>

          {resolvedMarkets.length === 0 ? (
            <div className="py-8 text-center text-white/50 text-sm">No resolved markets in this session.</div>
          ) : (
            <div className="space-y-4">
              {resolvedMarkets.map((market) => (
                <div key={market.id} className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-white/50">#{market.id}</p>
                      <p className="font-semibold">{market.question}</p>
                    </div>
                    <span
                      className={`px-4 py-1 rounded-full text-xs font-semibold ${
                        market.outcome === 1
                          ? 'bg-green-500/15 text-green-300'
                          : market.outcome === 2
                          ? 'bg-red-500/15 text-red-300'
                          : 'bg-yellow-500/15 text-yellow-300'
                      }`}
                    >
                      {market.outcome === 1 ? 'YES Won' : market.outcome === 2 ? 'NO Won' : 'Invalid'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default AdminResolution;
