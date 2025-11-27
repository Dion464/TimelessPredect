import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';

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

const densifySeries = (series = [], targetPoints = 800) => {
  if (!series || series.length === 0) {
    return [];
  }

  if (series.length === 1) {
    // If only one point, create a small horizontal segment
    const [ts, val] = series[0];
    const now = Date.now();
    return [
      [ts - 3600000, val], // 1 hour before
      [ts, val],
      [now, val] // Current time
    ];
  }

  const output = [];
  const totalSegments = series.length - 1;
  
  // More points per segment for ultra-smooth lines
  const minPointsPerSegment = 20;
  const maxPointsPerSegment = 100;
  const pointsPerSegment = Math.max(
    minPointsPerSegment,
    Math.min(maxPointsPerSegment, Math.ceil(targetPoints / Math.max(1, totalSegments)))
  );
  
  for (let i = 0; i < totalSegments; i++) {
    const [t1, v1] = series[i];
    const [t2, v2] = series[i + 1];
    
    // Always include the first point
    output.push([t1, v1]);

    // Use smooth interpolation (easing function) for natural curves
    for (let j = 1; j < pointsPerSegment; j++) {
      const ratio = j / pointsPerSegment;
      
      // Smooth easing function for natural-looking transitions
      const easedRatio = ratio < 0.5
        ? 2 * ratio * ratio
        : 1 - Math.pow(-2 * ratio + 2, 2) / 2;
      
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
  accentYes = '#4B7CFD',
  accentNo = '#9C4BFD',
  height = 320,
  selectedRange = 'all',
  onRangeChange = () => {},
  ranges = DEFAULT_RANGES,
  title = 'Dynamic Data & Time Axis'
}) => {
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

    const sortedSeries = [
      yesData.length
        ? {
            key: 'YES',
            color: accentYes,
            data: yesData,
            latest: latestYes
          }
        : null,
      noData.length
        ? {
            key: 'NO',
            color: accentNo,
            data: noData,
            latest: latestNo
          }
        : null
    ]
      .filter(Boolean)
      .sort((a, b) => a.latest - b.latest); // Smaller value drawn first, largest on top

    // Ensure lines are always visually separated and the higher value is more prominent
    const series = sortedSeries.map((seriesItem, idx) => {
      const isTopLine = idx === sortedSeries.length - 1; // Higher value line
      
      return {
        name: seriesItem.key,
        type: 'line',
        smooth: 0.7, // Smoother curves
        symbol: 'none',
        showSymbol: false,
        step: false, // No step transitions - smooth lines only
        sampling: 'average', // Better sampling for smooth lines
        zlevel: isTopLine ? 10 : 5, // Higher value line on top
        z: isTopLine ? 100 : 50,
        lineStyle: {
          width: isTopLine ? 3.5 : 2.5, // Top line is thicker and more visible
          color: seriesItem.color,
          type: 'solid' // Solid lines, no dashes
        },
        // NO area fills - they cause overlap and clutter
        emphasis: {
          focus: 'series',
          lineStyle: {
            width: isTopLine ? 4.5 : 3.5,
            shadowBlur: 10,
            shadowColor: seriesItem.color
          }
        },
        endLabel: {
          show: true,
          formatter: (params) => {
            const val = Array.isArray(params.value) ? params.value[1] : params.value;
            return `${seriesItem.key} ${Number(val).toFixed(1)}%`;
          },
          color: seriesItem.color,
          fontSize: 11,
          fontWeight: isTopLine ? 'bold' : 'normal',
          padding: [2, 8, 2, 8],
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          borderColor: seriesItem.color,
          borderWidth: 1.5,
          borderRadius: 4
        },
        data: seriesItem.data
      };
    });

    return {
      backgroundColor: '#ffffff',
      animation: true,
      animationDuration: 750,
      grid: {
        left: '8%',
        right: '12%', // More space on right for end labels
        top: '12%',
        bottom: '12%',
        containLabel: true
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        borderColor: 'rgba(255, 255, 255, 0.25)',
        borderWidth: 1,
        textStyle: {
          color: '#fff',
          fontSize: 12
        },
        axisPointer: {
          type: 'cross',
          lineStyle: {
            color: '#999',
            type: 'dashed'
          },
          crossStyle: {
            color: '#999'
          }
        },
        formatter: function(params) {
          if (!params || params.length === 0) return '';
          let result = `<div style="padding: 4px 0; font-weight: 600;">${params[0].axisValueLabel}</div>`;
          params.forEach((item) => {
            const value = Array.isArray(item.value) ? item.value[1] : item.value;
            result += `<div style="display: flex; align-items: center; padding: 2px 0;">
              <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${item.color}; margin-right: 6px;"></span>
              <span style="color: ${item.color};">${item.seriesName}: ${Number(value).toFixed(2)}%</span>
            </div>`;
          });
          return result;
        }
      },
      legend: {
        data: ['YES', 'NO'],
        left: 'center',
        top: '5%',
        textStyle: {
          color: '#333',
          fontSize: 12,
          fontWeight: 'normal'
        },
        itemGap: 30,
        itemWidth: 25,
        itemHeight: 14
      },
      xAxis: {
        type: 'time',
        boundaryGap: false,
        axisLine: {
          show: true,
          lineStyle: {
            color: '#999',
            width: 1
          }
        },
        axisLabel: {
          show: true,
          color: '#666',
          fontSize: 11,
          formatter: function(value) {
            const date = new Date(value);
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `${hours}:${minutes}`;
          }
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: '#f0f0f0',
            type: 'dashed'
          }
        },
        min: minTime,
        max: maxTime
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        interval: 20,
        scale: false, // Don't auto-scale - always show 0-100% for clear separation
        axisLine: {
          show: true,
          lineStyle: {
            color: '#ccc',
            width: 1
          }
        },
        axisLabel: {
          show: true,
          color: '#666',
          fontSize: 11,
          formatter: (val) => `${val}%`
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: '#f5f5f5',
            type: 'solid',
            width: 1
          }
        }
      },
      series
    };
  }, [accentNo, accentYes, hasData, noLineData, yesLineData]);

  if (!hasData || !chartOptions) {
  return (
      <div
        className="flex items-center justify-center rounded-2xl border border-white/5 bg-[#08142a] text-sm text-slate-400"
        style={{ height }}
      >
        No price data available yet
          </div>
    );
  }

  const renderRangeButtons = () => (
    <div className="mb-3 flex items-center gap-2 text-xs font-medium text-gray-600">
      <span className="text-gray-700">Zoom</span>
      {rangeButtons.map((btn, index) => {
        const isActive = index === selectedRangeIndex;
        return (
          <button
            key={btn.text + btn.dataRangeValue}
            onClick={() => onRangeChange?.(btn.dataRangeValue)}
            className={`px-3 py-1.5 rounded transition-colors text-xs font-medium ${
              isActive
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {btn.text}
          </button>
        );
      })}
        </div>
  );

  return (
    <div className="w-full rounded-lg border border-gray-200 bg-gray-50 px-6 py-5 shadow-sm">
      <div className="mb-3 text-center text-sm font-semibold text-gray-700 uppercase tracking-wide">
        {title}
      </div>
      {renderRangeButtons()}
      <div className="overflow-hidden rounded-lg bg-white border border-gray-100">
        <ReactECharts option={chartOptions} style={{ height, width: '100%' }} />
        </div>
    </div>
  );
};

export default PolymarketChart;

