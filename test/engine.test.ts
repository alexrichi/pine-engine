import { describe, expect, it } from 'vitest';
import { executeScript, indicator, plot, ta, close } from 'oakscriptjs/script';
import { compilePine, runPineScript, type PineBar } from '../src';

function bars(count = 120): PineBar[] {
  return Array.from({ length: count }, (_, index) => {
    const value = 100 + Math.sin(index / 7) * 6 + index * 0.05;
    return {
      time: 1_700_000_000_000 + index * 3_600_000,
      open: value - 0.4,
      high: value + 1.2,
      low: value - 1.1,
      close: value,
      volume: 1000 + index * 7,
    };
  });
}

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

function ema(values: number[], length: number): number[] {
  const k = 2 / (length + 1);
  const out: number[] = [];
  let previous = values[0]!;
  out.push(previous);
  for (let index = 1; index < values.length; index += 1) {
    previous = values[index]! * k + previous * (1 - k);
    out.push(previous);
  }
  return out;
}

function rsi(values: number[], length: number): number[] {
  const out: number[] = new Array(values.length).fill(Number.NaN);
  let gain = 0;
  let loss = 0;
  for (let index = 1; index < values.length; index += 1) {
    const diff = values[index]! - values[index - 1]!;
    const up = diff > 0 ? diff : 0;
    const down = diff < 0 ? -diff : 0;
    if (index <= length) {
      gain += up;
      loss += down;
      if (index === length) {
        gain /= length;
        loss /= length;
        out[index] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
      }
      continue;
    }
    gain = (gain * (length - 1) + up) / length;
    loss = (loss * (length - 1) + down) / length;
    out[index] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

describe('pine-engine adapter', () => {
  it('runs the RSI preset and matches OakScriptJS on every bar', () => {
    const inputBars = bars();
    const result = runPineScript({ source: RSI_SCRIPT, bars: inputBars, timeframe: '60' });

    expect(result.ok).toBe(true);
    expect(result.plots).toHaveLength(3);
    expect(result.missingStd).toEqual([]);
    expect(result.warnings).toEqual([]);

    const run = executeScript(() => {
      indicator('RSI', { overlay: false });
      const length = 14;
      plot(ta.rsi(close, length), 'RSI');
    }, inputBars.map((bar) => ({ ...bar, time: bar.time / 1000 })));
    const expected = new Map(
      (Object.values(run.result.plots ?? {})[0] ?? []).map((entry) => [
        Math.round(entry.time * 1000),
        entry.value,
      ]),
    );

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
    expect(compared).toBeGreaterThan(50);
  });

  it('maps the RSI preset metadata and inputs', () => {
    const program = compilePine({ source: RSI_SCRIPT });
    expect(program.ok).toBe(true);
    expect(program.meta.name).toBe('RSI');
    expect(program.meta.overlay).toBe(false);
    expect(program.meta.inputs).toEqual([
      { id: 'Length', name: 'Length', type: 'int', defval: 14 },
    ]);
    expect(program.meta.plots.map((plot) => plot.title)).toEqual([
      'RSI',
      'Oversold',
      'Overbought',
    ]);
    expect(program.meta.plots[0]!.type).toBe('line');
  });

  it('keeps two EMAs independent and matches the expected values', () => {
    const inputBars = bars();
    const result = runPineScript({
      source: EMA_CROSS_SCRIPT,
      bars: inputBars,
      timeframe: '60',
    });
    expect(result.ok).toBe(true);
    expect(result.plots).toHaveLength(4);

    const closes = inputBars.map((bar) => bar.close);
    const expectedFast = ema(closes, 9);
    const expectedSlow = ema(closes, 21);
    for (let index = 0; index < closes.length; index += 1) {
      expect(result.plots[0]!.values[index]).toBeCloseTo(expectedFast[index]!, 10);
      expect(result.plots[1]!.values[index]).toBeCloseTo(expectedSlow[index]!, 10);
    }
    expect(result.plots[2]!.values.some((value) => value === 1)).toBe(true);
    expect(result.plots[3]!.values.some((value) => value === 1)).toBe(true);
  });

  it('supports chained TA on a user variable', () => {
    const inputBars = bars();
    const result = runPineScript({
      source: `//@version=6
indicator("Chained")
fast = ta.ema(close, 9)
slow = ta.ema(fast, 9)
plot(slow, "slow")`,
      bars: inputBars,
      timeframe: '60',
    });
    expect(result.ok).toBe(true);

    const expectedFast = ema(inputBars.map((bar) => bar.close), 9);
    const expectedSlow = ema(expectedFast, 9);
    expect(result.plots[0]!.values.at(-1)).toBeCloseTo(expectedSlow.at(-1)!, 10);
  });

  it('supports multiple stateful calls at different call sites', () => {
    const inputBars = bars();
    const result = runPineScript({
      source: `//@version=6
indicator("Two RSI")
a = ta.rsi(close, 7)
b = ta.rsi(close, 21)
plot(a, "a")
plot(b, "b")`,
      bars: inputBars,
      timeframe: '60',
    });
    expect(result.ok).toBe(true);
    const closes = inputBars.map((bar) => bar.close);
    const short = rsi(closes, 7);
    const long = rsi(closes, 21);
    expect(result.plots[0]!.values.at(-1)).toBeCloseTo(short.at(-1)!, 8);
    expect(result.plots[1]!.values.at(-1)).toBeCloseTo(long.at(-1)!, 8);
  });

  it('resets state between runs of one compiled program', () => {
    const program = compilePine({ source: RSI_SCRIPT });
    const firstBars = bars(120);
    const secondBars = bars(80);
    const first = program.run({ bars: firstBars, timeframe: '60', symbol: 'AAA' });
    const second = program.run({ bars: secondBars, timeframe: '60', symbol: 'BBB' });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.plots[0]!.values).toEqual(first.plots[0]!.values.slice(0, 80));
  });

  it('applies compile-time and per-run input overrides', () => {
    const program = compilePine({ source: RSI_SCRIPT, inputs: { Length: 7 } });
    const inputBars = bars();
    const withSeven = program.run({ bars: inputBars, timeframe: '60' });
    const withTwentyOne = program.run({
      bars: inputBars,
      timeframe: '60',
      inputs: { Length: 21 },
    });
    expect(withSeven.plots[0]!.values.at(-1)).not.toBeCloseTo(
      withTwentyOne.plots[0]!.values.at(-1)!,
      6,
    );
  });

  it('initializes var on the first bar from bar data', () => {
    const inputBars = bars(10);
    const result = runPineScript({
      source: `//@version=6
indicator("Var")
var first = close
plot(first, "first")`,
      bars: inputBars,
      timeframe: '60',
    });
    expect(result.ok).toBe(true);
    for (const value of result.plots[0]!.values) {
      expect(value).toBeCloseTo(inputBars[0]!.close, 10);
    }
  });

  it('aligns conditional plots by bar index', () => {
    const result = runPineScript({
      source: `//@version=6
indicator("Conditional")
if bar_index > 4
    plot(close, "late")`,
      bars: bars(10),
      timeframe: '60',
    });
    expect(result.ok).toBe(true);
    expect(result.plots[0]!.values).toHaveLength(10);
    expect(result.plots[0]!.values.slice(0, 5).every(Number.isNaN)).toBe(true);
    expect(result.plots[0]!.values.slice(5).every(Number.isFinite)).toBe(true);
  });

  it('maps line, box, label and bgcolor output', () => {
    const result = runPineScript({
      source: `//@version=6
indicator("Draw", overlay=true)
if bar_index == 4
    line.new(1, 10, 3, 20, xloc=xloc.bar_index, extend=extend.right, color=color.red, style=line.style_dashed, width=2)
    b = box.new(1, 20, 3, 10, border_color=color.blue, bgcolor=color.new(color.blue, 80), text="FVG")
    box.set_right(b, 8)
    label.new(2, 15, "HH", yloc=yloc.abovebar, style=label.style_label_down, color=color.green)
if bar_index == 5
    box.delete(box.new(0, 5, 1, 1))
bgcolor(bar_index > 6 ? color.new(color.red, 80) : na)`,
      bars: bars(10),
      timeframe: '60',
    });
    expect(result.ok).toBe(true);
    expect(result.drawings.lines).toHaveLength(1);
    expect(result.drawings.lines[0]).toMatchObject({
      x1: 1,
      y1: 10,
      x2: 3,
      y2: 20,
      extend: 'right',
      color: '#FF5252',
      style: 'dashed',
      width: 2,
    });
    expect(result.drawings.boxes.some((box) => box.text === 'FVG' && box.right === 8)).toBe(true);
    expect(result.drawings.boxes).toHaveLength(1);
    expect(result.drawings.labels).toHaveLength(1);
    expect(result.drawings.labels[0]).toMatchObject({ text: 'HH', yloc: 'abovebar' });
    expect(result.drawings.backgrounds.length).toBeGreaterThan(0);
  });

  it('keeps request.security on the same timeframe and warns for another one', () => {
    const same = runPineScript({
      source: `//@version=6
indicator("Security")
x = request.security(syminfo.tickerid, timeframe.period, close)
plot(x)`,
      bars: bars(20),
      timeframe: '60',
      symbol: 'BINANCE:BTCUSDT',
    });
    expect(same.ok).toBe(true);
    expect(same.plots[0]!.values.at(-1)).toBeCloseTo(bars(20).at(-1)!.close, 10);
    expect(same.warnings).toEqual([]);

    const other = runPineScript({
      source: `//@version=6
indicator("Security")
x = request.security(syminfo.tickerid, "D", close)
plot(x)`,
      bars: bars(20),
      timeframe: '60',
      symbol: 'BINANCE:BTCUSDT',
    });
    expect(other.ok).toBe(true);
    expect(other.plots[0]!.values.every(Number.isNaN)).toBe(true);
    expect(other.warnings.join(' ')).toContain('request.security');
  });

  it('reports unsupported builtins instead of throwing', () => {
    const result = runPineScript({
      source: `//@version=6
indicator("Missing")
plot(ta.not_a_function(close))`,
      bars: bars(10),
      timeframe: '60',
    });
    expect(result.ok).toBe(true);
    expect(result.missingStd.some((name) => name.includes('not_a_function'))).toBe(true);
  });

  it('resolves input.source overrides', () => {
    const inputBars = bars(20);
    const result = runPineScript({
      source: `//@version=6
indicator("Source")
src = input.source(close, "Source")
plot(ta.sma(src, 3), "sma")`,
      bars: inputBars,
      timeframe: '60',
      inputs: { Source: 'open' },
    });
    expect(result.ok).toBe(true);
    const opens = inputBars.map((bar) => bar.open);
    const expected = (opens[0]! + opens[1]! + opens[2]!) / 3;
    expect(result.plots[0]!.values[2]).toBeCloseTo(expected, 10);
  });

  it('maps plot styles', () => {
    const program = compilePine({
      source: `//@version=6
indicator("Style")
plot(close, "Histogram", style=plot.style_histogram)`,
    });
    expect(program.ok).toBe(true);
    expect(program.meta.plots[0]!.type).toBe('histogram');
  });

  it('accepts multi-line strings', () => {
    const result = runPineScript({
      source: `//@version=6
indicator("Multi")
message = "first line
second line"
plot(str.length(message) > 0 ? 1 : 0, "ok")`,
      bars: bars(5),
      timeframe: '60',
    });
    expect(result.ok).toBe(true);
    expect(result.plots[0]!.values.at(-1)).toBe(1);
  });

  it('returns the last value from a block-bodied if function', () => {
    const result = runPineScript({
      source: `//@version=6
indicator("Block")
f(x) =>
    if x > 0
        1
    else
        2
plot(f(close > 0 ? 1 : -1), "f")`,
      bars: bars(5),
      timeframe: '60',
    });
    expect(result.ok).toBe(true);
    expect(result.plots[0]!.values.at(-1)).toBe(1);
  });

  it('accepts inline switch cases', () => {
    const result = runPineScript({
      source: `//@version=6
indicator("Switch")
f(x) =>
    switch x
        "a" => 1
        => 2
plot(f("a"), "f")`,
      bars: bars(5),
      timeframe: '60',
    });
    expect(result.ok).toBe(true);
    expect(result.plots[0]!.values.at(-1)).toBe(1);
  });

  it('accepts generic constructors', () => {
    const result = runPineScript({
      source: `//@version=6
indicator("Generic")
a = array.new<int>()
array.push(a, 5)
plot(array.size(a), "size")`,
      bars: bars(5),
      timeframe: '60',
    });
    expect(result.ok).toBe(true);
    expect(result.plots[0]!.values.at(-1)).toBe(1);
  });

  it('returns an na tuple from an unsupported request.security call', () => {
    const result = runPineScript({
      source: `//@version=6
indicator("Security tuple")
[x, y] = request.security(syminfo.tickerid, "D", [close, open])
plot(x, "x")
plot(y, "y")`,
      bars: bars(10),
      timeframe: '60',
      symbol: 'BINANCE:BTCUSDT',
    });
    expect(result.ok).toBe(true);
    expect(result.plots[0]!.values.every(Number.isNaN)).toBe(true);
    expect(result.plots[1]!.values.every(Number.isNaN)).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('ignores drawing deletes on na', () => {
    const result = runPineScript({
      source: `//@version=6
indicator("Delete")
line.delete(na)
line l = na
line.delete(l)
plot(close, "close")`,
      bars: bars(5),
      timeframe: '60',
    });
    expect(result.ok).toBe(true);
  });

  it('runs roc, wpr, vwap and sar', () => {
    const result = runPineScript({
      source: `//@version=6
indicator("Extra TA")
plot(ta.roc(close, 5), "roc")
plot(ta.wpr(14), "wpr")
plot(ta.vwap(close), "vwap")
plot(ta.sar(0.02, 0.02, 0.2), "sar")`,
      bars: bars(120),
      timeframe: '60',
    });
    expect(result.ok).toBe(true);
    expect(result.missingStd).toEqual([]);
    for (const plot of result.plots) {
      expect(Number.isFinite(plot.values.at(-1))).toBe(true);
    }
  });

  it('returns a runtime error instead of throwing', () => {
    const result = runPineScript({
      source: `//@version=6
indicator("Boom")
runtime.error("boom")`,
      bars: bars(5),
      timeframe: '60',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('boom');
  });

  it('compares a variable that holds a builtin series by value', () => {
    const result = runPineScript({
      source: `//@version=6
indicator("Series compare")
x = close
plot(x == close[0] ? 1 : 0, "same")`,
      bars: bars(10),
      timeframe: '60',
    });
    expect(result.ok).toBe(true);
    expect(result.plots[0]!.values.at(-1)).toBe(1);
  });
});
