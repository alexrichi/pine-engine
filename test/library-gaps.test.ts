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

  it('keeps ta.crossover state separate for each call site', () => {
    const result = run(`//@version=6
indicator("cross sites")
fast = ta.crossover(close, 102) ? 1 : 0
slow = ta.crossover(close, 105) ? 1 : 0
plot(fast, "fast")
plot(slow, "slow")
`);
    expect(result.ok).toBe(true);
    const fast = result.plots[0]!.values;
    const slow = result.plots[1]!.values;
    expect(fast[2]).toBe(1);
    expect(slow[5]).toBe(1);
    expect(slow[6]).toBe(0);
  });

  it('compares a lazy-skipped crossover against the last pair it saw', () => {
    const result = run(`//@version=6
indicator("lazy cross")
crossed = bar_index != 4 and ta.crossover(close, 104)
plot(crossed ? 1 : 0, "crossed")
`);
    expect(result.ok).toBe(true);
    expect(result.plots[0]!.values[5]).toBe(1);
  });

  it('propagates na through equality comparisons', () => {
    const result = run(`//@version=6
indicator("na eq")
var float missing = na
plot(missing == 5, "eq")
plot(missing != 5, "neq")
plot(5 != missing, "rev")
`);
    expect(result.ok).toBe(true);
    for (const plot of result.plots) expect(plot.values[0]).toBeNaN();
  });

  it('keeps an na drawing color out of the serialized drawings', () => {
    const result = run(`//@version=6
indicator("box border")
b = box.new(bar_index, high, bar_index + 1, low)
b.set_border_color(na)
plot(close, "close")
`);
    expect(result.ok).toBe(true);
    expect(result.drawings.boxes.at(-1)!.borderColor).toBe('');
  });

  it('keeps plain local history separate for each call site', () => {
    const result = run(`//@version=6
indicator("plain local history")
read(v) =>
    x = v
    x[1]
a = read(close)
b = read(open)
plot(a, "a")
plot(b, "b")
`);
    expect(result.ok).toBe(true);
    expect(result.plots[0]!.values.slice(1)).toEqual([100.5, 101.5, 102.5, 103.5, 104.5, 105.5, 106.5]);
    expect(result.plots[1]!.values.slice(1)).toEqual([100, 101, 102, 103, 104, 105, 106]);
  });

  it('treats an empty timeframe as the chart timeframe', () => {
    const result = runPineScript({
      source: `//@version=6
indicator("empty timeframe")
plot(timeframe.in_seconds(""), "seconds")
plot(timeframe.in_seconds("15"), "fifteen")
`,
      bars,
      timeframe: '5',
      symbol: 'BINANCE:BTCUSDT.P',
    });
    expect(result.ok).toBe(true);
    expect(result.plots[0]!.values.at(-1)).toBe(300);
    expect(result.plots[1]!.values.at(-1)).toBe(900);
  });

  it('runs a descending for loop without an explicit step', () => {
    const result = run(`//@version=6
indicator("descending for")
var int hits = 0
if bar_index == 0
    for i = 3 to 0
        hits := hits + 1
plot(hits, "hits")
`);
    expect(result.ok).toBe(true);
    expect(result.plots[0]!.values[0]).toBe(4);
  });

  it('formats a compiled format.volume argument like TradingView', () => {
    const result = run(`//@version=6
indicator("format volume")
string text = str.tostring(462546.752, format.volume)
plot(str.contains(text, "462.547K") ? 1 : 0, "ok")
plot(str.length(text), "len")
`);
    expect(result.ok).toBe(true);
    expect(result.plots[0]!.values.at(-1)).toBe(1);
    expect(result.plots[1]!.values.at(-1)).toBe(8);
  });

  it('returns na from a drawing getter on a missing drawing', () => {
    const result = run(`//@version=6
indicator("na drawing")
line l = na
plot(line.get_x2(l), "x")
plot(line.get_y1(l), "y")
`);
    expect(result.ok).toBe(true);
    expect(result.plots[0]!.values[0]).toBeNaN();
    expect(result.plots[1]!.values[0]).toBeNaN();
  });

  it('counts down when an explicit step is given', () => {
    const result = run(`//@version=6
indicator("descending for by")
var int hits = 0
if bar_index == 0
    for i = 3 to 0 by 1
        hits := hits + 1
plot(hits, "hits")
`);
    expect(result.ok).toBe(true);
    expect(result.plots[0]!.values[0]).toBe(4);
  });

  it('keeps a tuple local distinct from a same-named var in another function', () => {
    const result = run(`//@version=6
indicator("tuple shadow")
type P
    float y = na
mk(v) =>
    var P top = P.new(na)
    top := P.new(v)
    top
read() =>
    [top, other] = [mk(close), 0]
    top.y
plot(read(), "tuple")
`);
    expect(result.ok).toBe(true);
    expect(result.plots[0]!.values.map((v) => Math.round(v * 100) / 100)).toEqual(
      [100.5, 101.5, 102.5, 103.5, 104.5, 105.5, 106.5, 107.5],
    );
  });

  it('applies user function parameter defaults when the argument is omitted', () => {
    const result = run(`//@version=6
indicator("param defaults")
add(a, b = 2.0) => a + b
twice(a, b = 3.0) =>
    a * b
plot(add(1.0), "default")
plot(add(1.0, 5.0), "explicit")
plot(twice(2.0), "methodDefault")
`);
    expect(result.ok).toBe(true);
    expect(result.plots[0]!.values.at(-1)).toBe(3);
    expect(result.plots[1]!.values.at(-1)).toBe(6);
    expect(result.plots[2]!.values.at(-1)).toBe(6);
  });

  it('clones a UDT with Type.copy and keeps the copy independent', () => {
    const result = run(`//@version=6
indicator("udt copy")
type P
    float a = 1.0
    int b = 2
p = P.new(a = 5.0, b = 6)
q = P.copy(p)
q.a := 9.0
plot(p.a, "p")
plot(q.a, "q")
plot(q.b, "b")
`);
    expect(result.ok).toBe(true);
    expect(result.plots[0]!.values.at(-1)).toBe(5);
    expect(result.plots[1]!.values.at(-1)).toBe(9);
    expect(result.plots[2]!.values.at(-1)).toBe(6);
  });

  it('reads color.rgb input defaults instead of the fallback color', () => {
    const result = run(`//@version=6
indicator("rgb default")
c = input.color(color.rgb(0, 126, 0, 50), "")
plot(color.t(c), "transparency")
`);
    expect(result.ok).toBe(true);
    expect(result.plots[0]!.values.at(-1)).toBeCloseTo(49.8, 1);
  });

  it('keeps function-local history separate for each call site', () => {
    const result = run(`//@version=6
indicator("local history")
f(c) =>
    var int state = 0
    state := c ? state + 1 : nz(state[1])
    state
a = f(bar_index == 1)
b = f(bar_index == 2)
plot(a, "a")
plot(b, "b")
`);
    expect(result.ok).toBe(true);
    expect(result.plots[0]!.values).toEqual([0, 1, 1, 1, 1, 1, 1, 1]);
    expect(result.plots[1]!.values).toEqual([0, 0, 1, 1, 1, 1, 1, 1]);
  });

  it('accepts max_bars_back without reporting a missing builtin', () => {
    const result = run(`//@version=6
indicator("history reservation")
max_bars_back(close, 5000)
plot(close, "close")
`);
    expect(result.ok).toBe(true);
    expect(result.missingStd).toEqual([]);
  });

  it('snapshots builtin series into UDT constructor args and fields', () => {
    const result = run(`//@version=6
indicator("udt snapshot")
type Level
    float value = na
    int stamp = na
var Level level = Level.new(value = high, stamp = time)
if bar_index == 0
    level.value := high
    level.stamp := time
plot(level.value, "value")
plot(level.stamp, "stamp")
`);
    expect(result.ok).toBe(true);
    // A stored Series would keep reading the current bar; Pine snapshots it.
    expect(result.plots[0]!.values).toEqual(Array(8).fill(101));
    expect(result.plots[1]!.values).toEqual(Array(8).fill(bars[0]!.time));
  });

  it('returns the value of a trailing assignment and keeps parameters over globals', () => {
    const result = run(`//@version=6
indicator("tail")
type P
    float a = 0.0
method scaled(P id, float x) =>
    y = id.a * x
double(v) =>
    out = v * 2
plot(P.new(2.0).scaled(3.0), "method")
plot(double(4.0), "function")
`);
    expect(result.ok).toBe(true);
    expect(result.plots[0]!.values.at(-1)).toBe(6);
    expect(result.plots[1]!.values.at(-1)).toBe(8);
  });

  it('uses host symbol info for syminfo fields', () => {
    const result = runPineScript({
      source: `//@version=6
indicator("syminfo")
plot(syminfo.mintick, "mintick")
plot(syminfo.pricescale, "scale")
`,
      bars,
      timeframe: '60',
      symbol: 'BTCUSDT.P',
      symbolInfo: {
        tickerid: 'BINANCE:BTCUSDT.P',
        ticker: 'BTCUSDT.P',
        prefix: 'BINANCE',
        mintick: 0.1,
        pricescale: 10,
        type: 'futures',
      },
    });
    expect(result.ok).toBe(true);
    expect(result.plots[0]!.values.at(-1)).toBe(0.1);
    expect(result.plots[1]!.values.at(-1)).toBe(10);
  });

  it('stores numeric drawing coordinates from builtin series', () => {
    const result = run(`//@version=6
indicator("draw series", overlay = true)
var line ln = line.new(na, na, na, na, xloc = xloc.bar_time)
ln.set_xy1(time, high)
ln.set_xy2(time + 3600000, low)
var box bx = box.new(na, na, na, na, xloc = xloc.bar_time)
bx.set_lefttop(time, high)
bx.set_rightbottom(time + 3600000, low)
var label lb = label.new(na, na, xloc = xloc.bar_time)
lb.set_xy(time, close)
`);
    expect(result.ok).toBe(true);
    const bar = bars.at(-1)!;
    expect(result.drawings.lines[0]!.y1).toBe(bar.high);
    expect(result.drawings.lines[0]!.y2).toBe(bar.low);
    expect(result.drawings.boxes[0]!.top).toBe(bar.high);
    expect(result.drawings.boxes[0]!.bottom).toBe(bar.low);
    expect(result.drawings.labels[0]!.y).toBe(bar.close);
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
