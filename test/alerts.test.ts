import { describe, expect, it } from 'vitest';
import { compilePine, type PineBar } from '../src';

const bars: PineBar[] = Array.from({ length: 40 }, (_, index) => ({
  time: 1_700_000_000_000 + index * 3_600_000,
  open: 100,
  high: 101,
  low: 99,
  close: 100 + index,
  volume: 1000,
}));

const SOURCE = `//@version=6
indicator("Alerts")
alert("every bar " + str.tostring(close))
if barstate.islast
    alert("last " + str.tostring(close))
alertcondition(close > 0, "Up", "close is " + str.tostring(close))
plot(close)
`;

describe('script alerts', () => {
  it('collects alerts from the current bar only', () => {
    const program = compilePine({ source: SOURCE });
    expect(program.ok).toBe(true);
    if (!program.ok) return;

    const result = program.run({ bars, timeframe: '60', symbol: 'BINANCE:BTCUSDT' });
    expect(result.ok).toBe(true);
    expect(result.alerts.map((alert) => alert.message)).toEqual([
      'every bar 139',
      'last 139',
      'close is 139',
    ]);
    for (const alert of result.alerts) {
      expect(alert.barIndex).toBe(bars.length - 1);
      expect(alert.time).toBe(bars.at(-1)?.time);
    }
    expect(result.alerts[2]).toMatchObject({ title: 'Up', freq: 'freq_once_per_bar' });
    expect(result.alerts.map((alert) => alert.site)).toEqual([
      expect.any(String),
      expect.any(String),
      expect.any(String),
    ]);
    expect(new Set(result.alerts.map((alert) => alert.site)).size).toBe(3);
  });

  it('skips alertcondition when the condition is false', () => {
    const program = compilePine({
      source: `//@version=6
indicator("Alerts")
alertcondition(close < 0, "Down", "negative")
plot(close)
`,
    });
    expect(program.ok).toBe(true);
    if (!program.ok) return;

    const result = program.run({ bars, timeframe: '60', symbol: 'BINANCE:BTCUSDT' });
    expect(result.alerts).toEqual([]);
  });

  it('keeps alerts separate from a run that still plots', () => {
    const program = compilePine({
      source: `//@version=6
indicator("Alerts")
alert("before")
plot(close / 0)
`,
    });
    expect(program.ok).toBe(true);
    if (!program.ok) return;

    const result = program.run({ bars, timeframe: '60', symbol: 'BINANCE:BTCUSDT' });
    expect(result.ok).toBe(true);
    expect(result.alerts.map((alert) => alert.message)).toEqual(['before']);
  });
});
