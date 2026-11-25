import { describe, expect, it } from 'vitest';
import { runPineScript, type PineBar } from '../src';

function bars(count = 120): PineBar[] {
  return Array.from({ length: count }, (_, index) => {
    const close = 100 + Math.sin(index / 7) * 6 + index * 0.05;
    return {
      time: 1_700_000_000_000 + index * 3_600_000,
      open: close - 0.4,
      high: close + 1.2,
      low: close - 1.1,
      close,
      volume: 1000 + (index % 13) * 7,
    };
  });
}

function run(source: string) {
  const inputBars = bars();
  const result = runPineScript({
    source,
    bars: inputBars,
    timeframe: '60',
    symbol: 'BINANCE:BTCUSDT.P',
  });
  expect(result.ok).toBe(true);
  return { result, inputBars };
}

const last = (values: number[]) => values[values.length - 1];

describe('timestamp date strings', () => {
  it('parses the Pine string form and keeps the numeric form', () => {
    const { result } = run(`//@version=6
indicator("t")
plot(timestamp("01 Jan 2020 00:00 +0000"), "text")
plot(timestamp("01 Jan 2100 00:00 +0000"), "textEnd")
plot(timestamp(2020, 1, 1), "numeric")
plot(timestamp("2020-01-01"), "iso")
`);
    expect(result.plots[0]!.values[0]).toBe(1577836800000);
    expect(result.plots[1]!.values[0]).toBe(4102444800000);
    expect(result.plots[2]!.values[0]).toBe(1577836800000);
    expect(result.plots[3]!.values[0]).toBe(1577836800000);
  });

  it('uses a date-string timestamp as the input.time default', () => {
    const { result } = run(`//@version=6
indicator("t")
start = input.time(timestamp("01 Jan 2020 00:00 +0000"), "Start")
end = input.time(timestamp("01 Jan 2100 00:00 +0000"), "End")
plot(start, "start")
plot(end, "end")
`);
    expect(result.inputs.find((input) => input.id === 'Start')?.defval).toBe(1577836800000);
    expect(result.inputs.find((input) => input.id === 'End')?.defval).toBe(4102444800000);
    expect(last(result.plots[0]!.values)).toBe(1577836800000);
    expect(last(result.plots[1]!.values)).toBe(4102444800000);
  });
});

describe('history of an expression', () => {
  it('returns the previous bar of a call or a computed series', () => {
    const { result, inputBars } = run(`//@version=6
indicator("t")
plot(ta.sma(volume, 20)[1], "sma")
plot((close + 1)[1], "sum")
plot(math.max(close, open)[1], "max")
plot(ta.ema(close, 9)[1], "ema")
`);
    const count = inputBars.length;
    const previous = inputBars[count - 2]!;
    const volumes = inputBars.slice(count - 21, count - 1).map((bar) => bar.volume);
    const expectedSma = volumes.reduce((sum, value) => sum + value, 0) / volumes.length;

    expect(last(result.plots[0]!.values)).toBeCloseTo(expectedSma, 10);
    expect(last(result.plots[1]!.values)).toBeCloseTo(previous.close + 1, 10);
    expect(last(result.plots[2]!.values)).toBeCloseTo(Math.max(previous.close, previous.open), 10);
    expect(Number.isFinite(last(result.plots[3]!.values))).toBe(true);
  });

  it('keeps [] as element access on arrays', () => {
    const { result } = run(`//@version=6
indicator("t")
values = array.from(4.0, 5.0)
plot(values[1], "identifier")
plot(array.from(4.0, 5.0)[1], "inline")
`);
    expect(last(result.plots[0]!.values)).toBe(5);
    expect(last(result.plots[1]!.values)).toBe(5);
  });
});

describe('chart style flags', () => {
  it('reports a standard chart without missing builtins', () => {
    const { result } = run(`//@version=6
indicator("t")
plot(chart.is_standard ? 1 : 0, "standard")
`);
    expect(last(result.plots[0]!.values)).toBe(1);
    expect(result.missingStd).toEqual([]);
  });
});
