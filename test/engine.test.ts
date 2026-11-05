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

  it('resamples same-symbol request.security sources on a higher timeframe', () => {
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

    const inputBars = bars(80);
    const higher = runPineScript({
      source: `//@version=6
indicator("Security")
x = request.security(syminfo.tickerid, "D", close)
plot(x)`,
      bars: inputBars,
      timeframe: '60',
      symbol: 'BINANCE:BTCUSDT',
    });
    expect(higher.ok).toBe(true);
    expect(higher.plots[0]!.values.some(Number.isFinite)).toBe(true);
    expect(higher.plots[0]!.values[24]).toBeCloseTo(inputBars[1]!.close, 10);
    expect(higher.plots[0]!.values[26]).toBeCloseTo(inputBars[25]!.close, 10);
    expect(higher.warnings).toEqual([]);

    const other = runPineScript({
      source: `//@version=6
indicator("Security")
x = request.security("BINANCE:OTHER", "D", close)
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

  it('returns a tuple for same-symbol request.security sources', () => {
    const result = runPineScript({
      source: `//@version=6
indicator("Security tuple")
[x, y] = request.security(syminfo.tickerid, "D", [close, open])
plot(x, "x")
plot(y, "y")`,
      bars: bars(80),
      timeframe: '60',
      symbol: 'BINANCE:BTCUSDT',
    });
    expect(result.ok).toBe(true);
    expect(result.plots[0]!.values.some(Number.isFinite)).toBe(true);
    expect(result.plots[1]!.values.some(Number.isFinite)).toBe(true);
    expect(result.warnings).toEqual([]);

    const unsupported = runPineScript({
      source: `//@version=6
indicator("Security tuple")
[x, y] = request.security(syminfo.tickerid, "D", [close + 1, open])
plot(x, "x")
plot(y, "y")`,
      bars: bars(80),
      timeframe: '60',
      symbol: 'BINANCE:BTCUSDT',
    });
    expect(unsupported.plots[0]!.values.every(Number.isNaN)).toBe(true);
    expect(unsupported.warnings.length).toBeGreaterThan(0);
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

  it('runs the remaining reference TA functions', () => {
    const result = runPineScript({
      source: `//@version=6
indicator("Reference TA")
plot(ta.bbw(close, 5, 4), "bbw")
plot(ta.kcw(close, 5, 4, true), "kcw")
plot(ta.cog(close, 10), "cog")
plot(ta.max(close), "max")
plot(ta.min(close), "min")
plot(ta.mode(close, 10), "mode")
plot(ta.range(close, 10), "range")
plot(ta.rci(close, 10), "rci")
plot(ta.cross(ta.sma(close, 3), ta.sma(close, 7)) ? 1 : 0, "cross")`,
      bars: bars(120),
      timeframe: '60',
    });
    expect(result.ok).toBe(true);
    expect(result.missingStd).toEqual([]);
    for (const plot of result.plots) {
      expect(Number.isFinite(plot.values.at(-1))).toBe(true);
    }
    expect(result.plots[7]!.values.at(-1)).toBeGreaterThanOrEqual(-100);
    expect(result.plots[7]!.values.at(-1)).toBeLessThanOrEqual(100);
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

  it('accepts keyword argument names and comparison statements', () => {
    const result = runPineScript({
      source: `//@version=6
indicator("Syntax")
f() =>
    n1 = 1
    n2 = 2
    n1 < n2
plotshape(series = close > 0 ? 1 : na, title="x", style=shape.triangleup)
plot(f() ? 1 : 0, "f")`,
      bars: bars(10),
      timeframe: '60',
    });
    expect(result.ok).toBe(true);
    expect(result.plots[0]!.values.at(-1)).toBe(1);
  });

  it('makes request.* data functions callable', () => {
    const result = runPineScript({
      source: `//@version=6
indicator("Requests")
plot(request.financial("BINANCE:BTCUSDT", "TOTAL_REVENUE"), "financial")
plot(request.economic("US", "GDP"), "economic")
plot(request.dividends("BINANCE:BTCUSDT", "regular"), "dividends")
plot(request.earnings("BINANCE:BTCUSDT", "reported"), "earnings")
plot(request.splits("BINANCE:BTCUSDT", "regular"), "splits")
plot(request.quandl("FRED/GDP"), "quandl")
plot(request.seed(1, close), "seed")
plot(request.currency_rate("USD", "USD"), "rate")
plot(array.get(request.security_lower_tf(syminfo.tickerid, "1", close), 0), "lower")`,
      bars: bars(10),
      timeframe: '60',
    });
    expect(result.ok).toBe(true);
    expect(result.missingStd).toEqual([]);
    expect(result.plots[0]!.values.every(Number.isNaN)).toBe(true);
    expect(result.plots[7]!.values.at(-1)).toBe(1);
    expect(result.warnings.join(' ')).toContain('request.financial');
  });

  it('applies ticker chart-type modifiers', () => {
    const result = runPineScript({
      source: `//@version=6
indicator("Ticker")
plot(ticker.heikinashi("BINANCE:BTCUSDT") == "BINANCE:BTCUSDT;heikinashi" ? 1 : 0, "heikin")
plot(ticker.standard(ticker.heikinashi("BINANCE:BTCUSDT")) == "BINANCE:BTCUSDT" ? 1 : 0, "standard")
plot(ticker.renko("BINANCE:BTCUSDT") == "BINANCE:BTCUSDT;renko" ? 1 : 0, "renko")`,
      bars: bars(5),
      timeframe: '60',
    });
    expect(result.ok).toBe(true);
    for (const plot of result.plots) expect(plot.values.at(-1)).toBe(1);
  });

  it('updates drawing points and table cells through setters', () => {
    const result = runPineScript({
      source: `//@version=6
indicator("Setters", overlay=true)
if barstate.islast
    l = line.new(0, 1, 1, 2)
    line.set_first_point(l, [3, 4])
    line.set_second_point(l, [5, 6])
    b = box.new(0, 10, 1, 1)
    box.set_top_left_point(b, [2, 11])
    box.set_bottom_right_point(b, [4, 3])
    box.set_xloc(b, xloc.bar_time)
    box.set_text_font_family(b, "monospace")
    box.set_text_formatting(b, "bold")
    box.set_text_wrap(b, true)
    lb = label.new(0, 0, "x")
    label.set_point(lb, [7, 8])
    label.set_text_font_family(lb, "monospace")
    label.set_text_formatting(lb, "italic")
    t = table.new(position.top_right, 2, 2)
    table.cell_set_width(t, 0, 0, 10)
    table.cell_set_height(t, 0, 0, 20)
    table.cell_set_text_font_family(t, 0, 0, "monospace")
    table.cell_set_text_formatting(t, 0, 0, "bold")
colour = color.red`,
      bars: bars(5),
      timeframe: '60',
    });
    expect(result.ok).toBe(true);
    expect(result.drawings.lines[0]).toMatchObject({ x1: 3, y1: 4, x2: 5, y2: 6 });
    expect(result.drawings.boxes[0]).toMatchObject({ left: 2, top: 11, right: 4, bottom: 3, xloc: 'bar_time' });
    expect(result.drawings.labels[0]).toMatchObject({ x: 7, y: 8 });
  });

  it('supports collection, timeframe and pivot helpers', () => {
    const result = runPineScript({
      source: `//@version=6
indicator("Helpers")
a = array.from(3, 1, 2)
plot(array.get(array.sort_indices(a), 0), "index")
left = map.new()
right = map.new()
map.put(right, "a", 5)
map.put_all(left, right)
plot(map.get(left, "a"), "map")
plot(str.tonumber(timeframe.from_seconds(3600)), "seconds")
levels = ta.pivot_point_levels("Traditional", timeframe.change("D"))
plot(array.get(levels, 0), "pivot")`,
      bars: bars(80),
      timeframe: '60',
    });
    expect(result.ok).toBe(true);
    expect(result.plots[0]!.values.at(-1)).toBe(1);
    expect(result.plots[1]!.values.at(-1)).toBe(5);
    expect(result.plots[2]!.values.at(-1)).toBe(60);
    expect(result.plots[3]!.values.some(Number.isFinite)).toBe(true);
  });

  it('supports the remaining input and strategy surface', () => {
    const result = runPineScript({
      source: `//@version=6
strategy("Surface")
mode = input.enum("A", "Mode", options=["A", "B"])
when = input.time(0, "When")
plot(mode == "A" ? 1 : 0, "mode")
plot(when >= 0 ? 1 : 0, "time")
plot(strategy.convert_to_account(close) == close ? 1 : 0, "account")
plot(strategy.convert_to_symbol(close) == close ? 1 : 0, "symbol")
plot(strategy.default_entry_qty(close) > 0 ? 1 : 0, "qty")
strategy.close_all()`,
      bars: bars(10),
      timeframe: '60',
    });
    expect(result.ok, result.error).toBe(true);
    expect(result.missingStd).toEqual([]);
    for (const plot of result.plots) expect(plot.values.at(-1)).toBe(1);
  });

  it('runs linefill and polyline objects', () => {
    const result = runPineScript({
      source: `//@version=6
indicator("Linefill", overlay=true)
if barstate.islast
    a = line.new(0, 1, 1, 2)
    b = line.new(0, 3, 1, 4)
    fill = linefill.new(a, b, color.new(color.blue, 80))
    linefill.set_color(fill, color.new(color.red, 50))
    poly = polyline.new(array.from([0, 1], [1, 2]), false, false)
plot(close, "close")`,
      bars: bars(5),
      timeframe: '60',
    });
    expect(result.ok).toBe(true);
    expect(result.missingStd).toEqual([]);
    expect(result.drawings.linefills).toHaveLength(1);
    expect(result.drawings.linefills[0]!.line1.id).toBe(0);
    expect(result.drawings.polylines).toHaveLength(1);
    expect(result.drawings.polylines[0]!.points).toHaveLength(2);
  });

  it('covers matrix creation, math and predicates', () => {
    const result = runPineScript({
      source: `//@version=6
indicator("Matrix")
m = matrix.new<float>(2, 2, 0)
matrix.set(m, 0, 0, 4)
matrix.set(m, 0, 1, 7)
matrix.set(m, 1, 0, 2)
matrix.set(m, 1, 1, 6)
s = matrix.new<float>(2, 2, 0)
matrix.set(s, 0, 0, 2)
matrix.set(s, 0, 1, 1)
matrix.set(s, 1, 0, 1)
matrix.set(s, 1, 1, 2)
plot(matrix.det(m), "det")
plot(matrix.trace(m), "trace")
plot(matrix.rank(m), "rank")
plot(matrix.sum(m), "sum")
plot(matrix.median(m), "median")
plot(matrix.get(matrix.inv(m), 0, 0), "inv")
plot(matrix.get(matrix.mult(m, m), 0, 0), "mult")
plot(matrix.get(matrix.transpose(m), 0, 1), "transpose")
plot(array.get(matrix.eigenvalues(s), 0), "eigen")
plot(matrix.is_square(m) ? 1 : 0, "square")
plot(matrix.is_zero(m) ? 1 : 0, "zero")
plot(matrix.is_identity(s) ? 1 : 0, "identity")
plot(matrix.is_symmetric(s) ? 1 : 0, "symmetric")`,
      bars: bars(5),
      timeframe: '60',
    });
    expect(result.ok).toBe(true);
    expect(result.missingStd).toEqual([]);
    expect(result.plots[0]!.values.at(-1)).toBe(10);
    expect(result.plots[1]!.values.at(-1)).toBe(10);
    expect(result.plots[2]!.values.at(-1)).toBe(2);
    expect(result.plots[3]!.values.at(-1)).toBe(19);
    expect(result.plots[4]!.values.at(-1)).toBe(5);
    expect(result.plots[8]!.values.at(-1)).toBeGreaterThan(0);
    expect(result.plots[9]!.values.at(-1)).toBe(1);
    expect(result.plots[10]!.values.at(-1)).toBe(0);
    expect(result.plots[11]!.values.at(-1)).toBe(0);
    expect(result.plots[12]!.values.at(-1)).toBe(1);
  });

  it('returns table state for the chart adapter', () => {
    const result = runPineScript({
      source: `//@version=6
indicator("Table")
var t = table.new(position.top_right, 2, 2, bgcolor=color.new(color.blue, 80), border_color=color.red, border_width=1, frame_color=color.gray, frame_width=2)
table.cell(t, 0, 0, "A", bgcolor=color.new(color.green, 70), text_color=color.white, text_size="small", text_halign="left", text_valign="top", tooltip="tip", width=25, height=10)
table.cell(t, 1, 0, "B")
table.merge_cells(t, 0, 1, 1, 1)
plot(close)`,
      bars: bars(5),
      timeframe: '60',
    });
    expect(result.ok).toBe(true);
    expect(result.tables).toHaveLength(1);
    expect(result.tables[0]).toMatchObject({
      position: 'top_right',
      columns: 2,
      rows: 2,
      borderWidth: 1,
      frameWidth: 2,
      merges: [{ startCol: 0, startRow: 1, endCol: 1, endRow: 1 }],
    });
    expect(result.tables[0]!.cells[0]![0]).toMatchObject({
      text: 'A',
      textSize: 'small',
      hAlign: 'left',
      vAlign: 'top',
      tooltip: 'tip',
      width: 25,
      height: 10,
    });
  });

  it('returns plotshape markers for the chart adapter', () => {
    const result = runPineScript({
      source: `//@version=6
indicator("Shapes")
plotshape(bar_index > 0 and bar_index % 10 == 0 ? 1 : na, "Buy", style=shape.triangleup, location=location.belowbar, color=color.green, text="B")
plotchar(bar_index == 5 ? 1 : na, "Char", char="X", location=location.abovebar, color=color.blue)
plotarrow(bar_index % 2 == 0 ? 1 : -1, "Arrow", colorup=color.green, colordown=color.red)
plot(close)`,
      bars: bars(20),
      timeframe: '60',
    });
    expect(result.ok).toBe(true);
    expect(result.shapes.some((shape) => shape.style === 'triangleup' && shape.text === 'B')).toBe(true);
    expect(result.shapes.some((shape) => shape.style === 'text_outline' && shape.text === 'X')).toBe(true);
    expect(result.shapes.some((shape) => shape.style === 'arrowup' && shape.color === '#4CAF50')).toBe(true);
    expect(result.shapes.some((shape) => shape.style === 'arrowdown' && shape.color === '#FF5252')).toBe(true);
  });

  it('returns plotcandle and plotbar series', () => {
    const result = runPineScript({
      source: `//@version=6
indicator("Candles")
plotcandle(open, high, low, close, "Candle", color=color.green, wickcolor=color.red, bordercolor=color.blue)
plotbar(open, high, low, close, "Bar", color=color.green)`,
      bars: bars(10),
      timeframe: '60',
    });
    expect(result.ok).toBe(true);
    expect(result.candles).toHaveLength(2);
    expect(result.candles[0]).toMatchObject({ title: 'Candle', kind: 'candle', color: '#4CAF50', wickColor: '#FF5252', borderColor: '#2962FF' });
    expect(result.candles[1]).toMatchObject({ title: 'Bar', kind: 'bar', color: '#4CAF50' });
    expect(result.candles[0]!.bars).toHaveLength(10);
  });

  it('returns price lines and fills with plot and hline anchors', () => {
    const result = runPineScript({
      source: `//@version=6
indicator("Levels", overlay=false)
upper = hline(70, "Upper", color=color.red, linewidth=2, linestyle=hline.style_dashed)
lower = hline(30, "Lower", color=color.green, linestyle=hline.style_dotted)
mid = plot(50, "Mid", color=color.gray)
value = plot(close, "Close", color=color.blue)
fill(value, mid, color=color.new(color.blue, 80))
fill(hline1=upper, hline2=lower, color=color.new(color.orange, 90))
plot(close, "close")`,
      bars: bars(6),
      timeframe: '60',
    });
    expect(result.ok).toBe(true);
    expect(result.priceLines).toHaveLength(2);
    expect(result.priceLines[0]).toMatchObject({
      id: 0,
      price: 70,
      title: 'Upper',
      width: 2,
      style: 'dashed',
    });
    expect(result.priceLines[1]).toMatchObject({ id: 1, price: 30, style: 'dotted' });

    expect(result.fills).toHaveLength(2);
    const plotFill = result.fills.find((fill) => fill.from.kind === 'plot')!;
    expect(plotFill.from).toEqual({ kind: 'plot', index: 1 });
    expect(plotFill.to).toEqual({ kind: 'plot', index: 0 });
    expect(plotFill.color).toBe('#2962FF33');

    const hlineFill = result.fills.find((fill) => fill.from.kind === 'hline')!;
    expect(hlineFill.from).toEqual({ kind: 'hline', index: 0, price: 70 });
    expect(hlineFill.to).toEqual({ kind: 'hline', index: 1, price: 30 });
    expect(hlineFill.color).toMatch(/^#FF9800/);
  });

  it('keeps conditional fill colors per bar', () => {
    const testBars: PineBar[] = [
      { time: 1_000, open: 100, high: 102, low: 99, close: 101, volume: 1 },
      { time: 2_000, open: 102, high: 103, low: 100, close: 101, volume: 1 },
      { time: 3_000, open: 100, high: 102, low: 99, close: 101, volume: 1 },
      { time: 4_000, open: 102, high: 103, low: 100, close: 101, volume: 1 },
    ];
    const result = runPineScript({
      source: `//@version=6
indicator("Bands", overlay=false)
highPlot = plot(high, "High")
lowPlot = plot(low, "Low")
fill(highPlot, lowPlot, color = close > open ? color.green : na)
plot(close)`,
      bars: testBars,
      timeframe: '60',
    });
    expect(result.ok).toBe(true);
    expect(result.fills).toHaveLength(1);
    const fill = result.fills[0]!;
    expect(fill.color).toBeUndefined();
    expect(fill.colors).toEqual(['#4CAF50', null, '#4CAF50', null]);
  });

  it('dedupes price lines and bar colors per bar', () => {
    const result = runPineScript({
      source: `//@version=6
indicator("Colors")
upper = hline(70, "Upper")
barcolor(close > open ? color.green : color.red)
barcolor(bar_index % 2 == 0 ? color.blue : na)
plot(close)`,
      bars: bars(6),
      timeframe: '60',
    });
    expect(result.ok).toBe(true);
    expect(result.priceLines).toHaveLength(1);
    expect(result.barColors).toHaveLength(3);
    expect(result.barColors.every((entry) => entry.color === '#2962FF')).toBe(true);
  });

  it('keeps user variable names out of the global object', () => {
    Object.defineProperty(globalThis, 'top', {
      value: 'host',
      writable: false,
      configurable: true,
    });
    try {
      const result = runPineScript({
        source: `//@version=6
indicator("Globals", overlay=true)
top = hline(80000, "Top", color=color.red)
bottom = hline(76000, "Bottom", color=color.green)
fill(top, bottom, color=color.purple)
plot(close, "close")`,
        bars: bars(6),
        timeframe: '60',
      });
      expect(result.ok).toBe(true);
      expect(result.fills).toHaveLength(1);
      expect(result.fills[0]!.from).toEqual({ kind: 'hline', index: 0, price: 80000 });
    } finally {
      delete (globalThis as { top?: unknown }).top;
    }
  });

  it('runs a tuple declaration after a switch expression', () => {
    const result = runPineScript({
      source: `//@version=6
indicator("Switch tuple")
x = switch
    close > open => 1
    => 2
[prevHigh, prevLow] = request.security(syminfo.tickerid, "D", [high[1], low[1]])
plot(x)`,
      bars: bars(10),
      timeframe: '60',
    });
    expect(result.ok).toBe(true);
    expect(result.plots[0]!.values.some((value) => Number.isFinite(value))).toBe(true);
  });

  it('supports Library method syntax and JavaScript-reserved names', () => {
    const result = runPineScript({
      source: `//@version=6
indicator("Method syntax", overlay=true)
method = 1
new = 2
l = line.new(bar_index, low, bar_index, high)
l.set_xy1(bar_index - 1, low)
l.set_xy2(bar_index + 1, high)
arr = array.from(1, 2, 3)
idx = arr.binary_search_rightmost(2)
plot(new + method + idx + line.get_y1(l))`,
      bars: bars(10),
      timeframe: '60',
    });
    expect(result.ok).toBe(true);
    expect(result.missingStd).toEqual([]);
    expect(result.drawings.lines).toHaveLength(10);
    expect(result.plots[0]!.values.some((value) => Number.isFinite(value))).toBe(true);
  });

  it('interpolates color.from_gradient and exposes ta.tsi', () => {
    const result = runPineScript({
      source: `//@version=6
indicator("Gradient")
barcolor(color.from_gradient(close, 90, 110, color.black, color.white))
plotshape(close > open ? 1 : na, "Mark", color=color(na))
plot(ta.tsi(close, 3, 10), "TSI")`,
      bars: bars(60),
      timeframe: '60',
    });
    expect(result.ok).toBe(true);
    expect(result.missingStd).toEqual([]);
    expect(result.barColors.length).toBeGreaterThan(0);
    expect(result.barColors[0]!.color).toMatch(/^#[0-9A-F]{8}$/);
    const tsi = result.plots.find((plot) => plot.title === 'TSI')!;
    expect(tsi.values.some((value) => Number.isFinite(value))).toBe(true);
    expect(tsi.values.filter((value) => Number.isFinite(value)).every((value) => value >= -100 && value <= 100)).toBe(true);
  });

  it('continues expressions across lines and accepts dotted generic types', () => {
    const result = runPineScript({
      source: `//@version=6
indicator("Continuation")
a = 1
b = a +
    2
c = a
    and b > 0
    ? 1 : 0
points = array.new<chart.point>()
points.push(chart.point.from_index(0, close))
colors = array.new_color(na)
array.push(colors, color.red)
plot(b + c + array.size(colors))`,
      bars: bars(10),
      timeframe: '60',
    });
    expect(result.ok).toBe(true);
    expect(result.missingStd).toEqual([]);
    expect(result.plots[0]!.values.some((value) => Number.isFinite(value))).toBe(true);
  });

  it('returns per-bar plotcandle colors', () => {
    const result = runPineScript({
      source: `//@version=6
indicator("Two tone")
plotcandle(open, high, low, close, "Candle", color = bar_index % 2 == 0 ? color.green : color.red, wickcolor = color.blue)
plotbar(open, high, low, close, "Bar", color = bar_index % 2 == 0 ? color.blue : color.orange)`,
      bars: bars(4),
      timeframe: '60',
    });
    expect(result.ok).toBe(true);
    const candle = result.candles.find((series) => series.kind === 'candle')!;
    expect(candle.barColors?.map((color) => color?.color)).toEqual([
      '#4CAF50',
      '#FF5252',
      '#4CAF50',
      '#FF5252',
    ]);
    expect(candle.barColors?.every((color) => color?.wickColor === '#2962FF')).toBe(true);
    const barPlot = result.candles.find((series) => series.kind === 'bar')!;
    expect(barPlot.barColors?.map((color) => color?.color)).toEqual([
      '#2962FF',
      '#FF9800',
      '#2962FF',
      '#FF9800',
    ]);
  });
});
