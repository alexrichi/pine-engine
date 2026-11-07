import { describe, expect, it } from 'vitest';
import { compilePine, type PineBar } from '../src';

/** Two full UTC days plus the first bars of the third. */
const chart: PineBar[] = [];
for (let hour = 0; hour < 60; hour += 1) {
  const value = 100 + hour;
  chart.push({
    time: Date.UTC(2026, 0, 1) + hour * 3_600_000,
    open: value,
    high: value + 1,
    low: value - 1,
    close: value + 0.5,
    volume: 1,
  });
}

const daily: PineBar[] = [
  { time: Date.UTC(2026, 0, 1), open: 10, high: 12, low: 9, close: 11, volume: 1 },
  { time: Date.UTC(2026, 0, 2), open: 20, high: 22, low: 19, close: 21, volume: 1 },
  { time: Date.UTC(2026, 0, 3), open: 30, high: 32, low: 29, close: 31, volume: 1 },
];

const hourly: PineBar[] = chart.map((bar, index) => ({
  ...bar,
  open: 5_000 + index,
  high: 5_100 + index,
  low: 4_900 + index,
  close: 5_050 + index,
}));

const foreign = { 'ETHUSDT@D': daily, 'ETHUSDT@60': hourly };

function run(source: string, bars = chart, foreignBars = foreign) {
  const program = compilePine({ source });
  expect(program.ok).toBe(true);
  if (!program.ok) throw new Error(program.error);
  return program.run({ bars, timeframe: '60', symbol: 'BINANCE:BTCUSDT.P', foreignBars });
}

describe('foreign request.security', () => {
  it('reads the previous completed daily bar for lookahead_off', () => {
    const result = run(`//@version=6
indicator("Foreign")
closeD = request.security("ETHUSDT", "D", close, lookahead = barmerge.lookahead_off)
closeOn = request.security("ETHUSDT", "D", close, lookahead = barmerge.lookahead_on)
plot(closeD, "closeD")
plot(closeOn, "closeOn")
`);
    expect(result.ok).toBe(true);
    const off = result.plots.find((plot) => plot.title === 'closeD')?.values ?? [];
    const on = result.plots.find((plot) => plot.title === 'closeOn')?.values ?? [];
    // The last _chart_ bars are on Jan 3; the completed daily bar is Jan 2,
    // and lookahead_on sees the forming Jan 3 bar.
    expect(off.at(-1)).toBe(21);
    expect(on.at(-1)).toBe(31);
  });

  it('runs a tuple function probe over the foreign timeframe', () => {
    const result = run(`//@version=6
indicator("Foreign")
f_pair() =>
    [high, low, close]
[h, l, c] = request.security("ETHUSDT", "D", f_pair(), lookahead = barmerge.lookahead_off)
plot(h, "h")
plot(l, "l")
plot(c, "c")
`);
    expect(result.ok).toBe(true);
    const high = result.plots.find((plot) => plot.title === 'h')?.values ?? [];
    const low = result.plots.find((plot) => plot.title === 'l')?.values ?? [];
    const close = result.plots.find((plot) => plot.title === 'c')?.values ?? [];
    expect(high.at(-1)).toBe(22);
    expect(low.at(-1)).toBe(19);
    expect(close.at(-1)).toBe(21);
  });

  it('reads a history offset from the same foreign timeframe', () => {
    const result = run(`//@version=6
indicator("Foreign")
[h3, l3] = request.security("ETHUSDT", timeframe.period, [high[3], low[3]])
plot(h3, "h3")
plot(l3, "l3")
`);
    expect(result.ok).toBe(true);
    const high = result.plots.find((plot) => plot.title === 'h3')?.values ?? [];
    const low = result.plots.find((plot) => plot.title === 'l3')?.values ?? [];
    const lastIndex = chart.length - 1;
    expect(high.at(-1)).toBe(hourly[lastIndex - 3]?.high);
    expect(low.at(-1)).toBe(hourly[lastIndex - 3]?.low);
  });

  it('returns na and requests the bars when the host has none', () => {
    const requested: string[] = [];
    const program = compilePine({
      source: `//@version=6
indicator("Foreign")
closeD = request.security("SOLUSDT", "D", close)
plot(closeD)
`,
    });
    expect(program.ok).toBe(true);
    if (!program.ok) return;
    const result = program.run({
      bars: chart,
      timeframe: '60',
      symbol: 'BINANCE:BTCUSDT.P',
      foreignBars: foreign,
      onForeignSymbol: (symbol, timeframe) => requested.push(`${symbol}@${timeframe}`),
    });
    expect(result.ok).toBe(true);
    expect(requested).toEqual(['SOLUSDT@D']);
    expect(result.plots[0]?.values.every((value) => Number.isNaN(value))).toBe(true);
  });
});
