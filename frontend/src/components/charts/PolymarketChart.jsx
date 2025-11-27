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

const PolymarketChart = ({
  priceHistory = [],
  yesPriceHistory = [],
  noPriceHistory = [],
  currentYesPrice = 0.5,
  currentNoPrice = 0.5,
  accentYes = '#FFE600',
  accentNo = '#7C3AED',
  backgroundColor = '#081128',
  height = 320,
  selectedRange = 'all',
  onRangeChange = () => {},
  ranges = DEFAULT_RANGES
}) => {
  const yesSeries = useMemo(
    () => buildSeries(yesPriceHistory, currentYesPrice),
    [yesPriceHistory, currentYesPrice]
  );

  const noSeries = useMemo(
    () => buildSeries(noPriceHistory, currentNoPrice),
    [noPriceHistory, currentNoPrice]
  );

  const aggregatedSeries = useMemo(() => sanitizeHistory(priceHistory), [priceHistory]);

  const probabilityCurve = useMemo(() => {
    if (aggregatedSeries.length) return aggregatedSeries;
    if (yesSeries.length) return yesSeries;
    if (noSeries.length) {
      return noSeries.map(([ts, val]) => [ts, 1 - val]);
    }
    return [];
  }, [aggregatedSeries, yesSeries, noSeries]);

  const yesLineData = yesSeries.length ? yesSeries : probabilityCurve;
  const noLineData = noSeries.length
    ? noSeries
    : probabilityCurve.map(([ts, val]) => [ts, 1 - val]).filter(Boolean);

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

    const yesData = yesLineData.map(([ts, value]) => [ts, Number(value || 0) * 100]);
    const noData = noLineData.map(([ts, value]) => [ts, Number(value || 0) * 100]);

    return {
      backgroundColor,
      grid: { left: 40, right: 16, top: 32, bottom: 32 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(6,11,24,0.95)',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#f1f5f9', fontSize: 12 },
        axisPointer: { type: 'line' },
        valueFormatter: (val) => `${Number(val).toFixed(2)}%`
      },
      legend: {
        data: ['YES', 'NO'],
        left: 24,
        top: 0,
        textStyle: { color: '#94a3b8', fontWeight: 600 }
      },
      xAxis: {
        type: 'time',
        boundaryGap: false,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
        axisLabel: { color: '#6f819f', fontSize: 11, fontWeight: 500 },
        splitLine: { show: true, lineStyle: { color: 'rgba(255,255,255,0.03)' } }
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        axisLabel: {
          color: '#6f819f',
          fontSize: 11,
          formatter: (val) => `${val}%`
        },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } }
      },
      animation: true,
      series: [
        yesData.length
          ? {
              name: 'YES',
              type: 'line',
              smooth: true,
              showSymbol: false,
              lineStyle: { color: accentYes, width: 3 },
              areaStyle: {
                opacity: 0.08,
                color: accentYes
              },
              data: yesData
            }
          : null,
        noData.length
          ? {
              name: 'NO',
              type: 'line',
              smooth: true,
              showSymbol: false,
              lineStyle: { color: accentNo, width: 2 },
              areaStyle: {
                opacity: 0.05,
                color: accentNo
              },
              data: noData
            }
          : null
      ].filter(Boolean)
    };
  }, [accentNo, accentYes, backgroundColor, hasData, noLineData, yesLineData]);

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
    <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-[#6e7ea3]">
      <span>Zoom</span>
      {rangeButtons.map((btn, index) => {
        const isActive = index === selectedRangeIndex;
        return (
          <button
            key={btn.text + btn.dataRangeValue}
            onClick={() => onRangeChange?.(btn.dataRangeValue)}
            className={`rounded-full px-3 py-1 transition ${
              isActive ? 'bg-[#172040] text-white' : 'bg-[#0d152c] text-[#7c8bb6]'
            }`}
          >
            {btn.text}
          </button>
        );
      })}
        </div>
  );

  return (
    <div className="w-full rounded-2xl border border-white/5 bg-[#050c1c] px-3 py-4 shadow-lg shadow-black/30">
      {renderRangeButtons()}
      <div className="overflow-hidden rounded-xl border border-white/5 bg-[#07122c]">
        <ReactECharts option={chartOptions} style={{ height }} />
      </div>
    </div>
  );
};

export default PolymarketChart;

