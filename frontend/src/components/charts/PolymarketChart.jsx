import React, { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import '../../pages/market/MarketDetailGlass.css';

const DEFAULT_RANGES = [
  { label: '1H', value: '1h' },
  { label: '6H', value: '6h' },
  { label: '1D', value: '1d' },
  { label: '1W', value: '1w' },
  { label: '1M', value: '1m' },
  { label: 'ALL', value: 'all' }
];

// Normalize price to 0-1 range (NO artificial clamping)
const normalizePrice = (raw) => {
  if (raw === undefined || raw === null) return null;
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return null;
  
  // If value is > 1.5, assume it's in percentage or basis points
  if (numeric > 100) return numeric / 10000; // basis points
  if (numeric > 1.5) return numeric / 100; // percentage
  if (numeric < 0) return 0;
  if (numeric > 1) return 1;
  return numeric;
};

const resolveTimestamp = (point = {}) => {
  const candidate =
    point.timestamp ||
    point.createdAt ||
    point.date ||
    (point.blockTimestamp ? Number(point.blockTimestamp) * 1000 : null) ||
    (point.block_time ? Number(point.block_time) * 1000 : null) ||
    point.time;

  if (!candidate) return NaN;
  const ts = new Date(candidate).getTime();
  return Number.isFinite(ts) ? ts : NaN;
};

const resolvePrice = (point = {}) => {
  // Handle yesPriceBps directly (from database)
  if (point.yesPriceBps !== undefined) return point.yesPriceBps / 10000;
  if (point.noPriceBps !== undefined) return point.noPriceBps / 10000;
  if (point.price !== undefined) return point.price;
  if (point.value !== undefined) return point.value;
  if (point.priceDecimal !== undefined) return point.priceDecimal;
  if (point.priceCents !== undefined) return point.priceCents / 100;
  if (point.priceBps !== undefined) return point.priceBps / 10000;
  if (point.priceTicks !== undefined) return point.priceTicks / 10000;
  return undefined;
};

// Only use REAL data from database - no interpolation
const sanitizeHistory = (history = []) =>
  history
    .map((point) => {
      const timestamp = resolveTimestamp(point);
      const price = normalizePrice(resolvePrice(point));
      if (!Number.isFinite(timestamp) || price === null) return null;
      return [timestamp, price];
    })
    .filter(Boolean)
    .sort((a, b) => a[0] - b[0]);

const buildSeries = (history = [], fallbackPrice) => {
  const sanitized = sanitizeHistory(history);
  
  // Only use fallback if NO real data exists
  if (!sanitized.length && fallbackPrice !== undefined && fallbackPrice !== null) {
    const fallbackNormalized = normalizePrice(
      fallbackPrice > 1 ? fallbackPrice / 100 : fallbackPrice
    );
    if (fallbackNormalized !== null) {
      return [[Date.now(), fallbackNormalized]];
    }
  }
  return sanitized;
};

const parseRangeValue = (value = '') => {
  const lower = value.toLowerCase();
  if (lower === 'all') return { type: 'all' };
  const match = lower.match(/^(\d+)([hmwdmy])$/);
  if (!match) return null;
  const count = parseInt(match[1], 10);
  const unit = match[2];
  const unitMap = { h: 'hour', d: 'day', w: 'week', m: 'month', y: 'year' };
  return { type: unitMap[unit] || 'day', count };
};

const PolymarketChart = ({
  priceHistory = [],
  yesPriceHistory = [],
  noPriceHistory = [],
  currentYesPrice = 0.5,
  currentNoPrice = 0.5,
  accentYes = '#4FC3F7', // Polymarket light blue
  accentNo = '#90A4AE',  // Gray for NO
  height = 320,
  selectedRange = 'all',
  onRangeChange = () => {},
  ranges = DEFAULT_RANGES,
  title = 'Price History'
}) => {
  const [selectedSide, setSelectedSide] = useState('yes');

  // Build series from REAL data only - no interpolation
  const yesSeries = useMemo(
    () => buildSeries(yesPriceHistory, currentYesPrice),
    [yesPriceHistory, currentYesPrice]
  );

  const noSeries = useMemo(
    () => buildSeries(noPriceHistory, currentNoPrice),
    [noPriceHistory, currentNoPrice]
  );

  const aggregatedSeries = useMemo(() => sanitizeHistory(priceHistory), [priceHistory]);

  // Use ONLY real data - no densification or smoothing
  const { yesLineData, noLineData } = useMemo(() => {
    let yesData = [];
    let noData = [];

    if (yesSeries.length > 0) {
      yesData = yesSeries;
    } else if (aggregatedSeries.length > 0) {
      yesData = aggregatedSeries;
    }

    if (noSeries.length > 0) {
      noData = noSeries;
    } else if (aggregatedSeries.length > 0) {
      noData = aggregatedSeries.map(([ts, val]) => [ts, 1 - val]);
    }

    return { yesLineData: yesData, noLineData: noData };
  }, [yesSeries, noSeries, aggregatedSeries]);

  const hasData = yesLineData.length > 0 || noLineData.length > 0;

  const rangeButtons = useMemo(() => {
    const sourceRanges = ranges && ranges.length ? ranges : DEFAULT_RANGES;
    const mapped = sourceRanges
      .map((range) => {
        const parsed = parseRangeValue(range.value);
        if (!parsed) return null;

        return {
          text: range.label.toUpperCase(),
          dataRangeValue: range.value,
          ...parsed
        };
      })
      .filter(Boolean);

    return mapped.length ? mapped : [{ text: 'ALL', type: 'all', dataRangeValue: 'all' }];
  }, [ranges]);

  const selectedRangeIndex = useMemo(() => {
    const index = rangeButtons.findIndex(
      (btn) => btn.dataRangeValue?.toLowerCase() === selectedRange?.toLowerCase()
    );
    return index >= 0 ? index : 0;
  }, [rangeButtons, selectedRange]);

  const chartOptions = useMemo(() => {
    if (!hasData) return null;

    // Format data - NO clamping, show REAL values
    const formatSeriesData = (lineData) =>
      lineData.map(([ts, value]) => {
        const rawPercent = Number(value || 0) * 100;
        return {
          value: [ts, rawPercent],
          actual: rawPercent
        };
      });

    const yesData = formatSeriesData(yesLineData);
    const noData = formatSeriesData(noLineData);

    // Calculate time range from real data
    const allTimestamps = [
      ...yesData.map((point) => point.value[0]),
      ...noData.map((point) => point.value[0])
    ].filter(Number.isFinite);
    const minTime = allTimestamps.length > 0 ? Math.min(...allTimestamps) : Date.now() - 86400000;
    const maxTime = allTimestamps.length > 0 ? Math.max(...allTimestamps) : Date.now();

    const latestYes = yesData.length ? yesData[yesData.length - 1].actual : 0;
    const latestNo = noData.length ? noData[noData.length - 1].actual : 0;

    // Show only the selected side
    const activeSeries = selectedSide === 'yes' && yesData.length
      ? { key: 'YES', color: accentYes, data: yesData, latest: latestYes }
      : noData.length
      ? { key: 'NO', color: accentNo, data: noData, latest: latestNo }
      : null;

    if (!activeSeries) return null;

    // Polymarket-style: clean line, minimal styling
    const series = [
      {
        name: activeSeries.key,
        type: 'line',
        smooth: 0.3, // Subtle smoothing like Polymarket
        symbol: 'none',
        showSymbol: false,
        sampling: 'lttb', // Use LTTB sampling for performance
        lineStyle: {
          width: 2,
          color: activeSeries.color,
          type: 'solid'
        },
        // Subtle area fill like Polymarket
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(79, 195, 247, 0.08)' },
              { offset: 1, color: 'rgba(79, 195, 247, 0.01)' }
            ]
          }
        },
        emphasis: {
          focus: 'series',
          lineStyle: { width: 2.5 }
        },
        data: activeSeries.data
      }
    ];

    return {
      backgroundColor: 'transparent',
      animation: true,
      animationDuration: 400,
      grid: {
        left: '3%',
        right: '12%',
        top: '5%',
        bottom: '12%',
        containLabel: true
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(30, 41, 59, 0.95)',
        borderColor: 'rgba(79, 195, 247, 0.3)',
        borderWidth: 1,
        padding: [8, 12],
        textStyle: {
          color: '#fff',
          fontSize: 13
        },
        axisPointer: {
          type: 'line',
          lineStyle: {
            color: 'rgba(79, 195, 247, 0.4)',
            type: 'dashed',
            width: 1
          }
        },
        formatter: function(params) {
          if (!params || params.length === 0) return '';
          const date = new Date(params[0].value[0]);
          const dateStr = date.toLocaleString('en-US', { 
            month: 'short', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true 
          });
          const value = params[0].value[1];
          return `<div style="font-size: 12px; color: rgba(255,255,255,0.7); margin-bottom: 4px;">${dateStr}</div>
                  <div style="display: inline-block; padding: 2px 8px; border-radius: 4px; background: ${activeSeries.color}; color: #000; font-weight: 600;">
                    ${activeSeries.key} ${Number(value).toFixed(1)}%
                  </div>`;
        }
      },
      legend: { show: false },
      xAxis: {
        type: 'time',
        boundaryGap: false,
        axisLine: {
          show: true,
          lineStyle: { color: 'rgba(255, 255, 255, 0.1)', width: 1 }
        },
        axisLabel: {
          show: true,
          color: 'rgba(255, 255, 255, 0.5)',
          fontSize: 11,
          margin: 12,
          formatter: function(value) {
            const date = new Date(value);
            const month = date.toLocaleString('default', { month: 'short' });
            return `${month}`;
          }
        },
        splitLine: { show: false },
        min: minTime,
        max: maxTime
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        interval: 10,
        position: 'right',
        axisLine: { show: false },
        axisLabel: {
          show: true,
          color: 'rgba(255, 255, 255, 0.5)',
          fontSize: 11,
          margin: 8,
          formatter: (val) => `${val}%`
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.05)',
            type: 'dotted',
            width: 1
          }
        }
      },
      series
    };
  }, [accentNo, accentYes, hasData, noLineData, yesLineData, selectedSide]);

  if (!hasData || !chartOptions) {
  return (
      <div
        className="glass-card flex items-center justify-center rounded-[24px] border border-white/20 backdrop-blur-xl text-sm text-white/60"
        style={{ height, background: 'rgba(12,12,12,0.55)' }}
      >
        No price data available yet
          </div>
    );
  }

  const renderControls = () => (
    <div className="mb-3 flex items-center justify-between">
      {/* YES/NO Toggle Buttons */}
      <div className="flex items-center gap-2 bg-white/5 backdrop-blur-md rounded-full p-1 border border-white/10">
              <button
          onClick={() => setSelectedSide('yes')}
          className={`px-4 py-1.5 rounded-full transition-all text-xs font-semibold ${
            selectedSide === 'yes'
              ? 'bg-[#FFE600] text-black'
              : 'text-white/60 hover:text-white'
          }`}
          style={{
            fontFamily: 'gilroy, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          }}
        >
          YES
              </button>
          <button
          onClick={() => setSelectedSide('no')}
          className={`px-4 py-1.5 rounded-full transition-all text-xs font-semibold ${
            selectedSide === 'no'
              ? 'bg-[#7C3AED] text-white'
              : 'text-white/60 hover:text-white'
          }`}
          style={{
            fontFamily: 'gilroy, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          }}
        >
          NO
          </button>
      </div>

      {/* Zoom Buttons */}
      <div className="flex items-center gap-2">
        <span className="text-white/60 text-xs font-medium mr-1">Zoom</span>
        {rangeButtons.map((btn, index) => {
          const isActive = index === selectedRangeIndex;
          return (
            <button
              key={btn.text + btn.dataRangeValue}
              onClick={() => onRangeChange?.(btn.dataRangeValue)}
              className={`px-3 py-1.5 rounded-full transition-all text-xs font-medium ${
                isActive
                  ? 'bg-white/15 text-white border border-white/20'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 border border-transparent'
              } backdrop-blur-md`}
              style={{
                fontFamily: 'gilroy, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
              }}
            >
              {btn.text}
            </button>
          );
        })}
                  </div>
                  </div>
  );

  return (
    <div className="glass-card w-full rounded-[24px] border border-white/20 backdrop-blur-xl p-4" style={{ background: 'rgba(12,12,12,0.55)' }}>
      {renderControls()}
      <div className="overflow-hidden rounded-[16px]" style={{ height }}>
        <ReactECharts option={chartOptions} style={{ height: '100%', width: '100%' }} />
        </div>
    </div>
  );
};

export default PolymarketChart;

