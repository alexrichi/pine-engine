import { ScriptMetadata } from '../compiler/index';
import { Series } from './types/series';
import { isNa, nz, fixnan, NA } from './types/na';
import { color } from './types/color';
import { math } from './builtins/math';
import { TaModule } from './builtins/ta';
import { BarState } from './builtins/barstate';
import { BuiltinVariables } from './builtins/variables';
import { str } from './builtins/str';
import { arrayModule, mapModule, matrixModule } from './builtins/collections';
import { SymInfo, createSyminfo } from './builtins/syminfo';
import { TimeframeInfo, createTimeframe, inSeconds, startOfTimeframe } from './builtins/timeframe';
import { canonicalTimeframe } from './builtins/request';
import { StrategyEngine, createStrategyEngine } from './builtins/strategy';
import type { PineAlert } from '../types';
import { createLineModule } from './builtins/line';
import { createLabelModule } from './builtins/label';
import { createBoxModule } from './builtins/box';
import { createTableModule } from './builtins/table';
import { createLinefillModule } from './builtins/linefill';
import { createPolylineModule } from './builtins/polyline';
import { createTimeFunctions } from './builtins/time-functions';
import {
  PlotData,
  HlineData,
  FillData,
  FillRef,
  PlotHandle,
  HlineHandle,
  BgColorData,
  BarColorData,
  PlotShapeData,
  PlotCharData,
  PlotArrowData,
  PlotCandleData,
  PlotBarData,
} from './index';

export interface RuntimeContext {
  // Current bar scalar values
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  time: number;
  bar_index: number;
  hl2: number;
  hlc3: number;
  ohlc4: number;

  // Last bar info (set before bar loop)
  last_bar_index: number;
  last_bar_time: number;

  // Series accessor
  series(name: string): Series<number>;

  // Built-in modules
  ta: TaModule;
  math: typeof math & {
    /** Rolling `math.sum` that keeps a series for scalar source aliases. */
    sumSeries(source: unknown, length: unknown, id: string): number;
  };
  color: typeof color;
  barstate: BarState;
  str: typeof str;
  array: typeof arrayModule;
  map: typeof mapModule;
  matrix: typeof matrixModule;
  syminfo: SymInfo;
  timeframe: TimeframeInfo;
  chart: {
    bg_color: string;
    fg_color: string;
    border_color: string;
    text_color: string;
    /** Epoch ms of the left/right visible bar; na when the host has no viewport. */
    left_visible_bar_time: number;
    right_visible_bar_time: number;
    point: {
      new: (time: number, index: number, price: number) => unknown;
      now: (price?: number) => unknown;
      from_index: (index: number, price: number) => unknown;
      from_time: (time: number, price: number) => unknown;
      copy: (point: unknown) => unknown;
    };
  };

  // Drawing object modules
  line: ReturnType<typeof createLineModule>;
  label: ReturnType<typeof createLabelModule>;
  box: ReturnType<typeof createBoxModule>;
  table: ReturnType<typeof createTableModule>;
  linefill: ReturnType<typeof createLinefillModule>;
  polyline: ReturnType<typeof createPolylineModule>;

  // Time functions (top-level)
  time_close: number;
  time_tradingday: number;
  timenow: number;
  hour(ts?: number, tz?: string): number;
  minute(ts?: number, tz?: string): number;
  second(ts?: number, tz?: string): number;
  dayofweek(ts?: number, tz?: string): number;
  dayofmonth(ts?: number, tz?: string): number;
  month(ts?: number, tz?: string): number;
  year(ts?: number, tz?: string): number;
  timestamp(year: number, month: number, day: number, hour?: number, minute?: number, second?: number): number;
  weekofyear(ts?: number, tz?: string): number;
  timeInSession(timeframe?: string, session?: string, timezone?: string): number | symbol;

  // Request module
  request: { security: (...args: any[]) => any; [key: string]: any };

  // Ticker module
  ticker: {
    new: (...args: any[]) => string;
    standard: (symbol: unknown) => string;
    modify: (symbol: unknown, ...args: unknown[]) => string;
    inherit: (symbol: unknown, ...args: unknown[]) => string;
    heikinashi: (symbol: unknown) => string;
    renko: (symbol: unknown) => string;
    kagi: (symbol: unknown) => string;
    linebreak: (symbol: unknown) => string;
    pointfigure: (symbol: unknown) => string;
  };

  // Session module
  session: {
    ismarket: boolean;
    ispremarket: boolean;
    ispostmarket: boolean;
  };

  // Runtime module
  runtime: {
    error: (message: string) => never;
  };

  // State storage
  state: Record<string, unknown>;
  persistentState: Record<string, unknown>;

