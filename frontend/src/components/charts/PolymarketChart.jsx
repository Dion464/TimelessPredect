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

const densifySeries = (series = [], targetPoints = 240) => {
  if (!series || series.length < 2) {
    return series || [];
  }

  const totalSegments = series.length - 1;
  const pointsPerSegment = Math.max(2, Math.floor(targetPoints / totalSegments));
  const output = [];

  for (let i = 0; i < totalSegments; i++) {
    const [t1, v1] = series[i];
    const [t2, v2] = series[i + 1];
    output.push([t1, v1]);

    const segmentLength = t2 - t1;
    for (let j = 1; j < pointsPerSegment; j++) {
      const ratio = j / pointsPerSegment;
      const ts = t1 + segmentLength * ratio;
      const value = v1 + (v2 - v1) * ratio;
      output.push([ts, value]);
    }
  }

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
  const yesSeries = useMemo(
    () => buildSeries(yesPriceHistory, currentYesPrice),
    [yesPriceHistory, currentYesPrice]
  );

  const noSeries = useMemo(
    () => buildSeries(noPriceHistory, currentNoPrice),
    [noPriceHistory, currentNoPrice]
  );

  const aggregatedSeries = useMemo(() => sanitizeHistory(priceHistory), [priceHistory]);

  const baseCurve = useMemo(() => {
    if (aggregatedSeries.length) return aggregatedSeries;
    if (yesSeries.length) return yesSeries;
    if (noSeries.length) {
      return noSeries.map(([ts, val]) => [ts, 1 - val]);
    }
    return [];
  }, [aggregatedSeries, yesSeries, noSeries]);

  const denseBase = useMemo(() => densifySeries(baseCurve, 240), [baseCurve]);

  const yesLineData = denseBase.length ? denseBase : densifySeries(yesSeries, 120);
  const noLineData =
    denseBase.length > 0
      ? denseBase.map(([ts, val]) => [ts, 1 - val]).filter(Boolean)
      : densifySeries(
          noSeries.map(([ts, val]) => [ts, val]),
          120
        );

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
      backgroundColor: '#f9faff',
      animation: true,
      animationDuration: 600,
      grid: { left: 50, right: 24, top: 40, bottom: 50 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        borderColor: 'rgba(148, 163, 184, 0.4)',
        textStyle: { color: '#f8fafc', fontSize: 12 },
        axisPointer: { type: 'line' },
        valueFormatter: (val) => `${Number(val).toFixed(2)}%`
      },
      legend: {
        data: ['YES', 'NO'],
        left: 'center',
        top: 0,
        textStyle: { color: '#475569', fontSize: 12, fontWeight: 600 }
      },
      xAxis: {
        type: 'time',
        boundaryGap: false,
        axisLine: { show: true, lineStyle: { color: '#cbd5f5' } },
        axisLabel: {
          show: true,
          color: '#94a3b8',
          fontSize: 11
        },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        axisLine: { show: true, lineStyle: { color: '#cbd5f5' } },
        axisLabel: {
          show: true,
          color: '#94a3b8',
          fontSize: 11,
          formatter: (val) => `${val}%`
        },
        splitLine: { show: true, lineStyle: { color: '#e2e8f0' } }
      },
      series: [
        yesData.length > 0
          ? {
              name: 'YES',
              type: 'line',
              smooth: true,
              symbol: 'none',
              lineStyle: { width: 2.5, color: accentYes },
              data: yesData
            }
          : null,
        noData.length > 0
          ? {
              name: 'NO',
              type: 'line',
              smooth: true,
              symbol: 'none',
              lineStyle: { width: 2.5, color: accentNo },
              data: noData
            }
          : null
      ].filter(Boolean)
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
    <div className="w-full rounded-3xl border border-[#e1e5f7] bg-[#f4f6ff] px-6 py-5 shadow-sm">
      <div className="mb-3 text-center text-sm font-semibold text-[#475569] uppercase tracking-wide">
        {title}
      </div>
      {renderRangeButtons()}
      <div className="overflow-hidden rounded-2xl bg-white shadow-inner shadow-[#d9e0ff]">
        <ReactECharts option={chartOptions} style={{ height, width: '100%' }} />
        </div>
    </div>
  );
};

export default PolymarketChart;

