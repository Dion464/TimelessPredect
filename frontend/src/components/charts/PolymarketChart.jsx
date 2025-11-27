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

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const normalizePrice = (raw) => {
  if (raw === undefined || raw === null) return null;
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  if (numeric > 1.5) {
    return clamp(numeric / 100, 0, 1);
  }
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

  if (!candidate) {
    return NaN;
  }

  const ts = new Date(candidate).getTime();
  return Number.isFinite(ts) ? ts : NaN;
};

const resolvePrice = (point = {}) => {
  if (point.price !== undefined) return point.price;
  if (point.value !== undefined) return point.value;
  if (point.priceDecimal !== undefined) return point.priceDecimal;
  if (point.priceCents !== undefined) return point.priceCents / 100;
  if (point.priceBps !== undefined) return point.priceBps / 10000;
  if (point.priceTicks !== undefined) return point.priceTicks / 10000;
  return undefined;
};

const sanitizeHistory = (history = []) =>
  history
    .map((point) => {
      const timestamp = resolveTimestamp(point);
      const price = normalizePrice(resolvePrice(point));
      if (!Number.isFinite(timestamp) || price === null) {
        return null;
      }
      return [timestamp, price];
    })
    .filter(Boolean)
    .sort((a, b) => a[0] - b[0]);

const buildSeries = (history = [], fallbackPrice) => {
  const sanitized = sanitizeHistory(history);

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
  if (lower === 'all') {
    return { type: 'all' };
  }
  const match = lower.match(/^(\d+)([hmwdmy])$/);
  if (!match) {
    return null;
  }
  const count = parseInt(match[1], 10);
  const unit = match[2];
  const unitMap = {
    h: 'hour',
    d: 'day',
    w: 'week',
    m: 'month',
    y: 'year'
  };
  return { type: unitMap[unit] || 'day', count };
};

// Smooth easing function for natural heartbeat-like curves
const easeInOutCubic = (t) => {
  return t < 0.5
    ? 4 * t * t * t  // Ease in (cubic acceleration)
    : 1 - Math.pow(-2 * t + 2, 3) / 2;  // Ease out (cubic deceleration)
};

const densifySeries = (series = [], targetPoints = 2000) => {
  if (!series || series.length === 0) {
    return [];
  }

  if (series.length === 1) {
    // If only one point, create a smooth horizontal segment
    const [ts, val] = series[0];
    const now = Date.now();
    const segments = 100;
    const output = [];
    for (let i = 0; i <= segments; i++) {
      const ratio = i / segments;
      const time = ts + (now - ts) * ratio;
      output.push([time, val]);
    }
    return output;
  }

  const output = [];
  const totalSegments = series.length - 1;
  
  // Much more points per segment for ultra-smooth heartbeat-like curves
  const minPointsPerSegment = 150;
  const maxPointsPerSegment = 600;
  const pointsPerSegment = Math.max(
    minPointsPerSegment,
    Math.min(maxPointsPerSegment, Math.ceil(targetPoints / Math.max(1, totalSegments)))
  );
  
  for (let i = 0; i < totalSegments; i++) {
    const [t1, v1] = series[i];
    const [t2, v2] = series[i + 1];
    
    // Always include the first point
    output.push([t1, v1]);

    // Use smooth cubic easing for natural heartbeat-like curves
    // This eliminates blocky/square transitions
    for (let j = 1; j < pointsPerSegment; j++) {
      const ratio = j / pointsPerSegment;
      
      // Apply cubic ease-in-out for smooth acceleration/deceleration
      const easedRatio = easeInOutCubic(ratio);
      
      const ts = t1 + (t2 - t1) * ratio;
      const value = v1 + (v2 - v1) * easedRatio;
      
      output.push([ts, value]);
    }
  }

  // Always include the last point
  output.push(series[series.length - 1]);
  
  return output;
};