  // Output recording
  plot(index: number, value: number | null, opts?: Partial<PlotData> & { offset?: number }): PlotHandle;
  hline(index: number, price: number, opts?: Partial<HlineData>): HlineHandle;
  fill(p1: unknown, p2: unknown, opts?: { color?: string }): void;
  bgcolor(clr: string): void;
  barcolor(clr: string): void;
  plotshape(index: number, series: unknown, opts?: Record<string, unknown>): void;
  plotchar(index: number, series: unknown, opts?: Record<string, unknown>): void;
  plotarrow(index: number, series: unknown, opts?: Record<string, unknown>): void;
  plotcandle(index: number, open: number, high: number, low: number, close: number, opts?: Record<string, unknown>): void;
  plotbar(index: number, open: number, high: number, low: number, close: number, opts?: Record<string, unknown>): void;

  // Metadata/control
  setMetadata(meta: ScriptMetadata): void;
  setInit(fn: () => void): void;
  setExecute(fn: () => void): void;
  getInput(id: string): unknown;
  getSourceInput(id: string, fallback: unknown): unknown;
  /** Unwrap a Series to its current bar value before persisting a `var`. */
  scalar(value: unknown): unknown;
  /** Pine `==` / `!=` with `na` propagation. */
  eq(left: unknown, right: unknown): boolean;
  neq(left: unknown, right: unknown): boolean;
  /** `time(timeframe, session, timezone)` differs from the `time` variable. */
  timeCall(timeframe?: string, session?: string, timezone?: string): number;
  timeCloseCall(timeframe?: string, session?: string, timezone?: string): number;
  toInt(value: unknown): number;
  toFloat(value: unknown): number;
  toBool(value: unknown): number | boolean;
    toStr(value: unknown): string;
  /** Read a UDT field; `na` objects yield `na`. */
  field(value: unknown, name: string): unknown;
  /** Iterable view for `for ... in`; `na` yields an empty list. */
  iterable(value: unknown): unknown[];
  /** Call a UDT method; `na` objects yield `na`. */
  udtCall(value: unknown, name: string, args: unknown[]): unknown;
  /** Cast a drawing-type value: keep the handle, null for `na`. */
  drawingHandle(value: unknown): unknown;
  /** Receiver for a drawing method call; `na` receivers become a no-op proxy. */
  drawingCall(value: unknown): unknown;
  /** Normalize a tuple result so destructuring never throws on `na`. */
  tuple(value: unknown, count: number): unknown[];
  missing(name: string): unknown;

  // NA helpers exposed
  isNa: typeof isNa;
  nz: typeof nz;
  fixnan: typeof fixnan;
  na: typeof NA;

  /** Pine's `color(value)` cast; `na` becomes transparent. */
  colorCall(value: unknown): string;

  // User variable series history
  userSeriesSet(name: string, value: unknown): void;
  userSeriesGet(name: string, offset: number): unknown;
  /** Record a top-level variable for the requested debug-bar snapshot. */
  debugVar(name: string, value: unknown): void;

  // Strategy engine
  strategy: StrategyEngine;

  // Alert stubs
  alert(message: string, freq?: string, site?: string): void;
  alertcondition(condition: unknown, title?: string, message?: string, site?: string): void;

  // Log object
  log: {
    info(message: string): void;
    warning(message: string): void;
    error(message: string): void;
  };
}

export interface ContextInternals {
  ctx: RuntimeContext;
  metadata: ScriptMetadata | null;
  initFn: (() => void) | null;
  executeFn: (() => void) | null;
  plots: Map<number, PlotData>;
  hlines: HlineData[];
  fills: FillData[];
  bgcolors: BgColorData[];
  barcolors: BarColorData[];
  plotshapes: Map<number, PlotShapeData>;
  plotchars: Map<number, PlotCharData>;
  plotarrows: Map<number, PlotArrowData>;
  plotcandles: Map<number, PlotCandleData>;
  plotbars: Map<number, PlotBarData>;
  strategyEngine: StrategyEngine;
  alerts: PineAlert[];
  missing: Set<string>;
  warnings: string[];
  debugVars: Map<string, string>;
  updateBar(barIdx: number, builtins: BuiltinVariables, lastIndex: number): void;
}

export interface ContextOptions {
  /** Runtime input overrides keyed by the input id from the script metadata. */
  inputs?: Record<string, unknown>;
  symbol?: string;
  timeframe?: string;
  /** Provider metadata for `syminfo.*` (tick size, type, ticker id, ...). */
  symbolInfo?: Partial<import('./builtins/syminfo').SymInfo>;
  /** True while the host streams live bars; the last bar may still be forming. */
  live?: boolean;
  /** Lower-timeframe bars keyed `<symbol>@<canonical timeframe>`. */
  lowerBars?: Record<string, readonly import('../data/types').Bar[]>;
  /** Foreign-symbol bars keyed `<symbol>@<canonical timeframe>`. */
  foreignBars?: Record<string, readonly import('../data/types').Bar[]>;
  onLowerTimeframe?: (symbol: string, timeframe: string) => void;
  /** Called when a foreign symbol's bars are not in `foreignBars` yet. */
  onForeignSymbol?: (symbol: string, timeframe: string) => void;
  /** The chart's visible bar window for `chart.*_visible_bar_time`; absent = na. */
  visibleRange?: { left: number; right: number };
  /** A shared cache for nested HTF/LTF security probes (one per engine session). */
  securityProbeCache?: Map<string, unknown[]>;
  /** A strategy's declared `initial_capital`. */
  strategyInitialCapital?: number;
  /** Present only inside a nested HTF security probe. */
  securityProbe?: import('./builtins/request').SecurityProbe;
  /** Called for each `log.info`, `log.warning` or `log.error` line. */
  onLog?: (level: 'info' | 'warning' | 'error', message: string) => void;
  /** Zero-based bar whose top-level variables should be snapshotted. */
  debugBar?: number;
}

