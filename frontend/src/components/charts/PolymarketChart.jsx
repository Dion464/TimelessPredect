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
  height = 300,
  selectedRange = '24h',
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
    if (!hasData) {
      return null;
    }

    const series = [];

    if (yesSeries.length) {
      series.push({
        type: 'line',
        name: 'YES',
        data: yesSeries,
        color: '#FFE600',
        lineWidth: 3,
        tooltip: { valueDecimals: 4, valueSuffix: ' TCENT' },
        states: {
          hover: { lineWidth: 4 }
        },
        showInNavigator: true
      });
    }

    if (noSeries.length) {
      series.push({
        type: 'line',
        name: 'NO',
        data: noSeries,
        color: '#7C3AED',
        lineWidth: 2,
        dashStyle: 'ShortDash',
        tooltip: { valueDecimals: 4, valueSuffix: ' TCENT' },
        showInNavigator: true
      });
    }

    if (aggregatedSeries.length) {
      series.push({
        type: 'areaspline',
        name: 'Volume-weighted',
        data: aggregatedSeries,
        color: 'rgba(255,255,255,0.25)',
        fillOpacity: 0.08,
        lineWidth: 1.5,
        tooltip: { valueDecimals: 4, valueSuffix: ' TCENT' },
        showInNavigator: false
      });
    }

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
        backgroundColor: 'transparent',
        height
      },
      credits: { enabled: false },
      legend: {
        enabled: true,
        align: 'right',
        verticalAlign: 'top',
        itemStyle: { color: '#e5e7eb', fontWeight: '500' }
      },
      rangeSelector: {
        selected: selectedRangeIndex,
        buttonTheme: {
          fill: 'rgba(255,255,255,0.06)',
          stroke: 'rgba(255,255,255,0.12)',
          r: 12,
          style: { color: '#d1d5db', fontWeight: 500 },
          states: {
            hover: { fill: 'rgba(255,255,255,0.12)', style: { color: '#fff' } },
            select: {
              fill: 'rgba(255, 230, 0, 0.15)',
              style: { color: '#FFE600', fontWeight: 600 }
            }
          }
        },
        inputEnabled: false,
        buttons: buttonConfigs
      },
      navigator: {
        maskFill: 'rgba(255, 230, 0, 0.08)',
        outlineColor: 'rgba(255,255,255,0.1)',
        series: {
          color: 'rgba(255, 230, 0, 0.6)',
          lineWidth: 1
        }
      },
      scrollbar: { enabled: false },
      xAxis: {
        type: 'datetime',
        lineColor: 'rgba(255,255,255,0.08)',
        tickColor: 'rgba(255,255,255,0.08)',
        labels: {
          style: { color: '#9ca3af', fontSize: '11px' }
        }
      },
      yAxis: {
        min: 0,
        max: 1,
        gridLineColor: 'rgba(255,255,255,0.05)',
        labels: {
          style: { color: '#9ca3af', fontSize: '11px' },
          formatter() {
            return `${this.value.toFixed(2)} TCENT`;
          }
        },
        title: { text: null }
      },
      tooltip: {
        shared: true,
        backgroundColor: 'rgba(15,15,15,0.9)',
        borderColor: 'rgba(255,255,255,0.1)',
        style: { color: '#f9fafb', fontSize: '12px' },
        formatter() {
          const header = `<span style="font-size:11px;color:#9ca3af">${Highcharts.dateFormat(
            '%A, %b %e • %H:%M',
            this.x
          )}</span>`;
          const points = (this.points || [])
            .map(
              (point) =>
                `<span style="color:${point.color}">●</span> ${point.series.name}: <b>${point.y.toFixed(
                  4
                )} TCENT</b>`
            )
            .join('<br/>');
          return `${header}<br/>${points}`;
        }
      },
      plotOptions: {
        series: {
          dataGrouping: {
            enabled: true,
            approximation: 'average'
          },
          marker: {
            enabled: false
          }
        }
      },
      series
    };
  }, [
    aggregatedSeries,
    hasData,
    height,
    noSeries,
    onRangeChange,
    rangeButtons,
    selectedRangeIndex,
    yesSeries
  ]);

  if (!hasData || !chartOptions) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm text-gray-300"
        style={{ height }}
      >
        No price data available yet
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-black/10 p-2 backdrop-blur-xl">
      <HighchartsReact
        highcharts={Highcharts}
        constructorType="stockChart"
        options={chartOptions}
      />
    </div>
  );
};

export default PolymarketChart;

