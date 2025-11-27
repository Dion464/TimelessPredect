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

    // Calculate time range for dataZoom
    const allTimestamps = [...yesData, ...noData].map(([ts]) => ts).filter(Number.isFinite);
    const minTime = allTimestamps.length > 0 ? Math.min(...allTimestamps) : Date.now() - 86400000;
    const maxTime = allTimestamps.length > 0 ? Math.max(...allTimestamps) : Date.now();

    return {
      backgroundColor: 'transparent',
      animation: true,
      animationDuration: 750,
      grid: [
        {
          left: '3%',
          right: '4%',
          top: '10%',
          bottom: '15%',
          containLabel: false
        }
      ],
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
        textStyle: {
          color: '#fff',
          fontSize: 12
        },
        axisPointer: {
          type: 'cross',
          label: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)'
          }
        },
        formatter: function(params) {
          let result = `<div style="padding: 4px 0;">${params[0].axisValueLabel}</div>`;
          params.forEach((item) => {
            result += `<div style="display: flex; align-items: center; padding: 2px 0;">
              <span style="display: inline-block; width: 10px; height: 2px; background: ${item.color}; margin-right: 6px;"></span>
              <span style="color: ${item.color};">${item.seriesName}: ${Number(item.value[1] || item.value).toFixed(2)}%</span>
            </div>`;
          });
          return result;
        }
      },
      legend: {
        data: ['YES', 'NO'],
        left: 'center',
        top: 0,
        textStyle: {
          color: '#94a3b8',
          fontSize: 12,
          fontWeight: 600
        },
        itemGap: 20
      },
      dataZoom: [
        {
          type: 'slider',
          show: true,
          xAxisIndex: [0],
          start: 0,
          end: 100,
          bottom: '2%',
          height: 20,
          borderColor: 'rgba(255,255,255,0.1)',
          fillerColor: 'rgba(255,255,255,0.1)',
          handleIcon: 'path://M30.9,53.2C16.8,53.2,5.3,41.7,5.3,27.6S16.8,2,30.9,2C45,2,56.4,13.5,56.4,27.6S45,53.2,30.9,53.2z M30.9,3.5C17.6,3.5,6.8,14.4,6.8,27.6c0,13.3,10.8,24.1,24.1,24.1C44.2,51.7,55,40.9,55,27.6C54.9,14.4,44.1,3.5,30.9,3.5z M36.9,35.8c0,0.6-0.4,1-1,1H26.8c-0.6,0-1-0.4-1-1V19.5c0-0.6,0.4-1,1-1h9.2c0.6,0,1,0.4,1,1V35.8z',
          handleSize: '80%',
          handleStyle: {
            color: '#fff',
            borderColor: 'rgba(255,255,255,0.5)'
          },
          textStyle: {
            color: '#6f819f',
            fontSize: 10
          }
        },
        {
          type: 'inside',
          xAxisIndex: [0],
          start: 0,
          end: 100
        }
      ],
      xAxis: {
        type: 'time',
        boundaryGap: false,
        axisLine: {
          show: true,
          lineStyle: {
            color: 'rgba(255,255,255,0.15)',
            width: 1
          }
        },
        axisLabel: {
          show: true,
          color: '#6f819f',
          fontSize: 11,
          fontWeight: 500,
          formatter: function(value) {
            const date = new Date(value);
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `${hours}:${minutes}`;
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
        axisLine: {
          show: true,
          lineStyle: {
            color: 'rgba(255,255,255,0.15)',
            width: 1
          }
        },
        axisLabel: {
          show: true,
          color: '#6f819f',
          fontSize: 11,
          formatter: (val) => `${val}%`
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: 'rgba(255,255,255,0.06)',
            type: 'dashed',
            width: 1
          }
        }
      },
      series: [
        yesData.length > 0
          ? {
              name: 'YES',
              type: 'line',
              smooth: 0.6,
              symbol: 'none',
              sampling: 'lttb',
              itemStyle: {
                color: accentYes
              },
              areaStyle: {
                color: {
                  type: 'linear',
                  x: 0,
                  y: 0,
                  x2: 0,
                  y2: 1,
                  colorStops: [
                    {
                      offset: 0,
                      color: accentYes + '33'
                    },
                    {
                      offset: 1,
                      color: accentYes + '00'
                    }
                  ]
                }
              },
              lineStyle: {
                width: 2.5,
                color: accentYes
              },
              emphasis: {
                focus: 'series'
              },
              data: yesData
            }
          : null,
        noData.length > 0
          ? {
              name: 'NO',
              type: 'line',
              smooth: 0.6,
              symbol: 'none',
              sampling: 'lttb',
              itemStyle: {
                color: accentNo
              },
              areaStyle: {
                color: {
                  type: 'linear',
                  x: 0,
                  y: 0,
                  x2: 0,
                  y2: 1,
                  colorStops: [
                    {
                      offset: 0,
                      color: accentNo + '33'
                    },
                    {
                      offset: 1,
                      color: accentNo + '00'
                    }
                  ]
                }
              },
              lineStyle: {
                width: 2.5,
                color: accentNo
              },
              emphasis: {
                focus: 'series'
              },
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
    <div className="w-full rounded-2xl border border-white/5 bg-[#050c1c] px-3 py-4 shadow-lg shadow-black/30">
      {renderRangeButtons()}
      <div className="overflow-hidden rounded-xl" style={{ background: backgroundColor }}>
        <ReactECharts 
          option={chartOptions} 
          style={{ height, width: '100%' }}
          opts={{ renderer: 'svg' }}
        />
      </div>
    </div>
  );
};

export default PolymarketChart;

