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

  it('fills a limit already through the open at the open, not at its price', () => {
    const program = compilePine({
      source: `//@version=6
strategy("Marketable limit", initial_capital = 5000)
if bar_index == 1
    strategy.entry("Long", strategy.long)
    strategy.exit("Long Exit", from_entry = "Long", limit = close - 10)
plot(strategy.closedtrades.profit(0))
`,
    });
    expect(program.ok).toBe(true);
    if (!program.ok) return;

    const result = program.run({ bars, timeframe: '60', symbol: 'BINANCE:BTCUSDT' });
    expect(result.ok).toBe(true);
    const trade = result.strategy?.trades[0];
    // The sell limit sits below the market, so it is marketable on entry and
    // fills at the entry bar's open (100), not at 91.
    expect(trade?.entryPrice).toBe(100);
    expect(trade?.exitPrice).toBe(100);
    expect(trade?.profit).toBe(0);
  });

  it('exposes Pine strategy metrics on a closed round trip', () => {
    const program = compilePine({
      source: `//@version=6
strategy("Metrics", initial_capital = 5000)
if bar_index == 1
    strategy.entry("Long", strategy.long)
    strategy.exit("Long Exit", from_entry = "Long", limit = close + 10, stop = close - 10)
strategy.risk.allow_entry_in("long")
plot(strategy.netprofit_percent, "netprofit_percent")
plot(strategy.grossprofit_percent, "grossprofit_percent")
plot(strategy.grossloss_percent, "grossloss_percent")
plot(strategy.wintrades, "wintrades")
plot(strategy.losstrades, "losstrades")
plot(strategy.eventrades, "eventrades")
plot(strategy.avg_trade, "avg_trade")
plot(strategy.avg_winning_trade, "avg_winning_trade")
plot(strategy.avg_winning_trade_percent, "avg_winning_trade_percent")
plot(strategy.openprofit, "openprofit")
plot(strategy.max_runup, "max_runup")
plot(strategy.max_drawdown, "max_drawdown")
plot(strategy.max_contracts_held_all, "max_contracts_held_all")
plot(strategy.max_contracts_held_long, "max_contracts_held_long")
plot(strategy.initial_capital, "initial_capital")
plot(strategy.fixed == "fixed" ? 1 : 0, "fixed")
plot(strategy.account_currency == "USD" ? 1 : 0, "account_currency")
plot(na(strategy.margin_liquidation_price) ? 1 : 0, "margin_na")
`,
    });
    expect(program.ok).toBe(true);
    if (!program.ok) return;
    const result = program.run({ bars, timeframe: '60', symbol: 'BINANCE:BTCUSDT' });
    expect(result.ok).toBe(true);
    const value = (title: string): number | undefined =>
      result.plots.find((plot) => plot.title === title)?.values.at(-1);
    expect(value('netprofit_percent')).toBeCloseTo(0.22, 10);
    expect(value('grossprofit_percent')).toBeCloseTo(0.22, 10);
    expect(value('grossloss_percent')).toBe(0);
    expect(value('wintrades')).toBe(1);
    expect(value('losstrades')).toBe(0);
    expect(value('eventrades')).toBe(0);
    expect(value('avg_trade')).toBeCloseTo(11, 10);
    expect(value('avg_winning_trade')).toBeCloseTo(11, 10);
    expect(value('avg_winning_trade_percent')).toBeCloseTo(11, 10);
    expect(value('openprofit')).toBe(0);
    expect(value('max_runup')).toBeCloseTo(11, 10);
    expect(value('max_drawdown')).toBe(0);
    expect(value('max_contracts_held_all')).toBe(1);
    expect(value('max_contracts_held_long')).toBe(1);
    expect(value('initial_capital')).toBe(5000);
    expect(value('fixed')).toBe(1);
    expect(value('account_currency')).toBe(1);
    expect(value('margin_na')).toBe(1);
  });

  it('fills a gap through a stop at the open', () => {
    const gapBars: PineBar[] = [
      { time: 1_000, open: 100, high: 101, low: 99, close: 100, volume: 1 },
      { time: 2_000, open: 100, high: 102, low: 99, close: 101, volume: 1 },
      { time: 3_000, open: 100, high: 102, low: 99, close: 101, volume: 1 },
      { time: 4_000, open: 85, high: 90, low: 84, close: 88, volume: 1 },
      { time: 5_000, open: 88, high: 90, low: 86, close: 89, volume: 1 },
    ];
    const program = compilePine({
      source: `//@version=6
strategy("Gap stop", initial_capital = 5000)
if bar_index == 1
    strategy.entry("Long", strategy.long)
    strategy.exit("Long Exit", from_entry = "Long", stop = close - 10)
plot(strategy.closedtrades.profit(0))
`,
    });
    expect(program.ok).toBe(true);
    if (!program.ok) return;

    const result = program.run({ bars: gapBars, timeframe: '60', symbol: 'BINANCE:BTCUSDT' });
    expect(result.ok).toBe(true);
    const trade = result.strategy?.trades[0];
    // Entry at bar 2 open (100); the 91 sell-stop gaps through on bar 3 and
    // fills at that bar's open (85), not at the stop price.
    expect(trade?.entryPrice).toBe(100);
    expect(trade?.exitPrice).toBe(85);
    expect(trade?.profit).toBe(-15);
  });
});
