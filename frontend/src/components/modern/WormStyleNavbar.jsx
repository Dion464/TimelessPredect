import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useWeb3 } from '../../hooks/useWeb3';
import { showGlassToast } from '../../utils/toastUtils';

const WormStyleNavbar = () => {
  const history = useHistory();
  const {
    account,
    isConnected,
    connectWallet,
    isConnecting,
    getUserMarkets,
    getMarketData,
    getUserPosition,
    claimWinnings
  } = useWeb3();

  const [notifications, setNotifications] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const handleCreateClick = () => {
    history.push('/create');
  };

  const handleConnectClick = () => {
    if (isConnected && account) {
      history.push(`/user/${account}`);
    } else {
      connectWallet();
    }
  };

  const buildNotification = (market, position) => {
    if (!market || !position) return null;
    const yesShares = parseFloat(position.yesShares || '0');
    const noShares = parseFloat(position.noShares || '0');
    const holdsShares = yesShares > 0 || noShares > 0;
    if (!holdsShares) return null;

    const endTimeMs = Number(market.endTime) * 1000;
    const resolved = Boolean(market.resolved);
    const outcome = Number(market.outcome || 0);
    const now = Date.now();

    if (!resolved) {
      if (now >= endTimeMs) {
        return {
          marketId: Number(market.id),
          question: market.question,
          status: 'pending_resolution',
          message: 'Market ended. Awaiting winner announcement.',
          claimable: false,
          shares: yesShares + noShares,
          updatedAt: endTimeMs
        };
      }
      return null;
    }

    if (outcome === 3) {
      return {
        marketId: Number(market.id),
        question: market.question,
        status: 'invalid',
        message: 'Market marked invalid. Claim refund if available.',
        claimable: yesShares + noShares > 0,
        shares: yesShares + noShares,
        updatedAt: Date.now()
      };
    }

    const userWinningShares = outcome === 1 ? yesShares : noShares;
    const lostShares = outcome === 1 ? noShares : yesShares;

    if (userWinningShares > 0) {
      return {
        marketId: Number(market.id),
        question: market.question,
        status: 'won',
        message: `You won! ${userWinningShares.toFixed(2)} TCENT ready to claim.`,
        claimable: true,
        shares: userWinningShares,
        updatedAt: Date.now()
      };
    }

    if (lostShares > 0) {
      return {
        marketId: Number(market.id),
        question: market.question,
        status: 'lost',
        message: 'Market resolved against you. Shares were forfeited.',
        claimable: false,
        shares: lostShares,
        updatedAt: Date.now()
      };
    }

    return null;
  };

  const loadNotifications = useCallback(async () => {
    if (!isConnected || !account || !getUserMarkets) {
      setNotifications([]);
      return;
    }

    try {
      setLoadingNotifications(true);
      const marketIds = await getUserMarkets();
      if (!marketIds || marketIds.length === 0) {
        setNotifications([]);
        return;
      }

      const entries = await Promise.all(
        marketIds.map(async (id) => {
          try {
            const market = await getMarketData(id);
            if (!market) return null;
            const position = await getUserPosition(id);
            return buildNotification(market, position);
          } catch (err) {
            console.error('Failed to build notification', err);
            return null;
          }
        })
      );

      const formatted = entries.filter(Boolean).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      setNotifications(formatted);
    } catch (err) {
      console.error('Failed to load notifications', err);
    } finally {
      setLoadingNotifications(false);
    }
  }, [isConnected, account, getUserMarkets, getMarketData, getUserPosition]);

  useEffect(() => {
    if (!isConnected) {
      setNotifications([]);
      return;
    }

    loadNotifications();
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, [isConnected, account, loadNotifications]);

  const notificationCount = notifications.length;

  const statusStyles = useMemo(() => ({
    won: 'text-green-300',
    lost: 'text-red-300',
    pending_resolution: 'text-yellow-300',
    invalid: 'text-white',
  }), []);

  const handleClaim = async (marketId) => {
    try {
      await claimWinnings(marketId);
      showGlassToast('Winnings claimed successfully! 🎉', '✅', 'success');
      loadNotifications();
    } catch (err) {
      console.error('Failed to claim winnings', err);
      showGlassToast(err?.message || 'Failed to claim winnings', '❌', 'error');
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#000000]/95 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-4 min-h-[72px]">
          <button
            onClick={() => history.push('/')}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#FFE600] font-bold text-lg">
              PD
            </div>
            <div className="text-left leading-tight">
              <p className="text-white text-lg font-semibold">PolyDegen</p>
              <p className="text-white/50 text-xs tracking-wide uppercase">Prediction Markets</p>
            </div>
          </button>

          <div className="flex flex-col sm:flex-row w-full sm:w-auto items-stretch sm:items-center gap-3">
            <button
              onClick={handleCreateClick}
              disabled={isConnecting}
              className="w-full sm:w-auto px-5 py-2.5 text-sm sm:text-base text-white rounded-full transition-all font-space-grotesk font-medium border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-60"
            >
              Create
            </button>

            <div className="relative">
              <button
                onClick={() => setNotificationsOpen((prev) => !prev)}
                className="w-full sm:w-auto px-4 py-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center relative"
              >
                <span className="sr-only">Notifications</span>
                <svg width="18" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M12 2C9.79086 2 8 3.79086 8 6V6.34195C5.67392 7.16559 4 9.39023 4 12V17L2 19V20H22V19L20 17V12C20 9.39023 18.3261 7.16559 16 6.34195V6C16 3.79086 14.2091 2 12 2Z"
                    stroke="#FFE600"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#FFE600] text-black text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {notificationCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-3 w-80 rounded-[16px] border border-white/10 bg-[#050505]/95 backdrop-blur-xl shadow-2xl z-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">Notifications</p>
                    {loadingNotifications && <span className="text-xs text-white/50">Refreshing...</span>}
                  </div>
                  {notifications.length === 0 ? (
                    <p className="text-xs text-white/60 py-4 text-center">No updates yet.</p>
                  ) : (
                    notifications.map((notif) => (
                      <div key={notif.marketId + notif.status} className="rounded-[12px] border border-white/10 bg-white/5 px-4 py-3 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">{notif.question}</p>
                            <p className={`text-xs ${statusStyles[notif.status] || 'text-white/70'}`}>{notif.message}</p>
                          </div>
                        </div>
                        {notif.claimable && (
                          <button
                            onClick={() => handleClaim(notif.marketId)}
                            className="w-full text-xs font-semibold text-black bg-[#FFE600] rounded-full py-2"
                          >
                            Claim {notif.shares.toFixed(2)} TCENT
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <button
              onClick={handleConnectClick}
              disabled={isConnecting}
              className="w-full sm:w-auto px-6 py-2.5 bg-[#171717] hover:bg-[#1a1a1a] text-white rounded-full transition-all font-space-grotesk font-bold border border-white/10 shadow-sm text-sm sm:text-base disabled:opacity-60"
            >
              {isConnecting ? (
                'Connecting...'
              ) : isConnected && account ? (
                `${account.slice(0, 6)}...${account.slice(-4)}`
              ) : (
                'Connect'
              )}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default WormStyleNavbar;
