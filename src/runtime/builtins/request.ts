// Pine Script v6 request.security() runtime module.
//
// The engine only has the chart's own bars. A higher timeframe or a foreign
// symbol would need another data feed, so those calls return `na` and report a
// warning instead of silently returning the chart's values. Same-symbol,
// same-timeframe calls keep working and return the expression unchanged.

import { Series } from '../types/series';
import { NA } from '../types/na';
import type { Bar } from '../../data/types';

export interface RequestModule {
  security(symbol: string | any, timeframe: string, expression: any, gaps?: string, lookahead?: string): any;
  securitySource(symbol: string | any, timeframe: string, sources: string | string[], gaps?: string, lookahead?: string): any;
  security_lower_tf(symbol: string | any, timeframe: string, expression: any): any;
  currency_rate(from: string, to: string): number;
  financial(symbol: string, financialId: string, period?: string, gaps?: string): any;
  economic(countryCode: string, field: string, time?: number): any;
  dividends(symbol: string, dividendType: string, gaps?: string): any;
  earnings(symbol: string, earningsType: string, gaps?: string): any;
  splits(symbol: string, splitType: string, gaps?: string): any;
  quandl(code: string, gaps?: string): any;
  seed(seed: number, ...args: any[]): any;
}

const ALIASES: Record<string, string> = {
  '1m': '1', '3m': '3', '5m': '5', '15m': '15', '30m': '30', '45m': '45',
  '1h': '60', '2h': '120', '3h': '180', '4h': '240', '6h': '360',
  '8h': '480', '12h': '720', '1d': 'D', '1w': 'W', '1mo': 'M',
  '4H': '240', '1D': 'D', '1W': 'W', '1M': 'M',
};

export function canonicalTimeframe(timeframe: string): string {
  return ALIASES[timeframe] ?? ALIASES[timeframe.toLowerCase()] ?? timeframe;
}

function sameSymbol(requested: unknown, current: string): boolean {
  if (requested === null || requested === undefined || requested === '') return true;
  const value = String(requested);
  if (value === current) return true;
  // Scripts commonly pass syminfo.tickerid; a bare root also matches the chart.
  const root = current.includes(':') ? current.split(':').pop()! : current;
  return value === root || (value.includes(':') && value.split(':').pop() === root);
}

