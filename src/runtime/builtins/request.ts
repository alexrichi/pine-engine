// Pine Script v6 request.security() runtime module.
//
// The engine only has the chart's own bars plus optional lower-timeframe and
// foreign-symbol bars supplied by the host. Higher timeframes of the chart are
// resampled from the chart; anything the host has not supplied returns `na`
// with a warning instead of silently returning the chart's values.

import { Series } from '../types/series';
import { NA } from '../types/na';
import type { Bar } from '../../data/types';

export interface RequestModule {
  security(symbol: string | any, timeframe: string, expression: any, gaps?: string, lookahead?: string, ignoreInvalidSymbol?: boolean, ignoreInvalidTimeframe?: boolean, siteId?: string): any;
  securitySource(symbol: string | any, timeframe: string, sources: SecuritySource | SecuritySource[] | (SecuritySource | null)[] | string | string[], gaps?: string, lookahead?: string, ignoreInvalidSymbol?: boolean, ignoreInvalidTimeframe?: boolean): any;
  securityLowerSource(symbol: string | any, timeframe: string, sources: (SecuritySource | null)[], ignoreInvalidSymbol?: boolean, ignoreInvalidTimeframe?: boolean): any;
  security_lower_tf(symbol: string | any, timeframe: string, expression: any, ignoreInvalidSymbol?: boolean, ignoreInvalidTimeframe?: boolean): any;
  currency_rate(from: string, to: string): number;
  financial(symbol: string, financialId: string, period?: string, gaps?: string): any;
  economic(countryCode: string, field: string, time?: number): any;
  dividends(symbol: string, dividendType: string, gaps?: string): any;
  earnings(symbol: string, earningsType: string): any;
  splits(symbol: string, splitType: string): any;
  quandl(code: string, gaps?: string): any;
  seed(seed: number, ...args: any[]): any;
}

/** One source requested through `request.security`: a builtin or a small TA call. */
export interface SecuritySource {
  kind?: 'source' | 'ta';
  name?: string;
  fn?: string;
  args?: number[];
  offset?: number;
}

