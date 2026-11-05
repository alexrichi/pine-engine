import { describe, expect, it } from 'vitest';
import { executeScript, indicator, input, plot, ta, close } from 'oakscriptjs/script';
import { compilePine, runPineScript, type PineBar } from '../src';

const RSI_SCRIPT = `//@version=6
indicator("RSI", overlay=false)

length = input.int(14, "Length")
rsi = ta.rsi(close, length)

plot(rsi, "RSI")
plot(rsi <= 30 ? 1 : 0, "Oversold")
plot(rsi >= 70 ? 1 : 0, "Overbought")
`;

const EMA_CROSS_SCRIPT = `//@version=6
indicator("EMA cross", overlay=true)

fast = ta.ema(close, 9)
slow = ta.ema(close, 21)

plot(fast, "EMA 9")
plot(slow, "EMA 21")
plot(ta.crossover(fast, slow) ? 1 : 0, "Long")
plot(ta.crossunder(fast, slow) ? 1 : 0, "Short")
`;

function bars(count = 120): PineBar[] {
  return Array.from({ length: count }, (_, index) => {
    const closeValue = 100 + Math.sin(index / 7) * 6 + index * 0.05;
    return {
      time: 1_700_000_000_000 + index * 3_600_000,
      open: closeValue - 0.4,
      high: closeValue + 1.2,
      low: closeValue - 1.1,
      close: closeValue,
      volume: 1000 + index * 7,
    };
  });
}

/**
 * OakScriptJS drops the warm-up bars, so align by bar time instead of index:
 * `expected` maps a bar timestamp back to the value Oak produced for it.
 */
function oakByTime(script: () => void, inputBars: PineBar[]): Map<number, number> {
  const run = executeScript(script, inputBars.map((bar) => ({ ...bar, time: bar.time / 1000 })));
  const values = Object.values(run.result.plots ?? {})[0] ?? [];
  return new Map(values.map((entry) => [Math.round(entry.time * 1000), entry.value]));
}

describe('runPineScript', () => {
  it('runs the RSI preset and matches OakScriptJS on every bar', () => {
    const inputBars = bars();
    const result = runPineScript({ source: RSI_SCRIPT, bars: inputBars, timeframe: '60' });

    expect(result.ok).toBe(true);
    expect(result.plots).toHaveLength(3);
    expect(result.missingStd).toEqual([]);

    const expected = oakByTime(() => {
      indicator('RSI', { overlay: false });
      const length = input.int(14, 'Length');
      plot(ta.rsi(close, length), 'RSI');
    }, inputBars);

    const actual = result.plots[0]!.values;
    let compared = 0;
    for (let index = 0; index < inputBars.length; index += 1) {
      const right = expected.get(inputBars[index]!.time);
      if (right === undefined) continue;
      const left = actual[index]!;
      if (!Number.isFinite(left) && !Number.isFinite(right)) continue;
      expect(left).toBeCloseTo(right, 10);
      compared += 1;
    }
    expect(compared).toBe(expected.size);
  });

  it('runs the EMA cross preset with all plots', () => {
    const result = runPineScript({ source: EMA_CROSS_SCRIPT, bars: bars(), timeframe: '60' });

    expect(result.ok).toBe(true);
    expect(result.plots).toHaveLength(4);
    expect(result.missingStd).toEqual([]);
    for (const plot of result.plots) {
      expect(plot.values.some((value) => Number.isFinite(value))).toBe(true);
    }
  });

  it('compiles once and runs the same program over several bar sets', () => {
    const program = compilePine({ source: RSI_SCRIPT, name: 'RSI' });
    expect(program.ok).toBe(true);
    expect(program.meta.plots.map((plot) => plot.title)).toEqual([
      'RSI',
      'Oversold',
      'Overbought',
    ]);

    const first = program.run({ bars: bars(120), timeframe: '60', symbol: 'AAA' });
    const second = program.run({ bars: bars(80), timeframe: '60', symbol: 'BBB' });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(first.plots[0]!.values).toHaveLength(120);
    expect(second.plots[0]!.values).toHaveLength(80);
    // A fresh run must not inherit series state from the previous one.
    expect(first.plots[0]!.values.slice(0, 80)).toEqual(second.plots[0]!.values);
  });

  it('emits a visual event for line.new', () => {
    const result = runPineScript({
      source: `//@version=6
indicator("Line", overlay=true)
if barstate.islast
    line.new(bar_index - 1, close, bar_index, close)`,
      bars: bars(30),
      timeframe: '60',
    });

    expect(result.ok).toBe(true);
    const line = result.visuals.find((event) => event.call === 'line.new');
    expect(line).toBeDefined();
    expect(line!.args).toHaveLength(4);
    expect(line!.barIndex).toBe(29);
  });

  it('reports a transpile error instead of throwing', () => {
    const result = runPineScript({ source: '@@@', bars: bars(10) });

    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.plots).toEqual([]);
  });
});