const PolymarketChart = ({
  priceHistory = [],
  yesPriceHistory = [],
  noPriceHistory = [],
  currentYesPrice = 0.5,
  currentNoPrice = 0.5,
  accentYes = '#FFE600',
  accentNo = '#7C3AED',
  height = 320,
  selectedRange = 'all',
  onRangeChange = () => {},
  ranges = DEFAULT_RANGES,
  title = 'Dynamic Data & Time Axis'
}) => {
  const [selectedSide, setSelectedSide] = useState('yes'); // 'yes' or 'no'
  // Build YES and NO series independently - ensure they're always separate
  const yesSeries = useMemo(
    () => buildSeries(yesPriceHistory, currentYesPrice),
    [yesPriceHistory, currentYesPrice]
  );

  const noSeries = useMemo(
    () => buildSeries(noPriceHistory, currentNoPrice),
    [noPriceHistory, currentNoPrice]
  );

  // If we have aggregated price history, use it to build both YES and NO
  // Otherwise, use the individual series
  const aggregatedSeries = useMemo(() => sanitizeHistory(priceHistory), [priceHistory]);

  // Build YES and NO line data with synchronized timestamps
  // This ensures lines are always aligned and never overlap
  const { yesLineData, noLineData } = useMemo(() => {
    let yesData = [];
    let noData = [];

    // If we have separate YES and NO series, use them independently
    if (yesSeries.length > 0 && noSeries.length > 0) {
      yesData = densifySeries(yesSeries, 1000);
      noData = densifySeries(noSeries, 1000);
    }
    // If we only have aggregated data, derive both from it
    else if (aggregatedSeries.length > 0) {
      yesData = densifySeries(aggregatedSeries, 1000);
      noData = densifySeries(
        aggregatedSeries.map(([ts, val]) => [ts, 1 - val]),
        1000
      );
    }
    // Fallback: use individual series if available
    else {
      if (yesSeries.length > 0) {
        yesData = densifySeries(yesSeries, 1000);
      }
      if (noSeries.length > 0) {
        noData = densifySeries(noSeries, 1000);
      }
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

    const formatSeriesData = (lineData) =>
      lineData.map(([ts, value]) => {
        const numericValue = Number(value || 0) * 100;
        return {
          value: [ts, Math.max(0, Math.min(100, numericValue))],
          actual: Math.max(0, Math.min(100, numericValue))
        };
      });

    const yesData = formatSeriesData(yesLineData);
    const noData = formatSeriesData(noLineData);

    // Calculate time range
    const allTimestamps = [
      ...yesData.map((point) => point.value[0]),
      ...noData.map((point) => point.value[0])
    ].filter(Number.isFinite);
    const minTime = allTimestamps.length > 0 ? Math.min(...allTimestamps) : Date.now() - 86400000;
    const maxTime = allTimestamps.length > 0 ? Math.max(...allTimestamps) : Date.now();

    const latestYes = yesData.length ? yesData[yesData.length - 1].actual : 0;
    const latestNo = noData.length ? noData[noData.length - 1].actual : 0;

    // Show only the selected side (YES or NO)
    const activeSeries = selectedSide === 'yes' && yesData.length
      ? {
          key: 'YES',
          color: accentYes,
          data: yesData,
          latest: latestYes
        }
      : noData.length
      ? {
          key: 'NO',
          color: accentNo,
          data: noData,
          latest: latestNo
        }
      : null;

    if (!activeSeries) {
      return null; // No data to show
    }

    // Convert hex to rgba for area fill
    const hexToRgba = (hex, alpha) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    // Polymarket-style: area fills under line, smooth curves
    const series = [
      {
        name: activeSeries.key,
        type: 'line',
        smooth: true, // Ultra-smooth curves with bezier interpolation
        symbol: 'none',
        showSymbol: false,
        step: false,
        sampling: false, // Disable sampling to use all densified points
        lineStyle: {
          width: 2.5,
          color: activeSeries.color,
          type: 'solid'
        },
        // Polymarket-style area fills
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: hexToRgba(activeSeries.color, 0.25) },
              { offset: 0.5, color: hexToRgba(activeSeries.color, 0.15) },
              { offset: 1, color: hexToRgba(activeSeries.color, 0.05) }
            ]
          }
        },
        emphasis: {
          focus: 'series',
          lineStyle: {
            width: 3.5,
            shadowBlur: 12,
            shadowColor: activeSeries.color
          },
          areaStyle: {
            opacity: 0.4
          }
        },
        data: activeSeries.data
      }
    ];

    return {
      backgroundColor: 'transparent',
      animation: true,
      animationDuration: 600,
      grid: {
        left: '10%',
        right: '10%',
        top: '20%',
        bottom: '15%',
        containLabel: false
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
        textStyle: {
          color: '#fff',
          fontSize: 12
        },
        axisPointer: {
          type: 'line',
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.3)',
            type: 'solid',
            width: 1
          }
        },
        formatter: function(params) {
          if (!params || params.length === 0) return '';
          let result = `<div style="padding: 4px 0 6px 0; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.1);">${params[0].axisValueLabel}</div>`;
          params.forEach((item) => {
            const value = Array.isArray(item.value) ? item.value[1] : item.value;
            result += `<div style="display: flex; align-items: center; padding: 4px 0;">
              <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${item.color}; margin-right: 8px;"></span>
              <span style="color: #fff;">${item.seriesName}: <span style="color: ${item.color}; font-weight: 600;">${Number(value).toFixed(2)}%</span></span>
            </div>`;
          });
          return result;
        }
      },
      legend: {
        show: false // Hide legend since we have toggle buttons
      },
      xAxis: {
        type: 'time',
        boundaryGap: false,
        axisLine: {
          show: true,
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.15)',
            width: 1
          }
        },
        axisLabel: {
          show: true,
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: 11,
          formatter: function(value) {
            const date = new Date(value);
            const month = date.toLocaleString('default', { month: 'short' });
            const day = date.getDate();
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `${month} ${day} ${hours}:${minutes}`;
          }
        },
        splitLine: {
          show: false
        },
        min: minTime,
        max: maxTime
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        interval: 20,
        scale: false,
        position: 'right',
        axisLine: {
          show: true,
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.15)',
            width: 1
          }
        },
        axisLabel: {
          show: true,
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: 11,
          formatter: (val) => `${val}%`
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.08)',
            type: 'solid',
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
    <div className="mb-4 flex items-center justify-between">
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
    <div className="glass-card w-full rounded-[24px] border border-white/20 backdrop-blur-xl p-6" style={{ background: 'rgba(12,12,12,0.55)' }}>
      {renderControls()}
      <div className="overflow-hidden rounded-[16px]" style={{ height }}>
        <ReactECharts option={chartOptions} style={{ height, width: '100%' }} />
        </div>
    </div>
  );
};

export default PolymarketChart;

