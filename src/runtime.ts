import {
  transpileToPineJS,
  type IndicatorFactory,
} from '@opus-aether-ai/pine-transpiler';
import { createStd, createStdProxy } from './std';
import { rewritePrimitiveMethods } from './methods';
import { neutralizeSecurity } from './security';
import { Series, numberValue, type PineContext } from './series';
import { timeframeMinutes, timeframeMs } from './timeframe';
import type {
  PineBar,
  PineCompileOptions,
  PineInput,
  PineLineStyle,
  PinePlot,
  PinePlotMeta,
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

interface PlotStyleMeta {
  linestyle: number;
  visible?: boolean;
  linewidth: number;
  plottype?: number | string;
  color: string;
  transparency?: number;
}

export const DEFAULT_ID = 'pine-engine';

const EMPTY_META: PineScriptMeta = {
  name: 'Pine',
  overlay: false,
  inputs: [],
  plots: [],
  warnings: [],
};

/** PineJS `linestyle`: 0 solid, 1 dotted, 2 dashed. */
const LINE_STYLES: Record<number, PineLineStyle> = {
  0: 'solid',
  1: 'dotted',
  2: 'dashed',
};

/** PineJS `plottype`: 0 line, 1 histogram; every other value is already a name. */
const PLOT_TYPES: Record<number, string> = {
  0: 'line',
  1: 'histogram',
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
    warnings: [],
  };
}

function transparencyOf(style: PlotStyleMeta | undefined): number | undefined {
  const value = style?.transparency;
  return typeof value === 'number' && value > 0 ? value : undefined;
}

/**
 * Plot metadata from the indicator metainfo: `styles` carries the titles and
 * `defaults.styles` the resolved color, width and line style.
 */
function plotMeta(
  plots: readonly { id: string; type?: string }[] | undefined,
  styles: Record<string, { title?: string }> | undefined,
  defaults: Record<string, PlotStyleMeta> | undefined,
): PinePlotMeta[] {
  return (plots ?? []).map((plot) => {
    const id = String(plot.id);
    const style = defaults?.[id];
    const type = String(plot.type ?? 'line');
    return {
      id,
      title: String(styles?.[id]?.title ?? id),
      type: PLOT_TYPES[Number(style?.plottype ?? type)] ?? type,
      color: style?.color,
      width: style?.linewidth,
      lineStyle: style ? LINE_STYLES[style.linestyle] ?? 'solid' : undefined,
      transparency: transparencyOf(style),
    };
  });
}

/**
 * Transpile a script once so it can run over many instruments. The scanner
 * depends on this: a full-market scan would otherwise re-parse the script for
 * every symbol.
 */
export function compilePine(options: PineCompileOptions): PineProgram {
  const name = options.name ?? 'Pine';
  const indicatorId = options.id ?? DEFAULT_ID;
  // Primitive `method` calls carry no prototype, so call sites are lowered to
  // plain function calls before the transpiler sees them.
  const rewritten = rewritePrimitiveMethods(options.source);
  // The transpiler's `request.security` returns the chart's own value for any
  // symbol or timeframe, which is silently wrong; neutralize it and tell the
  // caller what the script asked for.
  const { source, calls: securityCalls } = neutralizeSecurity(rewritten);
  const warnings = securityCalls.length
    ? [
        `request.security is not supported yet (${securityCalls
          .map((call) => `${call.symbol} ${call.timeframe}`)
          .join(', ')}); its values are na`,
      ]
    : [];
  const transpiled = transpileToPineJS(source, indicatorId, name);

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

  const compileInputs = declaredInputs.map((input) => {
    const override = options.inputs?.[input.id];
    if (override !== undefined) return override;
    const declared = defaults[input.id];
    return declared !== undefined ? declared : input.defval;
  });

  const plotMetaList = plotMeta(
    metainfo.plots as readonly { id: string; type?: string }[] | undefined,
    metainfo.styles as Record<string, { title?: string }> | undefined,
    metainfo.defaults?.styles as Record<string, PlotStyleMeta> | undefined,
  );

  const meta: PineScriptMeta = {
    name: String(metainfo.description ?? name),
    shortName: metainfo.shortDescription ? String(metainfo.shortDescription) : undefined,
    overlay: metainfo.is_price_study === true,
    inputs: declaredInputs,
    plots: plotMetaList,
    warnings,
  };

  return {
    ok: true,
    meta,
    run({ bars, timeframe = '', symbol, inputs }: PineRunBars): PineRunResult {
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

      const inputValues = inputs
        ? declaredInputs.map((input) => {
            const override = inputs[input.id];
            if (override !== undefined) return override;
            return compileInputs[declaredInputs.indexOf(input)] ?? input.defval;
          })
        : compileInputs;
      const inputCallback = ((index: number) =>
        inputValues[index] ?? 0) as unknown as InputCallback;

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

        const plots: PinePlot[] = plotMetaList.map((plot) => ({ ...plot, values: [] }));
        const visuals: PineVisualEvent[] = [];

        for (let bar = 0; bar < bars.length; bar += 1) {
          context.barIndex = bar;
          context.reset();
          const output = instance.main(context as unknown as MainContext, inputCallback);
          if (!Array.isArray(output)) {
            return {
              ok: false,
              error: 'The transpiled script returned no plot array',
              name: meta.name,
              overlay: meta.overlay,
              plots: [],
              visuals,
              inputs: declaredInputs,
              missingStd: [...missing].sort(),
              warnings,
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
          name: meta.name,
          overlay: meta.overlay,
          plots,
          visuals,
          inputs: declaredInputs,
          missingStd: [...missing].sort(),
              warnings,
        };
      } catch (cause) {
        return {
          ok: false,
          error: cause instanceof Error ? cause.message : String(cause),
          name: meta.name,
          overlay: meta.overlay,
          plots: [],
          visuals: [],
          inputs: declaredInputs,
          missingStd: [...missing].sort(),
              warnings,
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
