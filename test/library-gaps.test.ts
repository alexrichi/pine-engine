import { describe, expect, it } from 'vitest';
import { compilePine, runPineScript, type PineBar } from '../src';

const bars: PineBar[] = Array.from({ length: 8 }, (_, index) => ({
  time: 1_700_000_000_000 + index * 3_600_000,
  open: 100 + index,
  high: 101 + index,
  low: 99 + index,
  close: 100.5 + index,
  volume: 10 + index,
}));

function run(source: string) {
  return runPineScript({ source, bars, timeframe: '60', symbol: 'BINANCE:BTCUSDT.P' });
}

describe('Library sweep regressions', () => {
  it('parses switch arms that start with not and a negative number', () => {
    const result = run(`//@version=6
indicator("switch")
pick(int n, bool flag) =>
    switch n
        not flag => 1
        -1 => 2
        => 3
plot(pick(-1, false), "v")
`);
    expect(result.ok).toBe(true);
    expect(result.plots[0]!.values.at(-1)).toBe(2);
  });

  it('keeps leading-operator continuations inside switch arms', () => {
    const result = run(`//@version=6
indicator("switch continuation")
pick(int n) =>
    switch
        n > 0
            and n < 5 => 1
        n >= 5 => 2
        => 3
plot(pick(2), "v")
`);
    expect(result.ok).toBe(true);
    expect(result.plots[0]!.values.at(-1)).toBe(1);
  });

  it('resolves input defaults from string constants and keeps options', () => {
    const compiled = compilePine({
      source: `//@version=6
indicator("Inputs")
ALL = "All"
SOME = "Some"
mode = input.string(ALL, "Mode", options=[ALL, SOME], group="Group", inline="row", tooltip="Tip")
plot(str.length(mode), "n")
`,
    });
    expect(compiled.ok).toBe(true);
    const input = compiled.meta.inputs[0]!;
    expect(input.name).toBe('Mode');
    expect(input.defval).toBe('All');
    expect(input.options).toEqual(['All', 'Some']);
    expect(input.group).toBe('Group');
    expect(input.inline).toBe('row');
    expect(input.tooltip).toBe('Tip');
  });

  it('draws with chart.point anchors', () => {
    const result = run(`//@version=6
indicator("points", overlay = true)
line.new(chart.point.new(time, na, high), chart.point.new(time + 3600000, na, low), xloc = xloc.bar_time)
box.new(chart.point.new(time, na, high), chart.point.new(time + 3600000, na, low), xloc = xloc.bar_time)
label.new(chart.point.new(time, na, close), "x", xloc = xloc.bar_time)
`);
    expect(result.ok).toBe(true);
    expect(result.drawings.lines.at(-1)!.x1).toBe(1_700_025_200_000);
    expect(result.drawings.lines.at(-1)!.y1).toBe(108);
    expect(result.drawings.boxes.at(-1)!.top).toBe(108);
    expect(result.drawings.labels.at(-1)!.y).toBe(107.5);
  });

  it('uses high and low for one-argument ta.highest and ta.lowest', () => {
    const result = run(`//@version=6
indicator("hl")
plot(ta.highest(5), "h")
plot(ta.lowest(5), "l")
`);
    expect(result.ok).toBe(true);
    expect(result.plots[0]!.values.at(-1)).toBe(108);
    expect(result.plots[1]!.values.at(-1)).toBe(102);
  });

  it('keeps function-local var state per call site', () => {
    const result = run(`//@version=6
indicator("sites")
counter() =>
    var n = 0
    n += 1
    n
a = counter()
b = counter()
plot(a * 1000 + b, "v")
`);
    expect(result.ok).toBe(true);
    const value = result.plots[0]!.values.at(-1)!;
    expect(value % 1000).toBe(Math.floor(value / 1000));
  });

  it('stores builtin series as numbers in arrays', () => {
    const result = run(`//@version=6
indicator("arr")
var array<float> vals = array.new<float>()
vals.push(high)
plot(vals.get(0), "v")
`);
    expect(result.ok).toBe(true);
    expect(result.plots[0]!.values.at(-1)).toBe(bars[0]!.high);
  });

  it('keeps transparency in color input defaults', () => {
    const compiled = compilePine({
      source: `//@version=6
indicator("color")
c = input.color(color.new(#3179f5, 80), "OB")
plot(close, "c")
`,
    });
    expect(compiled.ok).toBe(true);
    expect(compiled.meta.inputs[0]!.defval).toBe('#3179f533');
  });

  it('lets a parameter shadow a var declared in another function', () => {
    const result = run(`//@version=6
indicator("shadow")
leg(int size) =>
    var leg = 0
    leg := size > 2 ? 1 : 0
    leg
isBull(int leg) => leg == 1
plot(isBull(0) ? 1 : 0, "zero")
plot(isBull(leg(5)) ? 1 : 0, "one")
`);
    expect(result.ok).toBe(true);
    expect(result.plots[0]!.values.at(-1)).toBe(0);
    expect(result.plots[1]!.values.at(-1)).toBe(1);
  });

  it('treats a UDT method call on na as na', () => {
    const result = run(`//@version=6
indicator("na method")
type Thing
    float v = 0.0
method value(Thing self) => self.v
Thing t = na
plot(t.value(), "v")
`);
    expect(result.ok).toBe(true);
    expect(result.plots[0]!.values.at(-1)).toBeNaN();
  });

  it('returns the last value of a multi-statement if expression', () => {
    const result = run(`//@version=6
indicator("if")
value = if close > open
    step = close - open
    step * 2
else
    0
plot(value, "v")
`);
    expect(result.ok).toBe(true);
    expect(result.plots[0]!.values.at(-1)).toBeCloseTo((100.5 + 7 - (100 + 7)) * 2, 6);
  });

  it('keeps a UDT constructor separate from a variable of the same name', () => {
    const result = run(`//@version=6
indicator("udt")
type level
    float price = 0.0
level = level.new(price = close)
plot(level.price, "p")
`);
    expect(result.ok).toBe(true);
    expect(result.plots[0]!.values.at(-1)).toBeCloseTo(107.5, 6);
  });

  it('supports the syminfo.ticker(symbol) function form', () => {
    const result = run(`//@version=6
indicator("syminfo")
plot(str.length(syminfo.ticker("BINANCE:ETHUSDT")), "len")
`);
    expect(result.ok).toBe(true);
    expect(result.plots[0]!.values.at(-1)).toBe(7);
  });

  it('accepts fixed timezone offsets like GMT-5', () => {
    const result = run(`//@version=6
indicator("tz")
plot(hour(1700000000000, "GMT-5"), "h")
`);
    expect(result.ok).toBe(true);
    expect(result.plots[0]!.values.at(-1)).toBe(17);
  });

  it('ignores drawing setters on an na handle', () => {
    const result = run(`//@version=6
indicator("draw")
var line ln = na
line.set_x2(ln, bar_index)
line.delete(ln)
plot(close, "c")
`);
    expect(result.ok).toBe(true);
    expect(result.missingStd).toEqual([]);
  });

  it('compiles a typed array declaration with a dotted element type', () => {
    const result = run(`//@version=6
indicator("points")
chart.point[] points = array.new<chart.point>()
points.push(chart.point.now(close))
plot(points.size(), "n")
`);
    expect(result.ok).toBe(true);
    expect(result.plots[0]!.values.at(-1)).toBe(1);
  });

  it('reports no compile diagnostics for a typed inline method body', () => {
    const compiled = compilePine({
      source: `//@version=6
indicator("inline")
method valid(float x) => bool ok = not na(x)
plot(valid(close) ? 1 : 0, "v")
`,
    });
    expect(compiled.ok).toBe(true);
  });
});