/**
 * Parse session state for a bar timestamp.
 * Regular market hours: 09:30 - 16:00 Eastern Time (NYSE/NASDAQ default).
 * Pre-market: 04:00 - 09:30
 * Post-market: 16:00 - 20:00
 */
function parseSessionState(barTimeMs: number, _timezone: string): { ismarket: boolean; ispremarket: boolean; ispostmarket: boolean } {
  // Get hour and minute in Eastern Time (ET, UTC-5/UTC-4)
  // We use a simple offset: EST = UTC-5, EDT = UTC-4. Use approximate UTC-5 for simplicity.
  // For proper TZ support, we convert using Intl.DateTimeFormat.
  const date = new Date(barTimeMs);
  const etFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = etFormatter.formatToParts(date);
  const hourPart = parts.find(p => p.type === 'hour');
  const minPart = parts.find(p => p.type === 'minute');
  const hour = parseInt(hourPart?.value ?? '0', 10);
  const minute = parseInt(minPart?.value ?? '0', 10);
  const timeMinutes = hour * 60 + minute;

  const marketOpen = 9 * 60 + 30;   // 09:30
  const marketClose = 16 * 60;       // 16:00
  const preOpen = 4 * 60;            // 04:00
  const postClose = 20 * 60;         // 20:00

  const ismarket = timeMinutes >= marketOpen && timeMinutes < marketClose;
  const ispremarket = timeMinutes >= preOpen && timeMinutes < marketOpen;
  const ispostmarket = timeMinutes >= marketClose && timeMinutes < postClose;

  return { ismarket, ispremarket, ispostmarket };
}

const TICKER_MODIFIERS = new Set(['heikinashi', 'renko', 'kagi', 'linebreak', 'pointfigure']);

function splitTickerModifier(symbol: string): { symbol: string; modifier: string | null } {
  const at = symbol.lastIndexOf(';');
  if (at <= 0 || at === symbol.length - 1) return { symbol, modifier: null };
  const modifier = symbol.slice(at + 1).toLowerCase();
  if (!TICKER_MODIFIERS.has(modifier) && modifier !== 'standard') {
    return { symbol, modifier: null };
  }
  return { symbol: symbol.slice(0, at), modifier };
}

function stripTickerModifier(symbol: string): string {
  return splitTickerModifier(symbol).symbol;
}

function withTickerModifier(symbol: string, modifier: string): string {
  return `${stripTickerModifier(symbol)};${modifier}`;
}

function fillRef(value: unknown): FillRef | null {
  if (value !== null && typeof value === 'object') {
    const plot = (value as Partial<PlotHandle>).__pinePlot;
    if (typeof plot === 'number' && Number.isFinite(plot)) return { kind: 'plot', index: plot };
    const hline = (value as Partial<HlineHandle>).__pineHline;
    if (typeof hline === 'number' && Number.isFinite(hline)) return { kind: 'hline', index: hline };
  }
  if (typeof value === 'number' && Number.isFinite(value)) return { kind: 'plot', index: value };
  return null;
}

function colorString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Pine's `offset` argument: a bar shift, truncated like the integer it is. */
function offsetOf(value: unknown): number {
  const offset = Number(value);
  return Number.isFinite(offset) ? Math.trunc(offset) : 0;
}

