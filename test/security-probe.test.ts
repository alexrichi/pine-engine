import { describe, expect, it } from 'vitest';
import { compilePine, type PineBar } from '../src';

/** 15-minute bars over five days. */
const chart: PineBar[] = Array.from({ length: 480 }, (_, index) => {
  const close = 100 + Math.sin(index / 20) * 6;
  return {
    time: Date.UTC(2026, 0, 1) + index * 900_000,
    open: close - 0.3,
    high: close + 1.2,
    low: close - 1.1,
    close,
    volume: 1,
  };
});

const FOUR_HOURS = 4 * 3_600_000;

function completedFourHourHighs(bars: readonly PineBar[]): number[] {
  const buckets = new Map<number, number>();
  for (const bar of bars) {
    const key = Math.floor(bar.time / FOUR_HOURS) * FOUR_HOURS;
    buckets.set(key, Math.max(buckets.get(key) ?? Number.NEGATIVE_INFINITY, bar.high));
  }
  return [...buckets.entries()].sort(([a], [b]) => a - b).map(([, high]) => high);
}

const SOURCE = `//@version=6
indicator("Auto probe")
auto = timeframe.in_seconds() <= 900 ? "240" : "D"
f_scan() =>
    [high, low, close]
[h, l, c] = request.security(syminfo.tickerid, auto, f_scan(), lookahead = barmerge.lookahead_off)
plot(h, "h")
plot(l, "l")
plot(c, "c")
`;

describe('security probe with a derived timeframe', () => {
  it('captures the target site even when the probe recomputes the timeframe', () => {
    const program = compilePine({ source: SOURCE });
    expect(program.ok).toBe(true);
    if (!program.ok) return;

    const result = program.run({
      bars: chart,
      timeframe: '15',
      symbol: 'BINANCE:BTCUSDT.P',
      symbolInfo: { tickerid: 'BINANCE:BTCUSDT.P' },
    });
    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([]);

    const highs = completedFourHourHighs(chart);
    const plot = result.plots.find((series) => series.title === 'h')?.values ?? [];
    // lookahead_off reads the last completed 4h bucket, i.e. the one before the
    // bucket that holds the final chart bar.
    expect(plot.at(-1)).toBe(highs.at(-2));
  });
});