interface Bucket {
  start: number;
  end: number;
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const SOURCE_NAMES = new Set(['open', 'high', 'low', 'close', 'volume', 'hl2', 'hlc3', 'ohlc4', 'time', 'bar_index']);

function timeframeSeconds(tf: string): number {
  if (tf === 'D') return 86_400;
  if (tf === 'W') return 604_800;
  if (tf === 'M') return 2_592_000;
  const seconds = /^(\d+)S$/i.exec(tf);
  if (seconds) return Number(seconds[1]);
  const minutes = parseInt(tf, 10);
  return Number.isFinite(minutes) && minutes > 0 ? minutes * 60 : 0;
}

function bucketKey(timeMs: number, tf: string): string {
  if (tf === 'D') return new Date(timeMs).toISOString().slice(0, 10);
  if (tf === 'W') {
    const date = new Date(timeMs);
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    return monday.toISOString().slice(0, 10);
  }
  if (tf === 'M') return new Date(timeMs).toISOString().slice(0, 7);
  const minutes = parseInt(tf, 10);
  const bucket = Number.isFinite(minutes) && minutes > 0 ? minutes : 1;
  return String(Math.floor(timeMs / (bucket * 60_000)));
}

function buildBuckets(bars: readonly Bar[], tf: string): { buckets: Bucket[]; lookup: Int32Array } {
  const buckets: Bucket[] = [];
  const lookup = new Int32Array(bars.length).fill(-1);
  let current: Bucket | null = null;
  let key = '';
  for (let index = 0; index < bars.length; index++) {
    const bar = bars[index]!;
    const nextKey = bucketKey(bar.time, tf);
    if (!current || nextKey !== key) {
      if (current) current.end = index - 1;
      current = {
        start: index,
        end: index,
        time: bar.time,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
      };
      buckets.push(current);
      key = nextKey;
    } else {
      current.high = Math.max(current.high, bar.high);
      current.low = Math.min(current.low, bar.low);
      current.close = bar.close;
      current.volume += bar.volume;
      current.end = index;
    }
    lookup[index] = buckets.length - 1;
  }
  return { buckets, lookup };
}

function bucketSource(bucket: Bucket, index: number, name: string): number {
  switch (name) {
    case 'open': return bucket.open;
    case 'high': return bucket.high;
    case 'low': return bucket.low;
    case 'close': return bucket.close;
    case 'volume': return bucket.volume;
    case 'hl2': return (bucket.high + bucket.low) / 2;
    case 'hlc3': return (bucket.high + bucket.low + bucket.close) / 3;
    case 'ohlc4': return (bucket.open + bucket.high + bucket.low + bucket.close) / 4;
    case 'time': return bucket.time;
    case 'bar_index': return index;
    default: return NA;
  }
}

export function createRequestModule(
  bars: Bar[],
  getCurrentBarIndex: () => number,
  getCurrentTimeframe: () => string,
  getCurrentSymbol: () => string = () => '',
  onWarning: (message: string) => void = () => {},
): RequestModule {
  const warned = new Set<string>();
  const bucketCache = new Map<string, { buckets: Bucket[]; lookup: Int32Array }>();

  function warn(symbol: string, timeframe: string): void {
    const key = `${symbol}@${timeframe}`;
    if (warned.has(key)) return;
    warned.add(key);
    onWarning(
      `request.security(${symbol || 'chart'}, ${timeframe || 'chart'}) is not supported; its values are na`,
    );
  }

  function unsupported(name: string): number {
    if (!warned.has(name)) {
      warned.add(name);
      onWarning(`request.${name} has no data source; its values are na`);
    }
    return NA;
  }

  function security(
    symbol: string | any,
    timeframe: string,
    expression: any,
    _gaps: string = 'barmerge.gaps_off',
    _lookahead: string = 'barmerge.lookahead_off',
  ): any {
    const tuple = Array.isArray(expression);
    const currentTimeframe = getCurrentTimeframe();
    const requested = timeframe || currentTimeframe;
    if (!sameSymbol(symbol, getCurrentSymbol()) || canonicalTimeframe(requested) !== canonicalTimeframe(currentTimeframe)) {
      warn(String(symbol ?? ''), requested);
      return tuple ? expression.map(() => NA) : NA;
    }
    if (tuple) {
      return expression.map((value: unknown) =>
        value instanceof Series ? (value as Series<number>).get(0) : value,
      );
    }
    if (expression instanceof Series) return (expression as Series<number>).get(0);
    return expression;
  }

  return {
    security,
    securitySource(
      symbol: string,
      timeframe: string,
      sources: string | string[],
      gaps: string = 'barmerge.gaps_off',
      lookahead: string = 'barmerge.lookahead_off',
    ): any {
      const names = Array.isArray(sources) ? sources : [sources];
      const tuple = Array.isArray(sources);
      const currentTf = canonicalTimeframe(getCurrentTimeframe());
      const requested = canonicalTimeframe(timeframe || currentTf);
      if (!sameSymbol(symbol, getCurrentSymbol())) {
        warn(String(symbol ?? ''), requested);
        return tuple ? names.map(() => NA) : NA;
      }

      const currentIndex = getCurrentBarIndex();
      if (requested === currentTf) {
        const bar = bars[currentIndex];
        if (!bar) return tuple ? names.map(() => NA) : NA;
        const values = names.map((name) => {
          if (name === 'time') return bar.time;
          if (name === 'bar_index') return currentIndex;
          if (name === 'hl2') return (bar.high + bar.low) / 2;
          if (name === 'hlc3') return (bar.high + bar.low + bar.close) / 3;
          if (name === 'ohlc4') return (bar.open + bar.high + bar.low + bar.close) / 4;
          return (bar as unknown as Record<string, number>)[name] ?? NA;
        });
        return tuple ? values : values[0];
      }

      if (timeframeSeconds(requested) <= timeframeSeconds(currentTf)) {
        warn(String(symbol ?? ''), requested);
        return tuple ? names.map(() => NA) : NA;
      }

      let cached = bucketCache.get(requested);
      if (!cached) {
        cached = buildBuckets(bars, requested);
        bucketCache.set(requested, cached);
      }
      const bucketIndex = cached.lookup[currentIndex] ?? -1;
      if (bucketIndex < 0) return tuple ? names.map(() => NA) : NA;
      const gapsOn = gaps === 'barmerge.gaps_on' || gaps === 'gaps_on';
      if (gapsOn && cached.buckets[bucketIndex]!.start !== currentIndex) {
        return tuple ? names.map(() => NA) : NA;
      }
      const lookaheadOn = lookahead === 'barmerge.lookahead_on' || lookahead === 'lookahead_on';
      const target = lookaheadOn ? bucketIndex : bucketIndex - 1;
      if (target < 0) return tuple ? names.map(() => NA) : NA;
      const bucket = cached.buckets[target]!;
      const values = names.map((name) => bucketSource(bucket, target, name));
      return tuple ? values : values[0];
    },
    security_lower_tf(_symbol: string, _timeframe: string, expression: any): any {
      unsupported('security_lower_tf');
      return Array.isArray(expression) ? expression.map(() => NA) : [NA];
    },
    currency_rate(from: string, to: string): number {
      if (String(from) === String(to)) return 1;
      return unsupported('currency_rate');
    },
    financial(): any {
      return unsupported('financial');
    },
    economic(): any {
      return unsupported('economic');
    },
    dividends(): any {
      return unsupported('dividends');
    },
    earnings(): any {
      return unsupported('earnings');
    },
    splits(): any {
      return unsupported('splits');
    },
    quandl(): any {
      return unsupported('quandl');
    },
    seed(): any {
      return unsupported('seed');
    },
  };
}