/** The nested HTF run that captures an expression the source specs cannot express. */
export interface SecurityProbe {
  active: boolean;
  site: string;
  timeframe: string;
  capture: (barIndex: number, value: unknown) => void;
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

export function sameSymbol(requested: unknown, current: string): boolean {
  if (requested === null || requested === undefined || requested === '') return true;
  const value = String(requested);
  if (value === current) return true;
  // Scripts commonly pass syminfo.tickerid; a bare root also matches the chart.
  const root = current.includes(':') ? current.split(':').pop()! : current;
  return value === root || (value.includes(':') && value.split(':').pop() === root);
}

/** The host-supplied bars for a foreign symbol at one timeframe. */
export function foreignSeriesOf(
  foreignBars: Record<string, readonly Bar[]> | undefined,
  symbol: unknown,
  timeframe: string,
): readonly Bar[] | undefined {
  if (!foreignBars) return undefined;
  const requested = canonicalTimeframe(timeframe);
  const exact = foreignBars[`${String(symbol)}@${requested}`];
  if (exact) return exact;
  for (const [key, series] of Object.entries(foreignBars)) {
    const at = key.lastIndexOf('@');
    if (at < 0) continue;
    if (canonicalTimeframe(key.slice(at + 1)) !== requested) continue;
    if (sameSymbol(symbol, key.slice(0, at))) return series;
  }
  return undefined;
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

export function timeframeSeconds(tf: string): number {
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

/** The higher-timeframe bars a nested security probe runs on. */
export function resampleBars(bars: readonly Bar[], tf: string): Bar[] {
  const { buckets } = buildBuckets(bars, tf);
  return buckets.map((bucket) => ({
    time: bucket.time,
    open: bucket.open,
    high: bucket.high,
    low: bucket.low,
    close: bucket.close,
    volume: bucket.volume,
  }));
}

/**
 * A value captured on an HTF bar. Arrays and UDT objects are copied so later
 * mutations do not rewrite the snapshot; drawing handles keep their prototype
 * but are detached from the probe's renderer.
 */
export function cloneSnapshot(value: unknown, seen = new Map<object, unknown>()): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Series) return value.get(0);
  const existing = seen.get(value);
  if (existing !== undefined) return existing;
  if (value instanceof Map) {
    const out = new Map<unknown, unknown>();
    seen.set(value, out);
    for (const [key, item] of value) out.set(cloneSnapshot(key, seen), cloneSnapshot(item, seen));
    return out;
  }
  if (value instanceof Set) {
    const out = new Set<unknown>();
    seen.set(value, out);
    for (const item of value) out.add(cloneSnapshot(item, seen));
    return out;
  }
  if (value instanceof Date) return new Date(value.getTime());
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    seen.set(value, out);
    for (const item of value) out.push(cloneSnapshot(item, seen));
    return out;
  }
  const out = Object.create(Object.getPrototypeOf(value)) as Record<string, unknown>;
  seen.set(value, out);
  for (const key of Object.keys(value)) {
    const item = (value as Record<string, unknown>)[key];
    if (typeof item === 'function') continue;
    out[key] = cloneSnapshot(item, seen);
  }
  return out;
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
  lowerBars: Record<string, readonly Bar[]> = {},
  foreignBars: Record<string, readonly Bar[]> = {},
  onLowerTimeframe: (symbol: string, timeframe: string) => void = () => {},
  onForeignSymbol?: (symbol: string, timeframe: string) => void,
  runProbe?: (site: string, timeframe: string, symbol?: string) => unknown[],
  securityProbe?: SecurityProbe,
): RequestModule {
  const warned = new Set<string>();
  const foreignAsked = new Set<string>();
  const bucketCache = new Map<string, { buckets: Bucket[]; lookup: Int32Array }>();
  const atrCache = new Map<string, number[]>();

  interface LowerSlice {
    series: readonly Bar[];
    start: number;
    end: number;
  }

  function sourceSpecs(sources: SecuritySource | SecuritySource[] | (SecuritySource | null)[] | string | string[]): SecuritySource[] {
    if (typeof sources === 'string') return [{ name: sources }];
    if (!Array.isArray(sources)) return [sources];
    return sources.map((source) => (typeof source === 'string' ? { name: source } : source as SecuritySource));
  }

  function findLowerSeries(symbol: unknown, timeframe: string): readonly Bar[] | undefined {
    const requested = canonicalTimeframe(timeframe);
    const current = getCurrentSymbol();
    for (const [key, series] of Object.entries(lowerBars)) {
      const at = key.lastIndexOf('@');
      if (at < 0) continue;
      if (canonicalTimeframe(key.slice(at + 1)) !== requested) continue;
      const keySymbol = key.slice(0, at);
      if (sameSymbol(symbol, keySymbol) || sameSymbol(keySymbol, current) || sameSymbol(symbol, current)) {
        return series;
      }
    }
    return undefined;
  }

  function lowerSlice(symbol: unknown, timeframe: string): LowerSlice | null {
    const series = findLowerSeries(symbol, timeframe);
    if (!series) return null;
    const index = getCurrentBarIndex();
    const bar = bars[index];
    if (!bar) return null;
    const duration = timeframeSeconds(canonicalTimeframe(getCurrentTimeframe())) * 1000;
    const from = bar.time;
    const to = from + (duration > 0 ? duration : 1);
    let lo = 0;
    let hi = series.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (series[mid]!.time < from) lo = mid + 1;
      else hi = mid;
    }
    let end = lo;
    while (end < series.length && series[end]!.time < to) end += 1;
    return { series, start: lo, end };
  }

  /**
   * The foreign bar a chart bar reads. The host supplies foreign bars at the
   * requested timeframe, so this only selects the bar and applies the
   * lookahead/gaps contract; it never resamples.
   */
  function foreignBarIndex(
    series: readonly Bar[],
    timeframe: string,
    bar: Bar,
    gaps: string,
    lookahead: string,
  ): number {
    if (series.length === 0) return -1;
    const current = timeframeSeconds(canonicalTimeframe(getCurrentTimeframe()));
    const requested = timeframeSeconds(canonicalTimeframe(timeframe));
    const lookaheadOn = lookahead === 'barmerge.lookahead_on' || lookahead === 'lookahead_on';
    const gapsOn = gaps === 'barmerge.gaps_on' || gaps === 'gaps_on';

    if (requested > 0 && requested < current) {
      const from = bar.time;
      const to = from + current * 1000;
      let lo = 0;
      let hi = series.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (series[mid]!.time < from) lo = mid + 1;
        else hi = mid;
      }
      let end = lo;
      while (end < series.length && series[end]!.time < to) end += 1;
      return lookaheadOn ? end - 1 : end - 2;
    }

    let lo = 0;
    let hi = series.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (series[mid]!.time <= bar.time) lo = mid + 1;
      else hi = mid;
    }
    const index = lo - 1;
    if (index < 0) return -1;
    if (requested > current) {
      if (gapsOn && series[index]!.time !== bar.time) return -1;
      return lookaheadOn ? index : index - 1;
    }
    // Same timeframe: the bars must line up exactly.
    return series[index]!.time === bar.time ? index : -1;
  }

  function sourceValue(bar: Bar, index: number, name: string): number {
    if (name === 'time') return bar.time;
    if (name === 'bar_index') return index;
    if (name === 'hl2') return (bar.high + bar.low) / 2;
    if (name === 'hlc3') return (bar.high + bar.low + bar.close) / 3;
    if (name === 'ohlc4') return (bar.open + bar.high + bar.low + bar.close) / 4;
    return (bar as unknown as Record<string, number>)[name] ?? NA;
  }

  /** Wilder ATR over a bar series, matching the chart engine's `ta.atr`. */
  function atrValues(length: number, series: readonly Bar[], key: string): number[] {
    const cacheKey = `${key}:${length}`;
    const cached = atrCache.get(cacheKey);
    if (cached) return cached;
    const out = new Array<number>(series.length).fill(NA);
    if (!Number.isFinite(length) || length <= 0) {
      atrCache.set(cacheKey, out);
      return out;
    }
    let previous = Number.NaN;
    for (let index = 0; index < series.length; index++) {
      const bar = series[index]!;
      const priorClose = index > 0 ? series[index - 1]!.close : Number.NaN;
      const tr = Number.isFinite(priorClose)
        ? Math.max(
            bar.high - bar.low,
            Math.abs(bar.high - priorClose),
            Math.abs(bar.low - priorClose),
          )
        : bar.high - bar.low;
      previous = Number.isFinite(previous) ? (previous * (length - 1) + tr) / length : tr;
      out[index] = previous;
    }
    atrCache.set(cacheKey, out);
    return out;
  }

  function specValue(
    spec: SecuritySource,
    bar: Bar,
    index: number,
    series: readonly Bar[],
    key: string,
  ): number {
    if (spec.kind === 'ta') {
      if (spec.fn !== 'atr' || !spec.args?.length) return NA;
      return atrValues(spec.args[0]!, series, key)[index] ?? NA;
    }
    return sourceValue(bar, index, spec.name ?? '');
  }

  function requestForeign(symbol: unknown, timeframe: string): void {
    const requested = canonicalTimeframe(timeframe);
    const key = `${String(symbol ?? '')}@${requested}`;
    if (foreignAsked.has(key)) return;
    foreignAsked.add(key);
    if (onForeignSymbol) {
      onForeignSymbol(String(symbol ?? ''), requested);
      return;
    }
    warn(String(symbol ?? ''), requested);
  }

  function warn(symbol: string, timeframe: string, lower = false, ignore = false): void {
    if (ignore) return;
    const key = `${symbol}@${timeframe}`;
    if (warned.has(key)) return;
    warned.add(key);
    const current = canonicalTimeframe(getCurrentTimeframe());
    const target = canonicalTimeframe(timeframe || current);
    onWarning(
      lower
        ? `request.security(${symbol || 'chart'}, ${target}) needs ${target}-minute intrabar data; its values are na`
        : `request.security(${symbol || 'chart'}, ${target}) is not supported; its values are na`,
    );
  }

  function unsupportedSources(symbol: string, timeframe: string): void {
    const key = `sources:${symbol}@${timeframe}`;
    if (warned.has(key)) return;
    warned.add(key);
    onWarning(
      `request.security(${symbol || 'chart'}, ${timeframe}) has unsupported source expressions; those values are na`,
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
    gaps: string = 'barmerge.gaps_off',
    lookahead: string = 'barmerge.lookahead_off',
    ignoreInvalidSymbol = false,
    ignoreInvalidTimeframe = false,
    siteId?: string,
  ): any {
    const tuple = Array.isArray(expression);
    const currentTimeframe = canonicalTimeframe(getCurrentTimeframe());
    const requested = canonicalTimeframe(timeframe || currentTimeframe);
    const empty = () => (tuple ? (expression as unknown[]).map(() => NA) : NA);

    // A probe runs the whole script on HTF bars; only the target call site and
    // timeframe capture, everything else is na to avoid nested probes.
    if (securityProbe?.active) {
      if (siteId === securityProbe.site && requested === canonicalTimeframe(securityProbe.timeframe)) {
        securityProbe.capture(getCurrentBarIndex(), expression);
        return expression;
      }
      return empty();
    }

    if (!sameSymbol(symbol, getCurrentSymbol())) {
      const series = foreignSeriesOf(foreignBars, symbol, requested);
      if (!series) {
        requestForeign(symbol, requested);
        return empty();
      }
      if (siteId && runProbe) {
        const snapshots = runProbe(siteId, requested, String(symbol ?? ''));
        const current = bars[getCurrentBarIndex()];
        if (current) {
          const index = foreignBarIndex(series, requested, current, gaps, lookahead);
          if (index >= 0 && snapshots[index] !== undefined) {
            return cloneSnapshot(snapshots[index]);
          }
        }
      }
      return empty();
    }
    if (requested !== currentTimeframe) {
      const currentSeconds = timeframeSeconds(currentTimeframe);
      const requestedSeconds = timeframeSeconds(requested);
      const lower = requestedSeconds > 0 && requestedSeconds < currentSeconds;
      if (lower) {
        onLowerTimeframe(String(symbol ?? getCurrentSymbol()), requested);
        if (siteId && runProbe) {
          const snapshots = runProbe(siteId, requested);
          if (snapshots.length > 0) {
            const slice = lowerSlice(symbol, requested);
            if (slice && slice.end > slice.start) {
              const value = snapshots[slice.end - 1];
              if (value !== undefined) return cloneSnapshot(value);
            }
          }
        }
        warn(String(symbol ?? ''), requested, true, ignoreInvalidTimeframe);
        return empty();
      }
      // A higher timeframe evaluates the expression in a nested run over the
      // resampled bars, then reads the bar the security contract selects.
      if (siteId && runProbe) {
        const snapshots = runProbe(siteId, requested);
        if (snapshots.length > 0) {
          let cached = bucketCache.get(requested);
          if (!cached) {
            cached = buildBuckets(bars, requested);
            bucketCache.set(requested, cached);
          }
          const currentIndex = getCurrentBarIndex();
          const bucketIndex = cached.lookup[currentIndex] ?? -1;
          if (bucketIndex >= 0) {
            const gapsOn = gaps === 'barmerge.gaps_on' || gaps === 'gaps_on';
            if (!gapsOn || cached.buckets[bucketIndex]!.start === currentIndex) {
              const lookaheadOn = lookahead === 'barmerge.lookahead_on' || lookahead === 'lookahead_on';
              const target = (lookaheadOn ? bucketIndex : bucketIndex - 1);
              if (target >= 0 && snapshots[target] !== undefined) {
                return cloneSnapshot(snapshots[target]);
              }
            }
          }
          return empty();
        }
      }
      warn(String(symbol ?? ''), requested, lower, ignoreInvalidTimeframe);
      return empty();
    }
    if (tuple) {
      return (expression as unknown[]).map((value) =>
        value instanceof Series ? (value as Series<number>).get(0) : value,
      );
    }
    if (expression instanceof Series) return (expression as Series<number>).get(0);
    return expression;
  }

  function toUpperValues(
    specs: (SecuritySource | null)[],
    lookup: { buckets: Bucket[]; lookup: Int32Array },
    currentIndex: number,
    gaps: string,
    lookahead: string,
  ): any {
    const bucketIndex = lookup.lookup[currentIndex] ?? -1;
    if (bucketIndex < 0) return specs.map(() => NA);
    const gapsOn = gaps === 'barmerge.gaps_on' || gaps === 'gaps_on';
    if (gapsOn && lookup.buckets[bucketIndex]!.start !== currentIndex) return specs.map(() => NA);
    const lookaheadOn = lookahead === 'barmerge.lookahead_on' || lookahead === 'lookahead_on';
    return specs.map((spec) => {
      if (!spec || spec.kind === 'ta') return NA;
      const target = (lookaheadOn ? bucketIndex : bucketIndex - 1) - (spec.offset ?? 0);
      if (target < 0) return NA;
      return bucketSource(lookup.buckets[target]!, target, spec.name ?? '');
    });
  }

  return {
    security,
    securitySource(
      symbol: string,
      timeframe: string,
      sources: SecuritySource[] | string | string[],
      gaps: string = 'barmerge.gaps_off',
      lookahead: string = 'barmerge.lookahead_off',
      ignoreInvalidSymbol = false,
      ignoreInvalidTimeframe = false,
    ): any {
      const tuple = Array.isArray(sources);
      const specs = sourceSpecs(sources);
      const currentTf = canonicalTimeframe(getCurrentTimeframe());
      const requested = canonicalTimeframe(timeframe || currentTf);
      const empty = () => (tuple ? specs.map(() => NA) : NA);
      // Inside a probe only the target security call site contributes; every
      // other call is na, without warnings or host fetches.
      if (securityProbe?.active) return empty();
      if (specs.some((spec) => spec === null)) unsupportedSources(String(symbol ?? ''), requested);

      if (!sameSymbol(symbol, getCurrentSymbol())) {
        const series = foreignSeriesOf(foreignBars, symbol, requested);
        if (!series) {
          requestForeign(symbol, requested);
          return empty();
        }
        const current = bars[getCurrentBarIndex()];
        if (!current) return empty();
        const index = foreignBarIndex(series, requested, current, gaps, lookahead);
        if (index < 0) return empty();
        const values = specs.map((spec) => {
          if (!spec) return NA;
          const target = index - (spec.offset ?? 0);
          if (target < 0 || target >= series.length) return NA;
          return specValue(spec, series[target]!, target, series, `${String(symbol)}:${requested}`);
        });
        return tuple ? values : values[0];
      }

      const currentIndex = getCurrentBarIndex();
      const currentSeconds = timeframeSeconds(currentTf);
      const requestedSeconds = timeframeSeconds(requested);

      if (requested === currentTf) {
        const bar = bars[currentIndex];
        if (!bar) return empty();
        const values = specs.map((spec) => {
          if (!spec) return NA;
          const index = currentIndex - (spec.offset ?? 0);
          const target = bars[index];
          return target ? specValue(spec, target, index, bars, 'chart') : NA;
        });
        return tuple ? values : values[0];
      }

      if (requestedSeconds > 0 && requestedSeconds < currentSeconds) {
        onLowerTimeframe(String(symbol ?? getCurrentSymbol()), requested);
        const slice = lowerSlice(symbol, requested);
        if (!slice) {
          warn(String(symbol ?? ''), requested, true, ignoreInvalidTimeframe);
          return empty();
        }
        const lookaheadOn = lookahead === 'barmerge.lookahead_on' || lookahead === 'lookahead_on';
        const values = specs.map((spec) => {
          if (!spec) return NA;
          const base = lookaheadOn ? slice.end - 1 : slice.end - 2;
          const index = base - (spec.offset ?? 0);
          if (index < slice.start || index >= slice.end) return NA;
          return specValue(spec, slice.series[index]!, index, slice.series, `${requested}:${String(symbol)}`);
        });
        return tuple ? values : values[0];
      }

      if (requestedSeconds === 0) {
        warn(String(symbol ?? ''), requested, false, ignoreInvalidTimeframe);
        return empty();
      }

      let cached = bucketCache.get(requested);
      if (!cached) {
        cached = buildBuckets(bars, requested);
        bucketCache.set(requested, cached);
      }
      if (specs.some((spec) => spec?.kind === 'ta')) unsupportedSources(String(symbol ?? ''), requested);
      const values = toUpperValues(specs, cached, currentIndex, gaps, lookahead);
      return tuple ? values : values[0];
    },
    securityLowerSource(
      symbol: string,
      timeframe: string,
      sources: (SecuritySource | null)[],
      ignoreInvalidSymbol = false,
      ignoreInvalidTimeframe = false,
    ): any {
      const currentTf = canonicalTimeframe(getCurrentTimeframe());
      const requested = canonicalTimeframe(timeframe || currentTf);
      const currentIndex = getCurrentBarIndex();
      const empty = () => sources.map(() => [NA]);
      if (securityProbe?.active) return empty();
      if (sources.some((spec) => spec === null)) unsupportedSources(String(symbol ?? ''), requested);
      if (!sameSymbol(symbol, getCurrentSymbol())) {
        warn(String(symbol ?? ''), requested, false, ignoreInvalidSymbol);
        return empty();
      }
      const currentSeconds = timeframeSeconds(currentTf);
      const requestedSeconds = timeframeSeconds(requested);
      if (requested === currentTf) {
        const bar = bars[currentIndex];
        return bar
          ? sources.map((spec) => (spec ? [specValue(spec, bar, currentIndex, bars, 'chart')] : [NA]))
          : empty();
      }
      if (!(requestedSeconds > 0 && requestedSeconds < currentSeconds)) {
        warn(String(symbol ?? ''), requested, false, ignoreInvalidTimeframe);
        return empty();
      }
      onLowerTimeframe(String(symbol ?? getCurrentSymbol()), requested);
      const slice = lowerSlice(symbol, requested);
      if (!slice) {
        warn(String(symbol ?? ''), requested, true, ignoreInvalidTimeframe);
        return empty();
      }
      return sources.map((spec) => {
        if (!spec) return new Array<number>(slice.end - slice.start).fill(NA);
        const values: number[] = [];
        for (let index = slice.start; index < slice.end; index++) {
          values.push(specValue(spec, slice.series[index]!, index, slice.series, `${requested}:${String(symbol)}`));
        }
        return values;
      });
    },
    security_lower_tf(
      symbol: string,
      timeframe: string,
      expression: any,
      ignoreInvalidSymbol = false,
      ignoreInvalidTimeframe = false,
    ): any {
      const currentTf = canonicalTimeframe(getCurrentTimeframe());
      const requested = canonicalTimeframe(timeframe || currentTf);
      if (securityProbe?.active) return Array.isArray(expression) ? expression.map(() => [NA]) : [NA];
      if (!sameSymbol(symbol, getCurrentSymbol())) {
        warn(String(symbol ?? ''), requested, false, ignoreInvalidSymbol);
      } else if (requested !== currentTf) {
        const lower = timeframeSeconds(requested) > 0 && timeframeSeconds(requested) < timeframeSeconds(currentTf);
        if (lower) onLowerTimeframe(String(symbol ?? getCurrentSymbol()), requested);
        warn(String(symbol ?? ''), requested, lower, ignoreInvalidTimeframe);
      } else {
        unsupported('security_lower_tf');
      }
      return Array.isArray(expression) ? expression.map(() => [NA]) : [NA];
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
