import {
  transpileToPineJS,
  type IndicatorFactory,
  type TranspileToPineJSResult,
} from '@opus-aether-ai/pine-transpiler';
import { createStd, createStdProxy } from './std';
import { Series, numberValue, type PineContext } from './series';
import { timeframeMinutes, timeframeMs } from './timeframe';
import type { PineInput, PinePlot, PineRunOptions, PineRunResult, PineVisualEvent } from './types';

type Factory = IndicatorFactory;
type CustomIndicator = ReturnType<Factory>;
type Instance = InstanceType<CustomIndicator['constructor']>;
type MainContext = Parameters<Instance['main']>[0];
type InputCallback = Parameters<Instance['main']>[1];

export const DEFAULT_ID = 'pine-engine';

/**
 * Transpile and execute a Pine v6 script over closed bars.
 *
 * The transpiler is MIT (`@opus-aether-ai/pine-transpiler`) and the technical
 * functions come from MIT OakScriptJS, so the whole path is free of AGPL code.
 */
export function runPineScript(options: PineRunOptions): PineRunResult {
  const { source, bars } = options;
  const name = options.name ?? 'Pine';
  const indicatorId = options.id ?? DEFAULT_ID;
  const transpiled: TranspileToPineJSResult = transpileToPineJS(source, indicatorId, name);

  if (!transpiled.success || !transpiled.indicatorFactory) {
    return {
      ok: false,
      error: transpiled.error ?? 'The script could not be transpiled',
      name,
      overlay: false,
      plots: [],
      visuals: [],
      inputs: [],
      missingStd: [],
    };
  }

  const timeframe = options.timeframe ?? '';
  const minutes = timeframeMinutes(timeframe);
  const missing = new Set<string>();
  const context: PineContext = {
    barIndex: 0,
    totalBars: bars.length,
    isRealtime: false,
    vars: [],
    varIndex: 0,
    symbol: {
      tickerid: options.symbol ?? 'PINE:ENGINE',
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
    const indicator = transpiled.indicatorFactory({
      Std: createStdProxy(std, missing),
    } as unknown as Parameters<Factory>[0]);
    const instance = new indicator.constructor();
    const metainfo = indicator.metainfo;
    const inputs = (metainfo.inputs ?? []) as PineInput[];
    const defaults = (metainfo.defaults?.inputs ?? {}) as Record<string, unknown>;
    const inputValues = inputs.map((input) => {
      const override = options.inputs?.[input.id];
      if (override !== undefined) return override;
      const declared = defaults[input.id];
      return declared !== undefined ? declared : input.defval;
    });
    const inputCallback = ((index: number) => inputValues[index] ?? 0) as unknown as InputCallback;

    const plots: PinePlot[] = (metainfo.plots ?? []).map((plot) => ({
      id: String(plot.id),
      title: String(plot.id),
      type: String(plot.type ?? 'line'),
      values: [],
    }));
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
          overlay: metainfo.is_price_study === true,
          plots: [],
          visuals,
          inputs,
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
      overlay: metainfo.is_price_study === true,
      plots,
      visuals,
      inputs,
      missingStd: [...missing].sort(),
    };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : String(cause),
      name,
      overlay: false,
      plots: [],
      visuals: [],
      inputs: [],
      missingStd: [...missing].sort(),
    };
  }
}
