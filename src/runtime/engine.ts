import type { Bar } from '../data/types';
import { createBuiltinVariables } from './builtins/variables';
import { createTaModule } from './builtins/ta';
import { createContext, type ContextOptions } from './context';
import { createRequestModule, cloneSnapshot, resampleBars } from './builtins/request';
import { getFixnanState, resetNaState, setFixnanState } from './types/na';
import { Series } from './types/series';
import type {
  ExecutionResult,
  PlotData,
  StrategyResult,
} from './index';
import type { ScriptMetadata } from '../compiler/index';
import type { BuiltinVariables } from './builtins/variables';

/** A compiled script as an executable function bound to one runtime context. */
export type Runner = (ctx: unknown) => void;

/**
 * Build the JS function for a compiled script once. Compile-once/run-many is
 * the scanner contract, so the same function is reused for every instrument.
 */
export function buildRunner(compiledCode: string): Runner {
  const trimmed = compiledCode.trim();
  const source = trimmed.startsWith('(function')
    ? `return (${compiledCode})(__rt);`
    : compiledCode;
  return new Function('__rt', source) as Runner;
}

export interface Engine {
  execute(compiledCode: string): ExecutionResult;
}

export function executeRunner(
  runner: Runner,
  bars: Bar[],
  options: ContextOptions = {},
): ExecutionResult {
  const windowedBuiltins = createWindowedBuiltins(bars);
  let currentBarIdx = 0;
  const ta = createTaModule(
    () => currentBarIdx,
    () => windowedBuiltins.high,
    () => windowedBuiltins.low,
    () => windowedBuiltins.close,
    () => windowedBuiltins.volume,
    () => windowedBuiltins.open,
  );

  const lastBarTime = bars.length > 0 ? bars[bars.length - 1]!.time : 0;
  const executionTimenow = Date.now();
  const internals = createContext(
    windowedBuiltins,
    ta,
    bars.length,
    lastBarTime,
    executionTimenow,
    options,
  );
  const { ctx } = internals;

  // A security call whose expression is not a source spec is evaluated by
  // running the whole script on the resampled HTF bars and snapshotting the
  // expression per HTF bar. One run per call site and timeframe.
  const probeCache = new Map<string, unknown[]>();
  const runProbe = options.securityProbe?.active
    ? undefined
    : (site: string, timeframe: string): unknown[] => {
        const key = `${site}@${timeframe}`;
        const cached = probeCache.get(key);
        if (cached) return cached;
        const htfBars = resampleBars(bars, timeframe);
        if (htfBars.length === 0) return [];
        const capture: unknown[] = [];
        const savedFixnan = getFixnanState();
        resetNaState();
        try {
          executeRunner(runner, htfBars, {
            ...options,
            timeframe,
            lowerBars: undefined,
            onLowerTimeframe: undefined,
            securityProbe: {
              active: true,
              site,
              timeframe,
              capture: (index, value) => {
                capture[index] = cloneSnapshot(value);
              },
            },
          });
        } catch {
          // A script-level guard (e.g. "chart timeframe must be lower") can
          // reject the probe's context. The main run keeps its na fallback.
          probeCache.set(key, []);
          setFixnanState(savedFixnan);
          return [];
        } finally {
          setFixnanState(savedFixnan);
        }
        probeCache.set(key, capture);
        return capture;
      };

  internals.ctx.request = createRequestModule(
    bars,
    () => currentBarIdx,
    () => options.timeframe ?? '',
    () => options.symbol ?? '',
    (message) => internals.warnings.push(message),
    options.lowerBars,
    options.onLowerTimeframe,
    runProbe,
    options.securityProbe,
  );

  resetNaState();

  try {
    runner(ctx);
  } catch (cause) {
    throw new Error(`Failed to evaluate compiled code: ${errorMessage(cause)}`);
  }

  if (internals.initFn) {
    try {
      internals.initFn();
    } catch (cause) {
      throw new Error(`Init function error: ${errorMessage(cause)}`);
    }
  }

  const lastIndex = bars.length - 1;
  for (let i = 0; i < bars.length; i++) {
    currentBarIdx = i;
    internals.updateBar(i, windowedBuiltins, lastIndex);
    updateWindowedBuiltins(windowedBuiltins, bars, i);

    const bar = bars[i]!;
    internals.strategyEngine.processBar(i, bar.open, bar.high, bar.low, bar.close, bar.time);

    if (internals.executeFn) {
      try {
        internals.executeFn();
      } catch (cause) {
        throw new Error(`Bar ${i}: ${errorMessage(cause)}`);
      }
    }
  }

  const defaultMeta: ScriptMetadata = {
    type: 'indicator',
    title: 'Unnamed Script',
    shorttitle: '',
    overlay: false,
    inputs: [],
    plots: [],
  };

  const meta = internals.metadata ?? defaultMeta;
  const plots: PlotData[] = Array.from(internals.plots.values());
  let strategyResult: StrategyResult | undefined;
  if (meta.type === 'strategy') {
    strategyResult = internals.strategyEngine.getResult();
  }

  return {
    metadata: meta,
    plots,
    hlines: internals.hlines,
    fills: internals.fills,
    bgcolors: internals.bgcolors,
    barcolors: internals.barcolors,
    plotshapes: Array.from(internals.plotshapes.values()),
    plotchars: Array.from(internals.plotchars.values()),
    plotarrows: Array.from(internals.plotarrows.values()),
    plotcandles: Array.from(internals.plotcandles.values()),
    plotbars: Array.from(internals.plotbars.values()),
    strategy: strategyResult,
    lines: ctx.line?.all ?? [],
    labels: ctx.label?.all ?? [],
    boxes: ctx.box?.all ?? [],
    tables: ctx.table?.all ?? [],
    linefills: ctx.linefill?.all ?? [],
    polylines: ctx.polyline?.all ?? [],
    missing: [...internals.missing].sort(),
    warnings: internals.warnings,
  };
}

/** Compile-and-run helper kept for direct tests and one-off executions. */
export function createEngine(bars: Bar[], options: ContextOptions = {}): Engine {
  return {
    execute(compiledCode: string): ExecutionResult {
      return executeRunner(buildRunner(compiledCode), bars, options);
    },
  };
}

function errorMessage(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  return String(cause);
}

function createWindowedBuiltins(bars: Bar[]): BuiltinVariables {
  const size = Math.max(bars.length + 10, 510);
  return {
    open: new Series<number>(size),
    high: new Series<number>(size),
    low: new Series<number>(size),
    close: new Series<number>(size),
    volume: new Series<number>(size),
    time: new Series<number>(size),
    bar_index: new Series<number>(size),
    hl2: new Series<number>(size),
    hlc3: new Series<number>(size),
    ohlc4: new Series<number>(size),
  };
}

function updateWindowedBuiltins(wb: BuiltinVariables, bars: Bar[], i: number): void {
  const bar = bars[i]!;
  wb.open.push(bar.open);
  wb.high.push(bar.high);
  wb.low.push(bar.low);
  wb.close.push(bar.close);
  wb.volume.push(bar.volume);
  wb.time.push(bar.time);
  wb.bar_index.push(i);
  wb.hl2.push((bar.high + bar.low) / 2);
  wb.hlc3.push((bar.high + bar.low + bar.close) / 3);
  wb.ohlc4.push((bar.open + bar.high + bar.low + bar.close) / 4);
}
