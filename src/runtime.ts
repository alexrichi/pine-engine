import {
  extractMetadata,
  parse,
  transpileToPineJS,
  type IndicatorFactory,
  type ParsedPlot,
} from '@opus-aether-ai/pine-transpiler';
import { createStd, createStdProxy } from './std';
import { Series, numberValue, type PineContext } from './series';
import { timeframeMinutes, timeframeMs } from './timeframe';
import type {
  PineBar,
  PineCompileOptions,
  PineInput,
  PinePlot,
  PineProgram,
  PineRunBars,
  PineRunResult,
  PineScriptMeta,
  PineVisualEvent,
} from './types';

type Factory = IndicatorFactory;
type CustomIndicator = ReturnType<Factory>;
type Instance = InstanceType<CustomIndicator['constructor']>;
type MainContext = Parameters<Instance['main']>[0];
type InputCallback = Parameters<Instance['main']>[1];

export const DEFAULT_ID = 'pine-engine';

const EMPTY_META: PineScriptMeta = {
  name: 'Pine',
  overlay: false,
  inputs: [],
  plots: [],
};

function failedRun(name: string, error: string, inputs: PineInput[] = []): PineRunResult {
  return {
    ok: false,
    error,
    name,
    overlay: false,
    plots: [],
    visuals: [],
    inputs,
    missingStd: [],
  };
}

/**
 * Plot titles live only in the parsed AST: the indicator metainfo carries ids
 * and styles, not labels. A failure here is not fatal, ids stay as titles.
 */
function plotTitles(source: string): Map<string, string> {
  const titles = new Map<string, string>();
  try {
    const ast = parse(source) as unknown as Parameters<typeof extractMetadata>[0];
    const metadata = extractMetadata(ast) as unknown as { plots?: ParsedPlot[] };
    for (const plot of metadata.plots ?? []) {
      if (plot.id && plot.title) titles.set(plot.id, plot.title);
    }
  } catch {
    // Titles are cosmetic; the ids still identify the columns.
  }
  return titles;
}

/**
 * Transpile a script once so it can run over many instruments. The scanner
 * depends on this: a full-market scan would otherwise re-parse the script for
 * every symbol.
 */
export function compilePine(options: PineCompileOptions): PineProgram {
  const name = options.name ?? 'Pine';
  const indicatorId = options.id ?? DEFAULT_ID;
  const transpiled = transpileToPineJS(options.source, indicatorId, name);

  if (!transpiled.success || !transpiled.indicatorFactory) {
    const error = transpiled.error ?? 'The script could not be transpiled';
    return {
      ok: false,
      error,
      meta: { ...EMPTY_META, name },
      run: () => failedRun(name, error),
    };
  }

  const factory = transpiled.indicatorFactory;
  const titles = plotTitles(options.source);

  // The factory binds `Std` at construction time, so metainfo is read once
  // through an inert library and each run builds its own bound factory.
  const inert = new Proxy(
    {},
    {
      get: () => () => Number.NaN,
    },
  );
  const probe = factory({ Std: inert } as unknown as Parameters<Factory>[0]);
  const metainfo = probe.metainfo;
  const declaredInputs = (metainfo.inputs ?? []) as PineInput[];
  const defaults = (metainfo.defaults?.inputs ?? {}) as Record<string, unknown>;

  const inputValues = declaredInputs.map((input) => {
    const override = options.inputs?.[input.id];
    if (override !== undefined) return override;
    const declared = defaults[input.id];
    return declared !== undefined ? declared : input.defval;
  });
  const inputCallback = ((index: number) => inputValues[index] ?? 0) as unknown as InputCallback;

  const plotMeta = (metainfo.plots ?? []).map((plot) => ({
    id: String(plot.id),
    title: titles.get(String(plot.id)) ?? String(plot.id),
    type: String(plot.type ?? 'line'),
  }));

  const meta: PineScriptMeta = {
    name,
    overlay: metainfo.is_price_study === true,
    inputs: declaredInputs,
    plots: plotMeta,
  };

  return {
    ok: true,
    meta,
    run({ bars, timeframe = '', symbol }: PineRunBars): PineRunResult {
      const minutes = timeframeMinutes(timeframe);
      const missing = new Set<string>();
      const context: PineContext = {
        barIndex: 0,
        totalBars: bars.length,
        isRealtime: false,
        vars: [],
        varIndex: 0,
        symbol: {
          tickerid: symbol ?? 'PINE:ENGINE',
          timezone: 'UTC',
          session: '24x7',
          pricescale: 100,
          minmov: 1,
          timeframe,
        },
        new_var(value) {
          const index = this.varIndex;
          let series = this.vars[index];
          if (!series) {
            series = new Series();
            this.vars.push(series);
          }
          series.push(value);
          this.varIndex += 1;
          return series;
        },
        reset() {
          this.varIndex = 0;
        },
      };

      const std = createStd({
        bars,
        context,
        timeframe,
        minutes,
        barMs: timeframeMs(timeframe),
        missing,
      });

      try {
        const indicator = factory({
          Std: createStdProxy(std, missing),
        } as unknown as Parameters<Factory>[0]);
        const instance = new indicator.constructor();

        const plots: PinePlot[] = plotMeta.map((plot) => ({ ...plot, values: [] }));
        const visuals: PineVisualEvent[] = [];

        for (let bar = 0; bar < bars.length; bar += 1) {
          context.barIndex = bar;
          context.reset();
          const output = instance.main(context as unknown as MainContext, inputCallback);
          if (!Array.isArray(output)) {
            return {
              ok: false,
              error: 'The transpiled script returned no plot array',
              name,
              overlay: meta.overlay,
              plots: [],
              visuals,
              inputs: declaredInputs,
              missingStd: [...missing].sort(),
            };
          }
          const values = output as unknown[];
          for (let index = 0; index < plots.length; index += 1) {
            plots[index]!.values.push(numberValue(values[index]));
          }
          const events = (output as { __visualEvents?: PineVisualEvent[] }).__visualEvents;
          if (events) visuals.push(...events);
        }

        return {
          ok: true,
          name,
          overlay: meta.overlay,
          plots,
          visuals,
          inputs: declaredInputs,
          missingStd: [...missing].sort(),
        };
      } catch (cause) {
        return {
          ok: false,
          error: cause instanceof Error ? cause.message : String(cause),
          name,
          overlay: meta.overlay,
          plots: [],
          visuals: [],
          inputs: declaredInputs,
          missingStd: [...missing].sort(),
        };
      }
    },
  };
}

/** Compile and run in one call, for one-off executions. */
export function runPineScript(
  options: PineCompileOptions & Partial<PineRunBars> & { bars: readonly PineBar[] },
): PineRunResult {
  const program = compilePine(options);
  if (!program.ok) return failedRun(program.meta.name, program.error ?? 'Compile failed');
  return program.run(options);
}
