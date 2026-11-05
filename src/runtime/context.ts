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
import { TimeframeInfo, createTimeframe, inSeconds } from './builtins/timeframe';
import { StrategyEngine, createStrategyEngine } from './builtins/strategy';
import { createLineModule } from './builtins/line';
import { createLabelModule } from './builtins/label';
import { createBoxModule } from './builtins/box';
import { createTableModule } from './builtins/table';
import { createTimeFunctions } from './builtins/time-functions';
import {
  PlotData,
  HlineData,
  FillData,
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
  math: typeof math;
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
  };

  // Drawing object modules
  line: ReturnType<typeof createLineModule>;
  label: ReturnType<typeof createLabelModule>;
  box: ReturnType<typeof createBoxModule>;
  table: ReturnType<typeof createTableModule>;

  // Time functions (top-level)
  time_close: number;
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
  request: { security: (...args: any[]) => any };

  // Ticker module
  ticker: {
    new: (...args: any[]) => string;
    standard: (symbol: unknown) => string;
    modify: (symbol: unknown, ...args: unknown[]) => string;
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
  plot(index: number, value: number | null, opts?: Partial<PlotData>): void;
  hline(index: number, price: number, opts?: Partial<HlineData>): void;
  fill(p1: number, p2: number, opts?: { color?: string }): void;
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
  /** `time(timeframe, session, timezone)` differs from the `time` variable. */
  timeCall(timeframe?: string, session?: string, timezone?: string): number;
  timeCloseCall(timeframe?: string, session?: string, timezone?: string): number;
  toInt(value: unknown): number;
  toFloat(value: unknown): number;
  toBool(value: unknown): number | boolean;
  toStr(value: unknown): string;
  /** Normalize a tuple result so destructuring never throws on `na`. */
  tuple(value: unknown, count: number): unknown[];
  missing(name: string): unknown;

  // NA helpers exposed
  isNa: typeof isNa;
  nz: typeof nz;
  fixnan: typeof fixnan;
  na: typeof NA;

  // User variable series history
  userSeriesSet(name: string, value: unknown): void;
  userSeriesGet(name: string, offset: number): unknown;

  // Strategy engine
  strategy: StrategyEngine;

  // Alert stubs
  alert(message: string, freq?: string): void;
  alertcondition(condition: boolean, title?: string, message?: string): void;

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
  missing: Set<string>;
  warnings: string[];
  updateBar(barIdx: number, builtins: BuiltinVariables, lastIndex: number): void;
}

export interface ContextOptions {
  /** Runtime input overrides keyed by the input id from the script metadata. */
  inputs?: Record<string, unknown>;
  symbol?: string;
  timeframe?: string;
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
  const strategyEngine = createStrategyEngine();
  const userSeries = new Map<string, Series<any>>();
  const lineModule = createLineModule();
  const labelModule = createLabelModule();
  const boxModule = createBoxModule();
  const tableModule = createTableModule();
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
    timenow: executionTimenow,
    get bar_index() { return currentBarIndex; },
    get last_bar_index() { return lastIndex; },
    last_bar_time: lastBarTime,
    get hl2() { return builtins.hl2 as any; },
    get hlc3() { return builtins.hlc3 as any; },
    get ohlc4() { return builtins.ohlc4 as any; },

    series(name: string): Series<number> {
      const b = builtins as unknown as Record<string, Series<number>>;
      return b[name];
    },

    ta,
    math,
    color,
    str,
    array: arrayModule,
    map: mapModule,
    matrix: matrixModule,
    syminfo: createSyminfo({
      tickerid: symbol,
      ticker: symbol.includes(':') ? symbol.split(':').pop()! : symbol,
    }),
    timeframe: createTimeframe(timeframePeriod),
    chart: {
      bg_color: '#131722',
      fg_color: '#d1d4dc',
      border_color: '#2a2e39',
      text_color: '#d1d4dc',
    },

    // Drawing objects
    line: lineModule,
    label: labelModule,
    box: boxModule,
    table: tableModule,

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
        return String(symbol ?? '');
      },
      modify(symbol: unknown, ..._args: unknown[]): string {
        return String(symbol ?? '');
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
      return {
        isfirst: currentBarIndex === 0,
        islast: currentBarIndex === lastIndex,
        ishistory: true,
        isrealtime: false,
        isconfirmed: true,
      };
    },

    state,
    persistentState,

    plot(index: number, value: number | null, opts?: Partial<PlotData>): void {
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
      });
    },

    hline(index: number, price: number, opts?: Partial<HlineData>): void {
      hlines.push({
        index,
        price,
        title: opts?.title ?? `hline_${index}`,
        color: opts?.color ?? '#787B86',
      });
    },

    fill(p1: number, p2: number, opts?: { color?: string }): void {
      fills.push({ plot1: p1, plot2: p2, color: opts?.color ?? 'rgba(0,0,0,0.1)' });
    },

    bgcolor(clr: string): void {
      bgcolors.push({ time: builtins.time.get(0), color: clr, barIndex: currentBarIndex });
    },

    barcolor(clr: string): void {
      barcolors.push({ time: builtins.time.get(0), color: clr });
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
      });
    },

    plotcandle(index: number, open: number, high: number, low: number, close: number, opts?: Record<string, unknown>): void {
      let data = plotcandles.get(index);
      if (!data) {
        data = {
          index,
          title: (opts?.title as string) ?? `plotcandle_${index}`,
          color: (opts?.color as string) ?? '#2962FF',
          wickcolor: (opts?.wickcolor as string) ?? '#737375',
          bordercolor: (opts?.bordercolor as string) ?? '#2962FF',
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
      });
    },

    plotbar(index: number, open: number, high: number, low: number, close: number, opts?: Record<string, unknown>): void {
      let data = plotbars.get(index);
      if (!data) {
        data = {
          index,
          title: (opts?.title as string) ?? `plotbar_${index}`,
          color: (opts?.color as string) ?? '#2962FF',
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
      if (typeof value === 'number' || value instanceof Series) return value;
      return fallback;
    },

    missing(name: string): unknown {
      return missingValue(name);
    },

    scalar(value: unknown): unknown {
      return value instanceof Series ? value.get(0) : value;
    },

    timeCall(timeframe?: string, session?: string, timezone?: string): number {
      if (!session) return builtins.time.get(0);
      const result = timeFns.timeInSession(timeframe, session, timezone);
      return typeof result === 'number' ? result : NA;
    },

    timeCloseCall(timeframe?: string, session?: string, timezone?: string): number {
      const open = this.timeCall(timeframe, session, timezone);
      return isNa(open) ? NA : open + barMs;
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

    strategy: strategyEngine,

    alert(_message: string, _freq?: string): void {
      // no-op stub
    },

    alertcondition(_condition: boolean, _title?: string, _message?: string): void {
      // no-op stub
    },

    log: {
      info(_message: string): void { /* no-op */ },
      warning(_message: string): void { /* no-op */ },
      error(_message: string): void { /* no-op */ },
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
    missing,
    warnings,
    updateBar,
  };
}
