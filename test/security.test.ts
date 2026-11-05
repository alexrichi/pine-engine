import { describe, expect, it } from 'vitest';
import { findSecurityCalls, neutralizeSecurity } from '../src/security';

describe('findSecurityCalls', () => {
  it('reads the symbol, timeframe and expression', () => {
    const calls = findSecurityCalls('htf = request.security(syminfo.tickerid, "D", close)');
    expect(calls).toEqual([
      { symbol: 'syminfo.tickerid', timeframe: 'D', expression: 'close' },
    ]);
  });

  it('handles nested calls in the expression', () => {
    const calls = findSecurityCalls(
      'x = request.security("BINANCE:BTCUSDT", "60", ta.ema(close, 20))',
    );
    expect(calls[0]).toEqual({
      symbol: 'BINANCE:BTCUSDT',
      timeframe: '60',
      expression: 'ta.ema(close, 20)',
    });
  });

  it('ignores mentions in comments and strings', () => {
    expect(findSecurityCalls('// request.security(a, "D", close)')).toEqual([]);
    expect(findSecurityCalls('label.new(bar_index, close, "request.security(x)")')).toEqual([]);
  });
});

describe('neutralizeSecurity', () => {
  it('rewrites every call to na and keeps the rest of the source', () => {
    const source = `//@version=6
indicator("X")
htf = request.security(syminfo.tickerid, "D", close)
plot(htf)`;
    const { source: rewritten, calls } = neutralizeSecurity(source);
    expect(calls).toHaveLength(1);
    expect(rewritten).toContain('htf = na');
    expect(rewritten).toContain('plot(htf)');
    expect(rewritten).not.toContain('request.security');
  });

  it('leaves a script without security calls untouched', () => {
    const source = 'indicator("Y")\nplot(close)';
    expect(neutralizeSecurity(source)).toEqual({ source, calls: [] });
  });
});
