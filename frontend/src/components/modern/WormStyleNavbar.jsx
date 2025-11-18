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

  // Resolve API base URL (use deployed Vercel API for local dev)
  const resolveApiBase = useCallback(() => {
    const envBase = import.meta.env.VITE_API_BASE_URL;
    
    // Ignore placeholder URLs
    if (envBase && (envBase.includes('your-backend-api.com') || envBase.includes('example.com') || envBase.includes('placeholder'))) {
      console.warn('Ignoring placeholder API URL:', envBase);
    } else if (envBase && !/localhost:8080|127\.0\.0\.1:8080/i.test(envBase)) {
      // Valid non-local API URL
      return envBase;
    }

    if (typeof window !== 'undefined' && window.location?.origin) {
      const origin = window.location.origin;
      // In production (Vercel), use same origin (Vercel will serve /api)
      if (!/localhost|127\.0\.0\.1/i.test(origin)) {
        return origin;
      }
      // In local dev, use the deployed Vercel API
      return 'https://polydegen.vercel.app';
    }
    
    // Fallback to current origin if available
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
    
    return '';
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!isConnected || !account) {
      setNotifications([]);
      return;
    }

    try {
      setLoadingNotifications(true);
      const allNotifications = [];

      // Load database notifications (approval/rejection)
      try {
        const apiBaseUrl = resolveApiBase();
        const dbResponse = await fetch(`${apiBaseUrl}/api/notifications?recipient=${account.toLowerCase()}`);
        if (dbResponse.ok) {
          const dbData = await dbResponse.json();
          if (dbData.success && dbData.notifications) {
            const dbNotifs = dbData.notifications
              .filter(n => !n.read)
              .map((n) => {
                let shares = 0;
                // Extract shares from message for MARKET_RESOLVED notifications
                if (n.type === 'MARKET_RESOLVED' && n.message) {
                  // Try to extract from "You won X.XXXX TCENT" format first
                  const amountMatch = n.message.match(/You won ([\d.]+) TCENT/);
                  if (amountMatch) {
                    shares = parseFloat(amountMatch[1]) || 0;
                  } else {
                    // Fallback: try to extract from "(X.XXXX shares × 1 TCENT per share)" format
                    const sharesMatch = n.message.match(/\(([\d.]+) shares/);
                    if (sharesMatch) {
                      shares = parseFloat(sharesMatch[1]) || 0;
                    } else {
                      // Last fallback: try "have X winning shares" format
                      const fallbackMatch = n.message.match(/have ([\d.]+) winning shares/);
                      if (fallbackMatch) {
                        shares = parseFloat(fallbackMatch[1]) || 0;
                      }
                    }
                  }
                }
                
                return {
                  id: n.id,
                  type: 'db',
                  title: n.title,
                  message: n.message,
                  question: n.message.split('"')[1] || n.title,
                  status: n.type === 'MARKET_RESOLVED' ? (n.message.includes('won') ? 'won' : 'lost') : n.type === 'MARKET_APPROVED' ? 'approved' : n.type === 'MARKET_REJECTED' ? 'rejected' : 'info',
                  claimable: n.type === 'MARKET_RESOLVED' && n.message.includes('won'),
                  shares: shares,
                  marketId: n.marketId ? Number(n.marketId) : null,
                  pendingMarketId: n.pendingMarketId ? Number(n.pendingMarketId) : null,
                  updatedAt: new Date(n.createdAt).getTime()
                };
              });
            allNotifications.push(...dbNotifs);
          }
        }
      } catch (dbErr) {
        console.error('Failed to load database notifications:', dbErr);
      }

      // Load chain-based notifications (market resolution)
      if (getUserMarkets) {
        try {
          const marketIds = await getUserMarkets();
          if (marketIds && marketIds.length > 0) {
            const chainEntries = await Promise.all(
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
            const chainNotifs = chainEntries.filter(Boolean);
            allNotifications.push(...chainNotifs);
          }
        } catch (chainErr) {
          console.error('Failed to load chain notifications:', chainErr);
        }
      }

      // Sort by most recent
      const formatted = allNotifications.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      setNotifications(formatted);
    } catch (err) {
      console.error('Failed to load notifications', err);
    } finally {
      setLoadingNotifications(false);
    }
  }, [isConnected, account, getUserMarkets, getMarketData, getUserPosition, resolveApiBase]);

  useEffect(() => {
    if (!isConnected) {
      setNotifications([]);
      return;
    }

    loadNotifications();
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, [isConnected, account, loadNotifications]);

  // Close notifications on escape key and prevent body scroll on mobile
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && notificationsOpen) {
        setNotificationsOpen(false);
      }
    };

    if (notificationsOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when notifications are open (mainly for mobile)
      const isMobile = window.innerWidth < 640; // sm breakpoint
      if (isMobile) {
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
          document.removeEventListener('keydown', handleEscape);
          document.body.style.overflow = originalOverflow;
        };
      }
      return () => {
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [notificationsOpen]);

  const notificationCount = notifications.length;

  const statusStyles = useMemo(() => ({
    won: 'text-green-300',
    lost: 'text-red-300',
    pending_resolution: 'text-yellow-300',
    invalid: 'text-white',
    approved: 'text-green-300',
    rejected: 'text-red-300',
    info: 'text-white/70',
  }), []);

  const markAsRead = useCallback(async (notificationId) => {
    if (!isConnected || !account || !notificationId) return;
    
    try {
      const apiBaseUrl = resolveApiBase();
      await fetch(`${apiBaseUrl}/api/notifications`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: account.toLowerCase(),
          notificationIds: [notificationId.toString()]
        })
      });
      // Reload notifications to update UI
      loadNotifications();
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, [isConnected, account, resolveApiBase, loadNotifications]);

  const handleClaim = async (marketId) => {
    try {
      await claimWinnings(marketId);
      showGlassToast({ title: 'Winnings claimed successfully! 🎉', icon: '✅' });
      loadNotifications();
    } catch (err) {
      console.error('Failed to claim winnings', err);
      showGlassToast({ title: err?.message || 'Failed to claim winnings', icon: '❌' });
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#000000]/95 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-4 min-h-[72px]">
          <div className="flex flex-row items-center justify-between gap-3 sm:gap-4">
            {/* Logo */}
            <button
              onClick={() => history.push('/')}
              className="flex-shrink-0 flex items-center hover:opacity-80 transition-opacity"
            >
              <img
                src="/poly.svg"
                alt="PolyDegen"
                className="h-6 sm:h-8 md:h-10 w-auto"
                style={{ maxWidth: '200px' }}
              />
            </button>

            {/* Right side buttons */}
            <div className="flex flex-row items-center gap-2 sm:gap-3 flex-shrink-0">
              <button
                onClick={handleCreateClick}
                disabled={isConnecting}
                className="px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm md:text-base text-white rounded-full transition-all font-space-grotesk font-medium border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-60 whitespace-nowrap"
              >
                Create
              </button>

              <div className="relative">
                <button
                  onClick={() => setNotificationsOpen((prev) => !prev)}
                  className="px-3 sm:px-4 py-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center relative"
                >
                  <span className="sr-only">Notifications</span>
                  <svg 
                    className="w-4 h-4 sm:w-[18px] sm:h-5" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12 2C9.79086 2 8 3.79086 8 6V6.34195C5.67392 7.16559 4 9.39023 4 12V17L2 19V20H22V19L20 17V12C20 9.39023 18.3261 7.16559 16 6.34195V6C16 3.79086 14.2091 2 12 2Z"
                      stroke="#FFE600"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {notificationCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[#FFE600] text-black text-[8px] sm:text-[10px] font-bold rounded-full w-3.5 h-3.5 sm:w-4 sm:h-4 flex items-center justify-center">
                      {notificationCount > 9 ? '9+' : notificationCount}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <>
                    {/* Backdrop for mobile */}
                    <div 
                      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 sm:hidden"
                      onClick={() => setNotificationsOpen(false)}
                    />
                    {/* Notification dropdown */}
                    <div className="fixed sm:absolute right-0 left-0 sm:left-auto top-[72px] sm:top-auto sm:mt-3 sm:w-80 w-full sm:max-w-[90vw] rounded-t-[20px] sm:rounded-[16px] border border-white/20 bg-[#0a0a0a] backdrop-blur-xl shadow-2xl z-50 p-4 sm:p-4 space-y-3 max-h-[calc(100vh-88px)] sm:max-h-[80vh] overflow-y-auto" style={{ backgroundColor: 'rgba(10, 10, 10, 0.98)' }}>
                      <div className="flex items-center justify-between mb-2 sm:mb-0">
                        <p className="text-base sm:text-sm font-semibold text-white">Notifications</p>
                        <div className="flex items-center gap-3">
                          {loadingNotifications && <span className="text-xs text-white/50">Refreshing...</span>}
                          <button
                            onClick={() => setNotificationsOpen(false)}
                            className="sm:hidden text-white/70 hover:text-white p-1 -mr-2"
                            aria-label="Close notifications"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      {notifications.length === 0 ? (
                        <p className="text-sm sm:text-xs text-white/70 py-6 sm:py-4 text-center">No updates yet.</p>
                      ) : (
                        <div className="space-y-2.5 sm:space-y-3">
                          {notifications.map((notif) => (
                            <div key={notif.id || `${notif.marketId}-${notif.status}`} className="rounded-[14px] sm:rounded-[12px] border border-white/20 bg-[#1a1a1a]/80 backdrop-blur-sm px-4 sm:px-4 py-3.5 sm:py-3 space-y-2.5 sm:space-y-2 active:bg-[#252525] transition-colors" style={{ backgroundColor: 'rgba(26, 26, 26, 0.9)' }}>
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-base sm:text-sm font-semibold text-white leading-tight break-words">
                                    {notif.title || notif.question}
                                  </p>
                                  <p className={`text-sm sm:text-xs mt-1.5 sm:mt-1 leading-relaxed break-words ${statusStyles[notif.status] || 'text-white/80'}`}>
                                    {notif.message}
                                  </p>
                                </div>
                                {notif.type === 'db' && notif.id && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      markAsRead(notif.id);
                                    }}
                                    className="flex-shrink-0 text-white/50 hover:text-white/80 active:text-white text-lg sm:text-base p-1.5 sm:p-1 -mt-1 -mr-1 touch-manipulation"
                                    title="Mark as read"
                                    aria-label="Mark as read"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                              {notif.claimable && notif.marketId && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleClaim(notif.marketId);
                                  }}
                                  className="w-full text-sm sm:text-xs font-semibold text-black bg-[#FFE600] hover:bg-[#FFD700] active:bg-[#FFC700] rounded-full py-2.5 sm:py-2 touch-manipulation transition-colors"
                                >
                                  Claim {((notif.shares || 0) > 0 ? notif.shares.toFixed(2) : '0.00')} TCENT
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={handleConnectClick}
                disabled={isConnecting}
                className="px-3 sm:px-6 py-2 sm:py-2.5 bg-[#171717] hover:bg-[#1a1a1a] text-white rounded-full transition-all font-space-grotesk font-bold border border-white/10 shadow-sm text-xs sm:text-sm md:text-base disabled:opacity-60 whitespace-nowrap"
              >
                {isConnecting ? (
                  <span className="hidden sm:inline">Connecting...</span>
                ) : isConnected && account ? (
                  <>
                    <span className="hidden sm:inline">{account.slice(0, 6)}...{account.slice(-4)}</span>
                    <span className="sm:hidden">{account.slice(0, 4)}...{account.slice(-2)}</span>
                  </>
                ) : (
                  'Connect'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default WormStyleNavbar;
