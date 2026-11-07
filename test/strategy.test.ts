import { describe, expect, it } from 'vitest';
import { compilePine, type PineBar } from '../src';

const bars: PineBar[] = [
  { time: 1_000, open: 100, high: 101, low: 99, close: 100, volume: 1 },
  { time: 2_000, open: 100, high: 102, low: 99, close: 101, volume: 1 },
  { time: 3_000, open: 100, high: 115, low: 95, close: 110, volume: 1 },
  { time: 4_000, open: 110, high: 112, low: 108, close: 111, volume: 1 },
  { time: 5_000, open: 111, high: 113, low: 109, close: 112, volume: 1 },
  { time: 6_000, open: 112, high: 114, low: 110, close: 113, volume: 1 },
];

const BRACKET = `//@version=6
strategy("Bracket", initial_capital = 5000)
if bar_index == 1
    strategy.entry("Long", strategy.long)
    strategy.exit("Long Exit", from_entry = "Long", limit = close + 10, stop = close - 10)
plot(strategy.closedtrades.profit(0))
`;

describe('strategy runtime', () => {
  it('fills a bracket exit queued before its entry', () => {
    const program = compilePine({ source: BRACKET });
    expect(program.ok).toBe(true);
    if (!program.ok) return;

    const result = program.run({ bars, timeframe: '60', symbol: 'BINANCE:BTCUSDT' });
    expect(result.ok).toBe(true);
    const strategy = result.strategy;
    expect(strategy).toBeDefined();
    if (!strategy) return;

    expect(strategy.initialCapital).toBe(5000);
    expect(strategy.totalTrades).toBe(1);
    expect(strategy.trades[0]).toMatchObject({
      entryId: 'Long',
      direction: 'long',
      entryPrice: 100,
      exitPrice: 111,
      qty: 1,
      profit: 11,
      entryBar: 2,
      exitBar: 2,
    });
    expect(strategy.equity).toBe(5011);
    expect(strategy.netProfit).toBe(11);
    expect(strategy.position).toBeNull();
    expect(result.plots[0]?.values[2]).toBe(11);
  });
});