export function createContext(
  builtins: BuiltinVariables,
  ta: TaModule,
  barsCount: number,
  lastBarTime: number = 0,
  executionTimenow: number = Date.now(),
  options: ContextOptions = {}
): ContextInternals {
  const state: Record<string, unknown> = {};
  const persistentState: Record<string, unknown> = {};
  const inputs: Record<string, unknown> = { ...(options.inputs ?? {}) };
  const timeframePeriod = options.timeframe || 'D';
  const symbol = options.symbol || 'PINE:ENGINE';
  const barMs = inSeconds(timeframePeriod) * 1000;
  const missing = new Set<string>();
  const warnings: string[] = [];
  let metadata: ScriptMetadata | null = null;
  let initFn: (() => void) | null = null;
  let executeFn: (() => void) | null = null;
  let currentBarIndex = 0;
  let lastIndex = barsCount - 1;
  // A live chart's last bar is still forming until its close time; history is closed.
  const lastBarForming = options.live === true && builtins.time.get(0) + barMs > Date.now();

  const plots = new Map<number, PlotData>();
  const hlines: HlineData[] = [];
  const fills: FillData[] = [];
  const bgcolors: BgColorData[] = [];
  const barcolors: BarColorData[] = [];
  const plotshapes = new Map<number, PlotShapeData>();
  const plotchars = new Map<number, PlotCharData>();
  const plotarrows = new Map<number, PlotArrowData>();
  const plotcandles = new Map<number, PlotCandleData>();
  const plotbars = new Map<number, PlotBarData>();
  const strategyEngine = createStrategyEngine(
    options.strategyInitialCapital,
    options.symbolInfo?.pointvalue ?? 1,
    options.symbolInfo?.currency ?? 'USD',
  );
  const alerts: PineAlert[] = [];
  const alertSites = new Set<string>();
  const userSeries = new Map<string, Series<any>>();
  const debugVars = new Map<string, string>();
  const mathSumSources = new Map<string, { series: Series<number>; lastBar: number }>();
  /** Cache a scalar source per call site so `math.sum` sees real history. */
  function rollingSource(value: unknown, id: string): Series<number> {
    if (value instanceof Series) return value;
    const bar = currentBarIndex;
    let entry = mathSumSources.get(id);
    if (!entry) {
      entry = { series: new Series<number>(4096), lastBar: bar - 1 };
      for (let i = 0; i < bar; i++) entry.series.push(NA as unknown as number);
      mathSumSources.set(id, entry);
    }
    if (bar === entry.lastBar) {
      entry.series.set(isNa(value) ? (NA as unknown as number) : (value as number));
    } else {
      for (let i = entry.lastBar + 1; i < bar; i++) entry.series.push(NA as unknown as number);
      entry.series.push(isNa(value) ? (NA as unknown as number) : (value as number));
      entry.lastBar = bar;
    }
    return entry.series;
  }
  const lineModule = createLineModule();
  const labelModule = createLabelModule();
  const boxModule = createBoxModule();
  const tableModule = createTableModule();
  const linefillModule = createLinefillModule();
  const polylineModule = createPolylineModule();
  const timeFns = createTimeFunctions(() => builtins.time.get(0));

  // Unsupported builtins resolve to a value that is both callable and `na`.
  const missingValue = (name: string): unknown => {
    missing.add(name);
    const stub = (() => NA) as unknown as { valueOf(): number; toString(): string };
    stub.valueOf = () => NA;
    stub.toString = () => 'NaN';
    return stub;
  };
  const guarded = <T extends object>(namespace: string, target: T): T =>
    new Proxy(target, {
      get(object, property, receiver) {
        const value = Reflect.get(object, property, receiver);
        if (value !== undefined) return value;
        return missingValue(`${namespace}.${String(property)}`);
      },
    });

  const ctx: RuntimeContext = {
    // Expose Series objects directly. They have valueOf() which returns .get(0),
    // so they work as numbers in arithmetic (close + 1) and as Series for ta.sma(close, 20)
    get open() { return builtins.open as any; },
    get high() { return builtins.high as any; },
    get low() { return builtins.low as any; },
    get close() { return builtins.close as any; },
    get volume() { return builtins.volume as any; },
    get time() { return builtins.time.get(0); },
    get time_close() { return builtins.time.get(0) + barMs; },
    get time_tradingday() {
      const value = builtins.time.get(0);
      return Number.isFinite(value) ? Math.floor(value / 86_400_000) * 86_400_000 : NA;
    },
    timenow: executionTimenow,
    get bar_index() { return currentBarIndex; },
    get last_bar_index() { return lastIndex; },
    last_bar_time: lastBarTime,
    get hl2() { return builtins.hl2 as any; },
    get hlc3() { return builtins.hlc3 as any; },
    get ohlc4() { return builtins.ohlc4 as any; },

    series(name: string): Series<number> {
      const b = builtins as unknown as Record<string, Series<number>>;
      if (b[name]) return b[name];
      // Derived series that are plain getters on the context.
      if (name === 'time_close') {
        const time = builtins.time;
        return {
          get length() { return time.length; },
          get(index: number = 0) { return time.get(index) + barMs; },
        } as unknown as Series<number>;
      }
      return b[name]!;
    },

    ta,
    math: {
      ...math,
      sumSeries(source: unknown, length: unknown, id: string): number {
        const period = Number(length instanceof Series ? length.get(0) : length);
        if (!Number.isFinite(period) || period <= 0) return NA as unknown as number;
        return math.sum(rollingSource(source, id), period);
      },
      round_to_mintick: (value: number): number => {
        const tick =
          typeof options.symbolInfo?.mintick === 'number' && options.symbolInfo.mintick > 0
            ? options.symbolInfo.mintick
            : 0.01;
        return Math.round(value / tick) * tick;
      },
    },
    color,
    str,
    array: arrayModule,
    map: mapModule,
    matrix: matrixModule,
    syminfo: createSyminfo({
      tickerid: symbol,
      ticker: symbol.includes(':') ? symbol.split(':').pop()! : symbol,
      ...options.symbolInfo,
    }),
    timeframe: createTimeframe(timeframePeriod, () => builtins.time.get(0)),
    chart: {
      bg_color: '#131722',
      fg_color: '#d1d4dc',
      border_color: '#2a2e39',
      text_color: '#d1d4dc',
      left_visible_bar_time: options.visibleRange?.left ?? Number.NaN,
      right_visible_bar_time: options.visibleRange?.right ?? Number.NaN,
      point: {
        new(time: number, index: number, price: number) {
          return { time, index, price };
        },
        now(price?: number) {
          const value = price === undefined ? builtins.close.get(0) : price;
          return { time: builtins.time.get(0), index: currentBarIndex, price: value };
        },
        from_index(index: number, price: number) {
          return { index, price };
        },
        from_time(time: number, price: number) {
          return { time, price };
        },
        copy(point: unknown) {
          return point && typeof point === 'object' ? { ...(point as object) } : { price: Number.NaN };
        },
      },
    },

    // Drawing objects
    line: lineModule,
    label: labelModule,
    box: boxModule,
    table: tableModule,
    linefill: linefillModule,
    polyline: polylineModule,

    // Time functions
    hour: timeFns.hour,
    minute: timeFns.minute,
    second: timeFns.second,
    dayofweek: timeFns.dayofweek,
    dayofmonth: timeFns.dayofmonth,
    month: timeFns.month,
    year: timeFns.year,
    timestamp: timeFns.timestamp,
    weekofyear: timeFns.weekofyear,
    timeInSession: timeFns.timeInSession,

    // Request module (stub — will be fully wired from engine)
    request: {
      security(..._args: any[]): any { return NA; },
    },

    // Ticker module
    ticker: {
      new(...args: any[]): string {
        return args.length >= 2 ? `${args[0]}:${args[1]}` : String(args[0] ?? '');
      },
      standard(symbol: unknown): string {
        return stripTickerModifier(String(symbol ?? ''));
      },
      modify(symbol: unknown, ..._args: unknown[]): string {
        return String(symbol ?? '');
      },
      inherit(symbol: unknown, ..._args: unknown[]): string {
        return String(symbol ?? '');
      },
      heikinashi(symbol: unknown): string {
        return withTickerModifier(String(symbol ?? ''), 'heikinashi');
      },
      renko(symbol: unknown): string {
        return withTickerModifier(String(symbol ?? ''), 'renko');
      },
      kagi(symbol: unknown): string {
        return withTickerModifier(String(symbol ?? ''), 'kagi');
      },
      linebreak(symbol: unknown): string {
        return withTickerModifier(String(symbol ?? ''), 'linebreak');
      },
      pointfigure(symbol: unknown): string {
        return withTickerModifier(String(symbol ?? ''), 'pointfigure');
      },
    },

    // Crypto trades continuously; a chart with a symbol gets a 24/7 session.
    // Without one (unit tests, library callers) keep the stock session clock.
    get session() {
      if (options.symbol) return { ismarket: true, ispremarket: false, ispostmarket: false };
      return parseSessionState(builtins.time.get(0), 'America/New_York');
    },

    // Runtime module
    runtime: {
      error(message: string): never {
        const err = new Error(message);
        (err as any).isRuntimeError = true;
        throw err;
      },
    },

    get barstate() {
      const onLast = currentBarIndex === lastIndex;
      const live = options.live === true;
      return {
        isfirst: currentBarIndex === 0,
        islast: onLast,
        ishistory: !live || !onLast,
        isrealtime: live && onLast,
        isconfirmed: !onLast || !lastBarForming,
        islastconfirmedhistory: onLast && !lastBarForming,
      };
    },

    state,
    persistentState,

    plot(index: number, value: number | null, opts?: Partial<PlotData> & { offset?: number }): PlotHandle {
      let plotData = plots.get(index);
      if (!plotData) {
        plotData = {
          index,
          title: opts?.title ?? `plot_${index}`,
          color: opts?.color ?? '#2962FF',
          linewidth: opts?.linewidth ?? 1,
          style: opts?.style ?? 'line',
          values: [],
        };
        plots.set(index, plotData);
      }
      // Coerce Series objects to their current bar value
      const numValue = (value !== null && typeof value === 'object' && 'get' in (value as any))
        ? (value as any).get(0)
        : value;
      plotData.values.push({
        time: builtins.time.get(0),
        value: isNa(numValue) ? null : numValue as number,
        barIndex: currentBarIndex,
        offset: offsetOf(opts?.offset),
      });
      return { __pinePlot: index };
    },

    hline(index: number, price: number, opts?: Partial<HlineData>): HlineHandle {
      hlines.push({
        index,
        price,
        title: opts?.title ?? `hline_${index}`,
        color: colorString(opts?.color) ?? '#787B86',
        linewidth: Number.isFinite(opts?.linewidth) ? opts!.linewidth! : 1,
        linestyle: colorString(opts?.linestyle) ?? 'solid',
      });
      return { __pineHline: index };
    },

    fill(p1: unknown, p2: unknown, opts?: { color?: string }): void {
      const from = fillRef(p1);
      const to = fillRef(p2);
      if (!from || !to) return;
      fills.push({
        from,
        to,
        color: opts === undefined ? 'rgba(0,0,0,0.1)' : colorString(opts.color) ?? '',
        barIndex: currentBarIndex,
      });
    },

    bgcolor(clr: string): void {
      bgcolors.push({ time: builtins.time.get(0), color: clr, barIndex: currentBarIndex });
    },

    barcolor(clr: string): void {
      // Keep the last call per bar, including `na`, so a later clear wins.
      barcolors.push({
        time: builtins.time.get(0),
        color: colorString(clr) ?? '',
        barIndex: currentBarIndex,
      });
    },

    plotshape(index: number, series: unknown, opts?: Record<string, unknown>): void {
      let data = plotshapes.get(index);
      if (!data) {
        data = {
          index,
          title: (opts?.title as string) ?? `plotshape_${index}`,
          style: (opts?.style as string) ?? 'triangleup',
          location: (opts?.location as string) ?? 'abovebar',
          color: (opts?.color as string) ?? '#2962FF',
          size: (opts?.size as string) ?? 'normal',
          values: [],
        };
        plotshapes.set(index, data);
      }
      const numValue = (series !== null && typeof series === 'object' && 'get' in (series as any))
        ? (series as any).get(0)
        : series;
      data.values.push({
        time: builtins.time.get(0),
        value: isNa(numValue) ? null : (numValue ? Number(numValue) : null),
        text: (opts?.text as string) ?? undefined,
        barIndex: currentBarIndex,
        offset: offsetOf(opts?.offset),
      });
    },

    plotchar(index: number, series: unknown, opts?: Record<string, unknown>): void {
      let data = plotchars.get(index);
      if (!data) {
        data = {
          index,
          title: (opts?.title as string) ?? `plotchar_${index}`,
          char: (opts?.char as string) ?? '•',
          location: (opts?.location as string) ?? 'abovebar',
          color: (opts?.color as string) ?? '#2962FF',
          size: (opts?.size as string) ?? 'normal',
          values: [],
        };
        plotchars.set(index, data);
      }
      const numValue = (series !== null && typeof series === 'object' && 'get' in (series as any))
        ? (series as any).get(0)
        : series;
      data.values.push({
        time: builtins.time.get(0),
        value: isNa(numValue) ? null : (numValue ? Number(numValue) : null),
        text: (opts?.text as string) ?? undefined,
        barIndex: currentBarIndex,
        offset: offsetOf(opts?.offset),
      });
    },

    plotarrow(index: number, series: unknown, opts?: Record<string, unknown>): void {
      let data = plotarrows.get(index);
      if (!data) {
        data = {
          index,
          title: (opts?.title as string) ?? `plotarrow_${index}`,
          colorup: (opts?.colorup as string) ?? '#4CAF50',
          colordown: (opts?.colordown as string) ?? '#FF5252',
          values: [],
        };
        plotarrows.set(index, data);
      }
      const numValue = (series !== null && typeof series === 'object' && 'get' in (series as any))
        ? (series as any).get(0)
        : series;
      data.values.push({
        time: builtins.time.get(0),
        value: isNa(numValue) ? null : Number(numValue),
        barIndex: currentBarIndex,
        offset: offsetOf(opts?.offset),
      });
    },

    plotcandle(index: number, open: number, high: number, low: number, close: number, opts?: Record<string, unknown>): void {
      let data = plotcandles.get(index);
      if (!data) {
        data = {
          index,
          title: (opts?.title as string) ?? `plotcandle_${index}`,
          color: colorString(opts?.color) ?? '#2962FF',
          wickcolor: colorString(opts?.wickcolor) ?? '#737375',
          bordercolor: colorString(opts?.bordercolor) ?? '#2962FF',
          values: [],
        };
        plotcandles.set(index, data);
      }
      const coerce = (v: any) => (v !== null && typeof v === 'object' && 'get' in v) ? v.get(0) : v;
      data.values.push({
        time: builtins.time.get(0),
        open: Number(coerce(open)),
        high: Number(coerce(high)),
        low: Number(coerce(low)),
        close: Number(coerce(close)),
        color: colorString(coerce(opts?.color)),
        wickcolor: colorString(coerce(opts?.wickcolor)),
        bordercolor: colorString(coerce(opts?.bordercolor)),
      });
    },

    plotbar(index: number, open: number, high: number, low: number, close: number, opts?: Record<string, unknown>): void {
      let data = plotbars.get(index);
      if (!data) {
        data = {
          index,
          title: (opts?.title as string) ?? `plotbar_${index}`,
          color: colorString(opts?.color) ?? '#2962FF',
          values: [],
        };
        plotbars.set(index, data);
      }
      const coerce = (v: any) => (v !== null && typeof v === 'object' && 'get' in v) ? v.get(0) : v;
      data.values.push({
        time: builtins.time.get(0),
        open: Number(coerce(open)),
        high: Number(coerce(high)),
        low: Number(coerce(low)),
        close: Number(coerce(close)),
        color: colorString(coerce(opts?.color)),
      });
    },

    userSeriesSet(name: string, value: unknown): void {
      let s = userSeries.get(name);
      if (!s) {
        s = new Series<any>(Math.max(barsCount + 10, 510));
        userSeries.set(name, s);
      }
      // Extract scalar from Series objects
      const scalar = (value !== null && typeof value === 'object' && value && 'get' in (value as any))
        ? (value as any).get(0) : value;
      s.push(scalar);
    },

    userSeriesGet(name: string, offset: number): unknown {
      const s = userSeries.get(name);
      if (!s) return NA;
      const val = s.get(offset);
      return val === undefined ? NA : val;
    },

    debugVar(name: string, value: unknown): void {
      const scalar = value instanceof Series ? value.get(0) : value;
      if (scalar === undefined || scalar === null ||
          (typeof scalar === 'number' && !Number.isFinite(scalar))) {
        debugVars.set(name, 'na');
        return;
      }
      if (typeof scalar === 'number' || typeof scalar === 'boolean' || typeof scalar === 'string') {
        debugVars.set(name, String(scalar).slice(0, 200));
        return;
      }
      if (Array.isArray(scalar)) {
        debugVars.set(name, `[array ${scalar.length}]`);
        return;
      }
      debugVars.set(name, '[object]');
    },

    setMetadata(meta: ScriptMetadata): void {
      metadata = meta;
    },

    setInit(fn: () => void): void {
      initFn = fn;
    },

    setExecute(fn: () => void): void {
      executeFn = fn;
    },

    getInput(id: string): unknown {
      if (id in inputs) return inputs[id];
      // Fall back to metadata input defaults
      if (metadata) {
        const inputDef = metadata.inputs.find(i => i.id === id);
        if (inputDef) return inputDef.defaultValue;
      }
      return undefined;
    },

    getSourceInput(id: string, fallback: unknown): unknown {
      const value = id in inputs ? inputs[id] : undefined;
      if (typeof value === 'string' && value.length > 0) {
        const series = (builtins as unknown as Record<string, Series<number>>)[value];
        if (series) return series;
        if (value === 'open' || value === 'high' || value === 'low' ||
            value === 'close' || value === 'volume' || value === 'hl2' ||
            value === 'hlc3' || value === 'ohlc4') {
          return builtins[value] as Series<number>;
        }
      }
      if (value instanceof Series) return value;
      // A source input is a series name, never a number. Legacy metadata typed
      // bare `input(close)` as a float, so a stored 0 must not replace the
      // series the script compiled with.
      return fallback;
    },

    missing(name: string): unknown {
      return missingValue(name);
    },

    scalar(value: unknown): unknown {
      return value instanceof Series ? value.get(0) : value;
    },

    timeCall(timeframe?: string, session?: string, timezone?: string): number {
      if (session) {
        const result = timeFns.timeInSession(timeframe, session, timezone);
        return typeof result === 'number' ? result : NA;
      }
      const current = builtins.time.get(0);
      if (!timeframe) return current;
      const requested = canonicalTimeframe(timeframe);
      if (requested === canonicalTimeframe(timeframePeriod)) return current;
      return startOfTimeframe(current, requested);
    },

    timeCloseCall(timeframe?: string, session?: string, timezone?: string): number {
      const open = this.timeCall(timeframe, session, timezone);
      if (isNa(open)) return NA;
      const requested = canonicalTimeframe(timeframe || timeframePeriod);
      return open + inSeconds(requested) * 1000 - 1;
    },

    toInt(value: unknown): number {
      const number = Number(value instanceof Series ? value.get(0) : value);
      return Number.isFinite(number) ? Math.trunc(number) : NA;
    },

    toFloat(value: unknown): number {
      const number = Number(value instanceof Series ? value.get(0) : value);
      return Number.isFinite(number) ? number : NA;
    },

    toBool(value: unknown): number | boolean {
      const scalar = value instanceof Series ? value.get(0) : value;
      return isNa(scalar) ? NA : Boolean(scalar);
    },

    toStr(value: unknown): string {
      const scalar = value instanceof Series ? value.get(0) : value;
      return isNa(scalar) ? 'NaN' : String(scalar);
    },

    /** Pine `==` / `!=`: a comparison with `na` is `na`, not false or true. */
    eq(left: unknown, right: unknown): boolean {
      const a = left instanceof Series ? left.get(0) : left;
      const b = right instanceof Series ? right.get(0) : right;
      if (isNa(a) || isNa(b)) return NA as unknown as boolean;
      return a === b;
    },

    neq(left: unknown, right: unknown): boolean {
      const a = left instanceof Series ? left.get(0) : left;
      const b = right instanceof Series ? right.get(0) : right;
      if (isNa(a) || isNa(b)) return NA as unknown as boolean;
      return a !== b;
    },

    field(value: unknown, name: string): unknown {
      const scalar = value instanceof Series ? value.get(0) : value;
      if (scalar === null || scalar === undefined) return NA;
      if (typeof scalar !== 'object' && typeof scalar !== 'function') return NA;
      return (scalar as Record<string, unknown>)[name];
    },

    iterable(value: unknown): unknown[] {
      const scalar = value instanceof Series ? value.get(0) : value;
      if (Array.isArray(scalar)) return scalar;
      if (scalar !== null && scalar !== undefined && typeof scalar === 'object' &&
          Symbol.iterator in (scalar as object)) {
        return [...(scalar as Iterable<unknown>)];
      }
      return [];
    },

    udtCall(value: unknown, name: string, args: unknown[]): unknown {
      const scalar = value instanceof Series ? value.get(0) : value;
      if (scalar === null || scalar === undefined || typeof scalar !== 'object') return NA;
      const fn = (scalar as Record<string, unknown>)[name];
      return typeof fn === 'function' ? (fn as (...a: unknown[]) => unknown).apply(scalar, args) : NA;
    },

    drawingHandle(value: unknown): unknown {
      const scalar = value instanceof Series ? value.get(0) : value;
      return scalar !== null && typeof scalar === 'object' ? scalar : null;
    },

    drawingCall(value: unknown): unknown {
      const scalar = value instanceof Series ? value.get(0) : value;
      if (scalar !== null && typeof scalar === 'object') return scalar;
      // Pine setters on an `na` handle are no-ops and getters return `na`.
      return new Proxy({}, { get: () => undefined, set: () => true });
    },

    tuple(value: unknown, count: number): unknown[] {
      if (Array.isArray(value)) return value;
      if (value !== null && value !== undefined && typeof value === 'object' &&
          Symbol.iterator in (value as object)) {
        return [...(value as Iterable<unknown>)];
      }
      return Array.from({ length: count }, (_, index) => (index === 0 ? value : NA));
    },

    isNa,
    nz,
    fixnan,
    na: NA,
    colorCall(value: unknown): string {
      return typeof value === 'string' && value.length > 0 ? value : '#00000000';
    },

    strategy: strategyEngine,

    alert(message: string, freq?: string, site?: string): void {
      if (currentBarIndex !== lastIndex) return;
      const frequency = freq === undefined ? 'freq_once_per_bar' : String(freq);
      // One alert per call site per bar unless the script asks for every tick.
      if (site !== undefined && frequency !== 'freq_all') {
        const key = `${currentBarIndex}:${site}`;
        if (alertSites.has(key)) return;
        alertSites.add(key);
      }
      alerts.push({
        message: String(message ?? ''),
        time: builtins.time.get(0),
        barIndex: currentBarIndex,
        ...(site !== undefined ? { site } : {}),
        ...(freq !== undefined ? { freq: frequency } : {}),
      });
    },

    alertcondition(condition: unknown, title?: string, message?: string, site?: string): void {
      if (currentBarIndex !== lastIndex) return;
      const active = condition instanceof Series ? condition.get(0) : condition;
      if (!active) return;
      if (site !== undefined) {
        const key = `${currentBarIndex}:${site}`;
        if (alertSites.has(key)) return;
        alertSites.add(key);
      }
      alerts.push({
        message: String(message ?? ''),
        ...(title !== undefined ? { title: String(title) } : {}),
        ...(site !== undefined ? { site } : {}),
        time: builtins.time.get(0),
        barIndex: currentBarIndex,
        freq: 'freq_once_per_bar',
      });
    },

    log: {
      info(message: string): void {
        options.onLog?.('info', String(message ?? ''));
      },
      warning(message: string): void {
        options.onLog?.('warning', String(message ?? ''));
      },
      error(message: string): void {
        options.onLog?.('error', String(message ?? ''));
      },
    },
  };

  // Unknown members of a namespace become a recorded `na`, matching the old
  // standard-library proxy instead of throwing a TypeError mid-run.
  ctx.ta = guarded('ta', ctx.ta);
  ctx.math = guarded('math', ctx.math);
  ctx.str = guarded('str', ctx.str);
  ctx.array = guarded('array', ctx.array);
  ctx.map = guarded('map', ctx.map);
  ctx.matrix = guarded('matrix', ctx.matrix);
  ctx.color = guarded('color', ctx.color);
  ctx.line = guarded('line', ctx.line);
  ctx.label = guarded('label', ctx.label);
  ctx.box = guarded('box', ctx.box);
  ctx.table = guarded('table', ctx.table);
  ctx.linefill = guarded('linefill', ctx.linefill);
  ctx.polyline = guarded('polyline', ctx.polyline);
  ctx.strategy = guarded('strategy', ctx.strategy);
  ctx.syminfo = guarded('syminfo', ctx.syminfo);
  ctx.timeframe = guarded('timeframe', ctx.timeframe);
  ctx.chart = guarded('chart', ctx.chart);
  ctx.ticker = guarded('ticker', ctx.ticker);
  ctx.log = guarded('log', ctx.log);

  function updateBar(barIdx: number, _builtins: BuiltinVariables, _lastIndex: number): void {
    currentBarIndex = barIdx;
    lastIndex = _lastIndex;
  }

  return {
    ctx,
    get metadata() { return metadata; },
    get initFn() { return initFn; },
    get executeFn() { return executeFn; },
    plots,
    hlines,
    fills,
    bgcolors,
    barcolors,
    plotshapes,
    plotchars,
    plotarrows,
    plotcandles,
    plotbars,
    strategyEngine,
    alerts,
    missing,
    warnings,
    debugVars,
    updateBar,
  };
}
