import { describe, expect, it } from 'vitest';
import { compilePine, type PineBar } from '../src';
import { createTimeframe } from '../src/runtime/builtins/timeframe';

const bars: PineBar[] = Array.from({ length: 40 }, (_, index) => {
  const close = 100 + Math.sin(index / 4) * 3;
  return {
    time: 1_700_000_000_000 + index * 3_600_000,
    open: close - 0.2,
    high: close + 0.6,
    low: close - 0.6,
    close,
    volume: 1000,
  };
});

function run(source: string) {
  const program = compilePine({ source });
  expect(program.ok).toBe(true);
  if (!program.ok) throw new Error(program.error);
  return program.run({ bars, timeframe: '60', symbol: 'BINANCE:BTCUSDT.P' });
}

describe('timeframe and external-data builtins', () => {
  it('exposes the chart main period', () => {
    const timeframe = createTimeframe('60');
    expect(timeframe.period).toBe('60');
    expect(timeframe.main_period).toBe('60');

    const result = run(`//@version=6
indicator("Main period")
plot(timeframe.main_period == timeframe.period ? 1 : 0)
`);
    expect(result.ok).toBe(true);
    expect(result.plots[0]?.values.at(-1)).toBe(1);
  });

  it('returns na for earnings, dividends and splits without warnings', () => {
    const result = run(`//@version=6
indicator("External data")
e = request.earnings(syminfo.tickerid, earnings.actual, ignore_invalid_symbol = true)
d = request.dividends(syminfo.tickerid, dividends.gross, ignore_invalid_symbol = true)
s = request.splits(syminfo.tickerid, splits.denominator, ignore_invalid_symbol = true)
plot(na(e) and na(d) and na(s) ? 1 : 0)
`);
    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.plots[0]?.values.at(-1)).toBe(1);
  });
});
