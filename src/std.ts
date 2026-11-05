import { taCore } from 'oakscriptjs';
import { numberValue, seriesOf, type PineContext } from './series';
import type { PineBar } from './types';

export interface StdOptions {
  bars: readonly PineBar[];
  context: PineContext;
  timeframe: string;
  minutes: number;
  /** Duration of one bar in ms. */
  barMs: number;
  /** Collects the names the shim had to stub. */
  missing: Set<string>;
}

function trueRange(bars: readonly PineBar[], index: number): number {
  const bar = bars[index];
  if (!bar) return Number.NaN;
  if (index === 0) return bar.high - bar.low;
  const previous = bars[index - 1]!;
  return Math.max(
    bar.high - bar.low,
    Math.abs(bar.high - previous.close),
    Math.abs(bar.low - previous.close),
  );
}

/**
 * The `Std` object the transpiled indicator calls into. Price sources and
 * metadata come from the current bar; technical functions delegate to
 * OakScriptJS so the numbers match an independent implementation.
 */
export function createStd(options: StdOptions): Record<string, unknown> {
  const { bars, context, timeframe, minutes, barMs } = options;
  const current = (): PineBar => bars[Math.min(context.barIndex, bars.length - 1)]!;

  // ponytail: the TA functions rescan the whole history on every bar, so a run
  // is O(n^2). Fine for scans of a few thousand bars; cache per call site if a
  // long chart ever becomes the bottleneck.
  const closes = (): number[] => bars.slice(0, context.barIndex + 1).map((bar) => bar.close);
  const highs = (): number[] => bars.slice(0, context.barIndex + 1).map((bar) => bar.high);
  const lows = (): number[] => bars.slice(0, context.barIndex + 1).map((bar) => bar.low);

  const last = (values: readonly number[]): number =>
    values.length > 0 ? values[values.length - 1]! : Number.NaN;

  const crossCheck = (
    a: unknown,
    b: unknown,
    ctx: unknown,
    test: (current: number, previous: number, currentB: number, previousB: number) => boolean,
  ): boolean => {
    const mutable = ctx as PineContext;
    const aSeries = seriesOf(mutable.new_var(numberValue(a)));
    const bSeries = seriesOf(mutable.new_var(numberValue(b)));
    const previousA = aSeries.get(1);
    const previousB = bSeries.get(1);
    if (!Number.isFinite(previousA) || !Number.isFinite(previousB)) return false;
    return test(numberValue(a), previousA, numberValue(b), previousB);
  };

  return {
    close: () => current().close,
    open: () => current().open,
    high: () => current().high,
    low: () => current().low,
    volume: () => current().volume,
    hl2: () => (current().high + current().low) / 2,
    hlc3: () => (current().high + current().low + current().close) / 3,
    ohlc4: () => (current().open + current().high + current().low + current().close) / 4,
    hlcc4: () => (current().high + current().low + current().close + current().close) / 4,
    time: () => current().time,
    time_close: () => current().time + barMs,
    period: () => timeframe,
    interval: () => minutes,
    isdwm: () => ['D', 'W', 'M'].includes(timeframe),
    isintraday: () => !['D', 'W', 'M'].includes(timeframe),
    isdaily: () => timeframe === 'D',
    isweekly: () => timeframe === 'W',
    ismonthly: () => timeframe === 'M',

    sma: (value: unknown, length: number) =>
      last(taCore.sma(seriesOf(value).values, Math.trunc(length))),
    ema: (value: unknown, length: number) =>
      last(taCore.ema(seriesOf(value).values, Math.trunc(length))),
    rsi: (value: unknown, length: number) =>
      last(taCore.rsi(seriesOf(value).values, Math.trunc(length))),
    change: (value: unknown, lengthOrContext: unknown = 1) =>
      last(
        taCore.change(
          seriesOf(value).values,
          typeof lengthOrContext === 'number' ? Math.trunc(lengthOrContext) : 1,
        ),
      ),
    atr: (length: number) => last(taCore.atr(Math.trunc(length), highs(), lows(), closes())),
    tr: () => trueRange(bars, context.barIndex),

    cross: (a: unknown, b: unknown, ctx: unknown) =>
      crossCheck(a, b, ctx, (currentA, previousA, currentB, previousB) =>
        (currentA > currentB && previousA <= previousB) ||
        (currentA < currentB && previousA >= previousB),
      ),
    crossover: (a: unknown, b: unknown, ctx: unknown) =>
      crossCheck(
        a,
        b,
        ctx,
        (currentA, previousA, currentB, previousB) => currentA > currentB && previousA <= previousB,
      ),
    crossunder: (a: unknown, b: unknown, ctx: unknown) =>
      crossCheck(
        a,
        b,
        ctx,
        (currentA, previousA, currentB, previousB) => currentA < currentB && previousA >= previousB,
      ),

    gt: (a: unknown, b: unknown) => numberValue(a) > numberValue(b),
    lt: (a: unknown, b: unknown) => numberValue(a) < numberValue(b),
    na: (value: unknown) => !Number.isFinite(numberValue(value)),
    nz: (value: unknown, replacement = 0) =>
      Number.isFinite(numberValue(value)) ? numberValue(value) : numberValue(replacement),

    year: (time: number) => new Date(time).getUTCFullYear(),
    month: (time: number) => new Date(time).getUTCMonth() + 1,
    dayofmonth: (time: number) => new Date(time).getUTCDate(),
    dayofweek: (time: number) => new Date(time).getUTCDay() + 1,
    hour: (time: number) => new Date(time).getUTCHours(),
    minute: (time: number) => new Date(time).getUTCMinutes(),
    second: (time: number) => new Date(time).getUTCSeconds(),
    bar_index: () => context.barIndex,

    // The transpiler records these calls as visual events; the shim only has
    // to keep the sequence running.
    plot: () => undefined,
    plotshape: () => undefined,
    plotchar: () => undefined,
    plotarrow: () => undefined,
    hline: () => undefined,
    bgcolor: () => undefined,
    fill: () => undefined,
    barcolor: () => undefined,
  };
}

/**
 * Wraps the standard library so an unknown Pine function returns `na` instead
 * of throwing, and lands in `missingStd` for the caller to report.
 */
export function createStdProxy(std: Record<string, unknown>, missing: Set<string>): unknown {
  return new Proxy(std, {
    get(target, property) {
      const entry = target[String(property)];
      if (entry !== undefined) return entry;
      return () => {
        missing.add(String(property));
        return Number.NaN;
      };
    },
  });
}
