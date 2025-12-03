import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import WormStyleNavbar from '../../components/modern/WormStyleNavbar';
import { centsToTCENT } from '../../utils/priceFormatter';

const ActivityRow = ({ item, onClick }) => {
  return (
    <div
      className="flex items-center border-b border-[#272727] cursor-pointer hover:bg-white/5 transition-colors"
      style={{ minHeight: '72px' }}
      onClick={onClick}
    >
      {/* Market thumbnail */}
      <div className="flex items-center gap-4 flex-1 px-4 py-3">
        <div className="relative w-12 h-12 rounded-md overflow-hidden flex-shrink-0">
          {item.marketImageUrl ? (
            <>
              <img
                src={item.marketImageUrl}
                alt={item.marketTitle}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to gradient if image fails to load
                  e.target.style.display = 'none';
                  if (e.target.nextSibling) {
                    e.target.nextSibling.style.display = 'block';
                  }
                }}
              />
              <div
                className={`absolute inset-0 bg-gradient-to-br ${item.avatarGradient}`}
                style={{ display: 'none' }}
              />
            </>
          ) : (
            <div
              className={`absolute inset-0 bg-gradient-to-br ${item.avatarGradient}`}
            />
          )}
        </div>
        <div className="min-w-0">
          <p
            className="text-sm font-semibold text-white truncate"
            style={{
              fontFamily:
                '"Clash Grotesk", "Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            {item.marketTitle}
          </p>
        </div>
      </div>

      {/* Description */}
      <div className="hidden md:flex items-center gap-2 px-4 py-3 flex-[2] text-xs text-[#BABABA]"
        style={{
          fontFamily:
            '"Clash Grotesk", "Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <span className="text-[#F2F2F2] font-semibold">{item.user}</span>
        <span>{item.action}</span>
        {item.side && (
          <span style={{ color: item.sideColor, fontWeight: 600 }}>{item.side}</span>
        )}
        {item.priceCents !== null && item.shares !== null && (
          <>
            <span>at</span>
            <span>{centsToTCENT(item.priceCents)} TCENT</span>
            <span>({typeof item.shares === 'number' ? item.shares.toFixed(4) : '0'} TCENT)</span>
          </>
        )}
      </div>

      {/* Time + link */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0">
        <span
          className="text-xs text-[#BABABA]"
          style={{
            fontFamily:
              '"Clash Grotesk", "Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          {item.timestampLabel}
        </span>
        <a
          href={item.txUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="w-5 h-5 rounded-full border border-white/16 flex items-center justify-center hover:border-white/40 transition-colors"
        >
          <svg
            className="w-3 h-3 text-[#BABABA]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              d="M9 15L15 9M10 9h5v5"
            />
          </svg>
        </a>
      </div>
    </div>
  );
};

const Activity = () => {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const history = useHistory();

  const handleActivityClick = (item) => {
    if (item.marketId) {
      history.push(`/markets/${item.marketId}`);
    }
  };

  // Filter activity based on selected filter
  const filteredActivity = activity.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'trades') return item.eventType === 'ORDER_FILLED' || item.eventType === 'ORDER_PLACED';
    if (filter === 'resolved') return item.eventType === 'MARKET_RESOLVED';
    if (filter === 'created') return item.eventType === 'MARKET_CREATED';
    return true;
  });

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const base =
          window.__ENV?.API_BASE_URL ||
          import.meta.env.VITE_API_BASE_URL ||
          '';
        const res = await fetch(`${base}/api/activity?limit=50`);
        if (!res.ok) throw new Error('Failed to load activity');
        const data = await res.json();
        setActivity(data.activity || []);
      } catch (err) {
        console.error('Failed to fetch activity', err);
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();
  }, []);

  return (
    <div className="min-h-screen bg-[#050505]">
      <WormStyleNavbar />

      <div className="pt-24 pb-24 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <h1
                className="text-[36px] sm:text-[48px] font-bold text-white mb-2"
               style={{
                fontFamily:
                  '"Clash Grotesk", "Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
               }}
              >
                Polydegen Activity
              </h1>
              <p
                className="text-[14px] text-[#BABABA] max-w-xl"
                style={{
                  fontFamily:
                    '"Clash Grotesk", "Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}
              >
                Earn rewards by placing orders within the spread. Rewards are
                distributed directly to wallets everyday at midnight UTC.
              </p>
            </div>

            {/* Filter pills */}
            <div 
              className="flex items-center gap-2 flex-wrap"
              style={{
                fontFamily:
                  '"Clash Grotesk", "Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              {[
                { key: 'all', label: 'All' },
                { key: 'trades', label: 'Trades' },
                { key: 'resolved', label: 'Resolved' },
                { key: 'created', label: 'Created' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                    filter === key
                      ? 'bg-[#FFE600] text-black shadow-[0_0_12px_rgba(255,230,0,0.3)]'
                      : 'border border-[#FFE600]/60 text-[#FFE600] hover:bg-[#FFE600]/10 hover:border-[#FFE600]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Activity list – full-width rows with subtle dividers, no outer card */}
          <div className="rounded-[18px] bg-[#050505] shadow-[0_22px_60px_rgba(0,0,0,0.75)]">
            {loading && (
              <div className="px-4 py-6 text-sm text-[#BABABA]">
                Loading recent activity...
              </div>
            )}
            {!loading && filteredActivity.length === 0 && (
              <div className="px-4 py-6 text-sm text-[#BABABA]">
                {activity.length === 0 
                  ? 'No recent activity yet. Trade a market to see it here.'
                  : `No ${filter === 'all' ? '' : filter} activity found.`
                }
              </div>
            )}
            {!loading &&
              filteredActivity.map((item) => (
                <ActivityRow 
                  key={item.id} 
                  item={item} 
                  onClick={() => handleActivityClick(item)}
                />
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Activity;


