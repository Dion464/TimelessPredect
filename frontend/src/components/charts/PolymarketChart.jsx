import React, { useMemo } from 'react';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';

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
  headlineLabel = 'chance',
  headlineValue,
  changePercent = 0,
  accentColor = '#3BB8FF',
  backgroundColor = '#08142a',
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

  const aggregatedSeries = useMemo(
    () => sanitizeHistory(priceHistory),
    [priceHistory]
  );

  const hasData = yesSeries.length > 0 || noSeries.length > 0 || aggregatedSeries.length > 0;

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

    const buttonConfigs = rangeButtons.map((btn) => ({
      ...btn,
      events: {
        click() {
          if (typeof onRangeChange === 'function' && btn.dataRangeValue) {
            onRangeChange(btn.dataRangeValue);
          }
        }
      }
    }));

    return {
      chart: {
        backgroundColor,
        height,
        spacing: [16, 0, 0, 0]
      },
      credits: { enabled: false },
      legend: { enabled: false },
      rangeSelector: {
        selected: selectedRangeIndex,
        buttonTheme: {
          fill: 'rgba(255,255,255,0.04)',
          stroke: 'transparent',
          r: 6,
          style: { color: '#91A6C9', fontWeight: 600 },
          states: {
            hover: { fill: 'rgba(255,255,255,0.08)' },
            select: {
              fill: 'rgba(59, 184, 255, 0.18)',
              style: { color: '#3BB8FF' }
            }
          }
        },
        labelStyle: { color: '#7485a8', fontWeight: 500 },
        inputEnabled: false,
        buttons: buttonConfigs
      },
      navigator: { enabled: false },
      scrollbar: { enabled: false },
      xAxis: {
        type: 'datetime',
        lineColor: 'rgba(255,255,255,0.05)',
        tickColor: 'rgba(255,255,255,0.05)',
        gridLineColor: 'rgba(255,255,255,0.03)',
        labels: {
          style: { color: '#6f819f', fontSize: '11px', fontWeight: 500 }
        }
      },
      yAxis: {
        min: 0,
        max: 1,
        tickAmount: 5,
        gridLineColor: 'rgba(255,255,255,0.04)',
        title: { text: '' },
        labels: {
          style: { color: '#6f819f', fontSize: '11px', fontWeight: 500 },
          formatter() {
            return `${(this.value * 100).toFixed(0)}%`;
          }
        }
      },
      tooltip: {
        shared: true,
        backgroundColor: 'rgba(7,12,26,0.95)',
        borderColor: 'rgba(255,255,255,0.08)',
        style: { color: '#f0f4ff', fontSize: '12px' },
        formatter() {
          const header = `<span style="font-size:11px;color:#94a3b8">${Highcharts.dateFormat(
            '%b %e, %Y • %H:%M',
            this.x
          )}</span>`;
          const points = (this.points || [])
            .map(
              (point) =>
                `${(point.y * 100).toFixed(2)}%`
            )
            .join('<br/>');
          return `${header}<br/><span style="font-size:14px;font-weight:600">${points}</span>`;
        }
      },
      plotOptions: {
        series: {
          dataGrouping: { enabled: true, approximation: 'average' },
          marker: { enabled: false }
        }
      },
      series: [
        yesSeries.length
          ? {
              type: 'areaspline',
              name: 'YES',
              data: yesSeries,
              color: '#FFE600',
              lineWidth: 3,
              fillColor: {
                linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
                stops: [
                  [0, Highcharts.color('#FFE600').setOpacity(0.2).get('rgba')],
                  [1, 'rgba(255,230,0,0)']
                ]
              }
            }
          : null,
        noSeries.length
          ? {
              type: 'areaspline',
              name: 'NO',
              data: noSeries,
              color: '#7C3AED',
              lineWidth: 2,
              fillColor: {
                linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
                stops: [
                  [0, Highcharts.color('#7C3AED').setOpacity(0.15).get('rgba')],
                  [1, 'rgba(124,58,237,0)']
                ]
              }
            }
          : null,
        aggregatedSeries.length
          ? {
              type: 'line',
              name: 'Aggregate',
              data: aggregatedSeries,
              color: Highcharts.color(accentColor).setOpacity(0.6).get('rgba'),
              lineWidth: 1.5,
              dashStyle: 'ShortDash'
            }
          : null
      ].filter(Boolean)
    };
  }, [
    accentColor,
    backgroundColor,
    aggregatedSeries,
    hasData,
    height,
    onRangeChange,
    noSeries,
    rangeButtons,
    selectedRangeIndex,
    yesSeries
  ]);

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

  const fallbackSeries = yesSeries.length ? yesSeries : noSeries.length ? noSeries : aggregatedSeries;
  const displayValue =
    typeof headlineValue === 'number'
      ? headlineValue
      : (fallbackSeries[fallbackSeries.length - 1]?.[1] || 0) * 100;

  const changeColor = changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400';

  return (
    <div className="w-full rounded-2xl border border-white/5 bg-[#050c1c] px-4 py-5 shadow-lg shadow-black/30">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.35em] text-[#5a6b8f]">{headlineLabel}</p>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-4xl font-semibold text-white">
              {Number(displayValue).toFixed(0)}%
            </span>
            <span className={`text-sm font-semibold ${changeColor}`}>
              {changePercent >= 0 ? '+' : ''}
              {changePercent.toFixed(0)}%
            </span>
          </div>
        </div>
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5a6b8f]">
          Polymarket
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-white/5">
        <HighchartsReact
          highcharts={Highcharts}
          constructorType="stockChart"
          options={chartOptions}
        />
        </div>
    </div>
  );
};

export default PolymarketChart;

