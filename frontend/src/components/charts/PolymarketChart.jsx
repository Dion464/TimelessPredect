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

const densifySeries = (series = [], targetPoints = 500) => {
  if (!series || series.length === 0) {
    return [];
  }

  if (series.length === 1) {
    // If only one point, duplicate it to create a flat line
    return [series[0], [Date.now(), series[0][1]]];
  }

  const output = [];
  const totalSegments = series.length - 1;
  
  // Calculate how many points we need per segment to reach target
  const pointsPerSegment = Math.max(10, Math.ceil(targetPoints / Math.max(1, totalSegments)));
  
  for (let i = 0; i < totalSegments; i++) {
    const [t1, v1] = series[i];
    const [t2, v2] = series[i + 1];
    
    // Always include the first point
    output.push([t1, v1]);

    // Add interpolated points between t1 and t2
    const segmentLength = t2 - t1;
    const timeStep = segmentLength / pointsPerSegment;
    
    for (let j = 1; j < pointsPerSegment; j++) {
      const ratio = j / pointsPerSegment;
      const ts = t1 + (segmentLength * ratio);
      const value = v1 + (v2 - v1) * ratio;
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

  // Build YES line data - prioritize yesPriceHistory, fallback to aggregated
  const yesLineData = useMemo(() => {
    if (yesSeries.length > 0) {
      return densifySeries(yesSeries, 600);
    }
    if (aggregatedSeries.length > 0) {
      return densifySeries(aggregatedSeries, 600);
    }
    return [];
  }, [yesSeries, aggregatedSeries]);

  // Build NO line data - prioritize noPriceHistory, fallback to inverse of aggregated
  const noLineData = useMemo(() => {
    if (noSeries.length > 0) {
      return densifySeries(noSeries, 600);
    }
    if (aggregatedSeries.length > 0) {
      // NO = 1 - YES when we only have aggregated data
      const invertedSeries = aggregatedSeries.map(([ts, val]) => [ts, 1 - val]);
      return densifySeries(invertedSeries, 600);
    }
    return [];
  }, [noSeries, aggregatedSeries]);

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

    const series = sortedSeries.map((seriesItem, idx) => ({
      name: seriesItem.key,
      type: 'line',
      smooth: 0.65,
      symbol: 'none',
      showSymbol: false,
      sampling: 'lttb',
      zlevel: idx,
      z: idx + 1,
      lineStyle: {
        width: idx === sortedSeries.length - 1 ? 3 : 2,
        color: seriesItem.color,
        shadowColor: `${seriesItem.color}55`,
        shadowBlur: 8
      },
      areaStyle: {
        opacity: idx === sortedSeries.length - 1 ? 0.12 : 0.08,
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: `${seriesItem.color}33` },
            { offset: 1, color: `${seriesItem.color}00` }
          ]
        }
      },
      emphasis: {
        focus: 'series',
        lineStyle: {
          width: 3.5
        }
      },
      endLabel: {
        show: true,
        formatter: (params) => `${seriesItem.key} ${params.value[1].toFixed(2)}%`,
        color: seriesItem.color,
        fontSize: 11,
        padding: [0, 8],
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderColor: `${seriesItem.color}55`,
        borderWidth: 1,
        borderRadius: 6
      },
      data: seriesItem.data
    }));

    return {
      backgroundColor: '#ffffff',
      animation: true,
      animationDuration: 750,
      grid: {
        left: '10%',
        right: '8%',
        top: '15%',
        bottom: '15%',
        containLabel: false
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
          formatter: (val) => `${val}%`
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: '#f0f0f0',
            type: 'dashed'
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

