import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import WormStyleNavbar from '../../components/modern/WormStyleNavbar';
import { centsToTCENT } from '../../utils/priceFormatter';

const ActivityRow = ({ item, onClick }) => {
  return (
    <div
      className="flex items-center border-b border-[#272727] cursor-pointer hover:bg-white/5 transition-colors"
      style={{ minHeight: '60px' }}
      onClick={onClick}
    >
      {/* Market thumbnail */}
      <div className="flex items-center gap-2.5 sm:gap-4 flex-1 px-3 sm:px-4 py-2.5 sm:py-3">
        <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-md overflow-hidden flex-shrink-0">
          {item.marketImageUrl ? (
            <>
              <img
                src={item.marketImageUrl}
                alt={item.marketTitle}
                className="w-full h-full object-cover"
                onError={(e) => {
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
        <div className="min-w-0 flex-1">
          <p
            className="text-xs sm:text-sm font-semibold text-white truncate"
            style={{
              fontFamily:
                '"Clash Grotesk", "Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            {item.marketTitle}
          </p>
          {/* Mobile-only description */}
          <p
            className="md:hidden text-[10px] sm:text-xs text-[#BABABA] truncate mt-0.5"
            style={{
              fontFamily:
                '"Clash Grotesk", "Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            {item.user} {item.action} {item.side && <span style={{ color: item.sideColor, fontWeight: 600 }}>{item.side}</span>}
          </p>
        </div>
      </div>

      {/* Description - Desktop only */}
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
      <div className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-2.5 sm:py-3 flex-shrink-0">
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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const history = useHistory();

  const filterOptions = [
    { key: 'all', label: 'All' },
    { key: 'trades', label: 'Trades' },
    { key: 'resolved', label: 'Resolved' },
    { key: 'created', label: 'Created' },
  ];

  const handleActivityClick = (item) => {
    if (item.marketId) {
      history.push(`/markets/${item.marketId}`);
    }
  };

  // Filter activity
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
    <div className="min-h-screen bg-[#050505] overflow-x-hidden">
      <WormStyleNavbar />

      <div className="pt-20 sm:pt-24 pb-16 sm:pb-24 px-3 sm:px-4 overflow-x-hidden">
        <div className="max-w-5xl mx-auto w-full">
          {/* Header */}
          <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
            <div>
              <h1
                className="text-[28px] sm:text-[48px] font-bold text-white mb-1 sm:mb-2"
               style={{
                fontFamily:
                  '"Clash Grotesk", "Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
               }}
              >
                Activity
              </h1>
              <p
                className="text-[12px] sm:text-[14px] text-[#BABABA] max-w-xl"
                style={{
                  fontFamily:
                    '"Clash Grotesk", "Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}
              >
                Earn rewards by placing orders within the spread.
              </p>
            </div>

            {/* Filter dropdown */}
            <div 
              className="relative w-full sm:w-auto"
              style={{
                fontFamily:
                  '"Clash Grotesk", "Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center justify-between sm:justify-start gap-3 bg-transparent border-2 border-[#FFE600] text-[#FFE600] rounded-full px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base font-medium cursor-pointer hover:bg-[#FFE600]/10 transition-all focus:outline-none w-full sm:w-auto"
                style={{ minWidth: '120px' }}
              >
                <span>{filterOptions.find(o => o.key === filter)?.label || 'All'}</span>
                <svg 
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {/* Dropdown menu */}
              {dropdownOpen && (
                <>
                  {/* Backdrop to close dropdown */}
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setDropdownOpen(false)}
                  />
                  <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-full sm:w-48 bg-[#1A1A1A] border border-[#FFE600]/30 rounded-2xl shadow-xl z-50 overflow-hidden">
                    {filterOptions.map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => {
                          setFilter(key);
                          setDropdownOpen(false);
                        }}
                        className={`w-full px-4 sm:px-5 py-2.5 sm:py-3 text-left text-xs sm:text-sm font-medium transition-colors ${
                          filter === key
                            ? 'bg-[#FFE600]/20 text-[#FFE600]'
                            : 'text-white hover:bg-white/5'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
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


