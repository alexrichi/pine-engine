import { describe, expect, it } from 'vitest';
import { createStrategyEngine } from '../src/runtime/builtins/strategy';

describe('strategy metrics', () => {
  it('reports win/loss/breakeven, averages, percentages and open state', () => {
    const engine = createStrategyEngine(10_000);
    engine.processBar(0, 100, 101, 99, 100, 1_000);
    engine.entry('L1', 'long', 1);
    engine.processBar(1, 100, 102, 99, 101, 2_000);
    engine.close('L1');
    engine.processBar(2, 110, 111, 109, 110, 3_000);

    engine.entry('S1', 'short', 2);
    engine.processBar(3, 110, 112, 108, 109, 4_000);
    engine.close('S1');
    engine.processBar(4, 115, 116, 114, 115, 5_000);

    engine.entry('B1', 'long', 1);
    engine.processBar(5, 100, 101, 99, 100, 6_000);
    engine.close('B1');
    engine.processBar(6, 100, 101, 99, 100, 7_000);

    engine.entry('L2', 'long', 1);
    engine.processBar(7, 100, 102, 99, 101, 8_000);

    expect(engine.netprofit).toBe(0);
    expect(engine.netprofit_percent).toBe(0);
    expect(engine.grossprofit).toBe(10);
    expect(engine.grossprofit_percent).toBeCloseTo(0.1, 10);
    expect(engine.grossloss).toBe(10);
    expect(engine.grossloss_percent).toBeCloseTo(0.1, 10);
    expect(engine.wintrades).toBe(1);
    expect(engine.losstrades).toBe(1);
    expect(engine.eventrades).toBe(1);
    expect(engine.avg_trade).toBe(0);
    expect(engine.avg_winning_trade).toBe(10);
    expect(engine.avg_losing_trade).toBe(10);
    expect(engine.avg_trade_percent).toBeCloseTo(1.8181818181818181, 10);
    expect(engine.avg_winning_trade_percent).toBeCloseTo(10, 10);
    expect(engine.avg_losing_trade_percent).toBeCloseTo(-4.545454545454546, 10);
    expect(engine.openprofit).toBe(1);
    expect(engine.openprofit_percent).toBeCloseTo(0.01, 10);
    expect(engine.max_drawdown).toBe(12);
    expect(engine.max_drawdown_percent).toBeCloseTo(0.11985617259288853, 10);
    expect(engine.max_runup).toBe(12);
    expect(engine.max_runup_percent).toBeCloseTo(0.12, 10);
    expect(engine.max_contracts_held_all).toBe(2);
    expect(engine.max_contracts_held_long).toBe(1);
    expect(engine.max_contracts_held_short).toBe(2);
    expect(engine.position_entry_name).toBe('L2');
    expect(engine.initial_capital).toBe(10_000);
    expect(engine.account_currency).toBe('USD');
    expect(engine.closedTrade('profit_percent', 0)).toBe(10);
    expect(engine.closedTrade('profit_percent', 1)).toBeCloseTo(-4.545454545454546, 10);
    expect(engine.closedTrade('profit_percent', 2)).toBe(0);

    const result = engine.getResult();
    expect(result.maxDrawdown).toBe(engine.max_drawdown);
    expect(result.maxRunup).toBe(engine.max_runup);
    expect(result.netProfit).toBe(1);
    expect(result.openPnl).toBe(1);
  });

  it('uses the symbol point value in trade percentages', () => {
    const engine = createStrategyEngine(1_000, 2, 'USDT');
    engine.processBar(0, 100, 101, 99, 100, 1_000);
    engine.entry('L', 'long', 1);
    engine.processBar(1, 100, 101, 99, 100, 2_000);
    engine.close('L');
    engine.processBar(2, 110, 111, 109, 110, 3_000);

    expect(engine.closedTrade('profit_percent', 0)).toBeCloseTo(5, 10);
    expect(engine.account_currency).toBe('USDT');
    expect(Number.isNaN(engine.margin_liquidation_price)).toBe(true);
  });
});
