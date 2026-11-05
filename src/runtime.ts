import {
  compile as compileSource,
  type CompileResult,
  type InputDef,
  type PlotDef,
  type ScriptMetadata,
} from './compiler/index';
import { buildRunner, executeRunner, type Runner } from './runtime/engine';
import type { Bar } from './data/types';
import type { ExecutionResult } from './runtime/index';
import { canonicalTimeframe } from './timeframe';
import type {
  PineBar,
  PineBox,
  PineCompileOptions,
  PineDrawings,
  PineInput,
  PineLabel,
  PineLine,
  PinePlot,
  PinePlotMeta,
  PineProgram,
  PineRunBars,
  PineRunResult,
  PineScriptMeta,
} from './types';

export const DEFAULT_ID = 'pine-engine';

const EMPTY_DRAWINGS: PineDrawings = { lines: [], boxes: [], labels: [], backgrounds: [] };

const PLOT_TYPES: Record<string, string> = {
  line: 'line',
  style_line: 'line',
  histogram: 'histogram',
  style_histogram: 'histogram',
  area: 'area',
  style_area: 'area',
  areabr: 'area',
  style_areabr: 'area',
  stepline: 'stepline',
  style_stepline: 'stepline',
  stepline_diamond: 'stepline',
  style_stepline_diamond: 'stepline',
  circles: 'circles',
  style_circles: 'circles',
  cross: 'cross',
  style_cross: 'cross',
  columns: 'columns',
  style_columns: 'columns',
};

function inputValue(value: unknown, type: string): number | boolean | string {
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') {
    return value;
  }
  if (type === 'bool') return false;
  if (type === 'string' || type === 'color' || type === 'source' || type === 'timeframe' ||
      type === 'session' || type === 'symbol' || type === 'text_area') {
    return '';
  }
  return 0;
}

function inputOf(input: InputDef): PineInput {
  return {
    id: input.id,
    name: input.title || input.id,
    type: input.type,
    defval: inputValue(input.defaultValue, input.type),
  };
}

/** `#RRGGBBAA` becomes `#RRGGBB` plus Pine's 0-100 transparency. */
function plotColor(color: string): { color: string; transparency?: number } {
  if (/^#[0-9a-fA-F]{8}$/.test(color)) {
    const alpha = parseInt(color.slice(7), 16);
    const transparency = Math.round((1 - alpha / 255) * 100);
    return { color: color.slice(0, 7), transparency: transparency > 0 ? transparency : undefined };
  }
  return { color };
}

function plotMeta(plot: PlotDef): PinePlotMeta {
  const { color, transparency } = plotColor(plot.color);
  return {
    id: `plot_${plot.index}`,
    title: plot.title || `plot_${plot.index}`,
    type: PLOT_TYPES[plot.style] ?? 'line',
    color,
    width: plot.linewidth,
    transparency,
  };
}

function warningsOf(compiled: CompileResult): string[] {
  return compiled.diagnostics
    .filter((diagnostic) => diagnostic.severity === 'warning')
    .map((diagnostic) => `Line ${diagnostic.loc?.line ?? '?'}: ${diagnostic.message}`);
}

function firstError(compiled: CompileResult): string {
  const error = compiled.diagnostics.find((diagnostic) => diagnostic.severity === 'error');
  if (!error) return 'The script could not be compiled';
  return `Line ${error.loc?.line ?? '?'}: ${error.message}`;
}

function metaOf(compiled: CompileResult, name: string): PineScriptMeta {
  const metadata: ScriptMetadata | null = compiled.metadata;
  return {
    name: metadata?.title || name,
    shortName: metadata?.shorttitle ? metadata.shorttitle : undefined,
    overlay: metadata?.overlay ?? false,
    inputs: (metadata?.inputs ?? []).map(inputOf),
    plots: (metadata?.plots ?? []).map(plotMeta),
    warnings: warningsOf(compiled),
  };
}

function emptyRun(
  name: string,
  error: string,
  inputs: PineInput[] = [],
  warnings: string[] = [],
): PineRunResult {
  return {
    ok: false,
    error,
    name,
    overlay: false,
    plots: [],
    drawings: EMPTY_DRAWINGS,
    inputs,
    warnings,
    missingStd: [],
  };
}

function plotValues(
  plots: ExecutionResult['plots'],
  meta: PinePlotMeta[],
  bars: readonly PineBar[],
): PinePlot[] {
  const byTime = new Map<number, number>();
  bars.forEach((bar, index) => {
    if (!byTime.has(bar.time)) byTime.set(bar.time, index);
  });

  return meta.map((plot) => {
    const values = new Array<number>(bars.length).fill(Number.NaN);
    const data = plots.find((candidate) => `plot_${candidate.index}` === plot.id);
    for (const entry of data?.values ?? []) {
      const index = entry.barIndex ?? byTime.get(entry.time);
      if (index === undefined || index < 0 || index >= values.length) continue;
      values[index] = entry.value === null ? Number.NaN : entry.value;
    }
    return { ...plot, values };
  });
}

function xlocOf(value: unknown): 'bar_index' | 'bar_time' {
  return value === 'bar_time' ? 'bar_time' : 'bar_index';
}

function extendOf(value: unknown): PineLine['extend'] {
  return value === 'left' || value === 'right' || value === 'both' ? value : 'none';
}

function lineStyleOf(value: unknown): PineLine['style'] {
  return value === 'dashed' || value === 'dotted' ? value : 'solid';
}

function drawingsOf(result: ExecutionResult, bars: readonly PineBar[]): PineDrawings {
  const lines: PineLine[] = [];
  for (const raw of (result.lines ?? []) as Record<string, unknown>[]) {
    const style = String(raw.style ?? 'solid');
    lines.push({
      id: Number(raw.id),
      x1: Number(raw.x1),
      y1: Number(raw.y1),
      x2: Number(raw.x2),
      y2: Number(raw.y2),
      xloc: xlocOf(raw.xloc),
      extend: extendOf(raw.extend),
      color: String(raw.color ?? '#2962FF'),
      style: lineStyleOf(style),
      width: Number(raw.width ?? 1),
      arrowLeft: style === 'arrow_left' || style === 'arrow_both',
      arrowRight: style === 'arrow_right' || style === 'arrow_both',
    });
  }

  const boxes: PineBox[] = ((result.boxes ?? []) as Record<string, unknown>[]).map((raw) => ({
    id: Number(raw.id),
    left: Number(raw.left),
    top: Number(raw.top),
    right: Number(raw.right),
    bottom: Number(raw.bottom),
    xloc: xlocOf(raw.xloc),
    extend: extendOf(raw.extend),
    backgroundColor: String(raw.bgcolor ?? ''),
    borderColor: String(raw.border_color ?? ''),
    borderWidth: Number(raw.border_width ?? 1),
    borderStyle: lineStyleOf(raw.border_style),
    text: String(raw.text ?? ''),
    textColor: String(raw.text_color ?? ''),
    textSize: String(raw.text_size ?? 'normal'),
    hAlign: raw.text_halign === 'left' || raw.text_halign === 'right' ? raw.text_halign : 'center',
    vAlign: raw.text_valign === 'top' || raw.text_valign === 'bottom' ? raw.text_valign : 'center',
  }));

  const labels: PineLabel[] = ((result.labels ?? []) as Record<string, unknown>[]).map((raw) => ({
    id: Number(raw.id),
    x: Number(raw.x),
    y: Number(raw.y),
    xloc: xlocOf(raw.xloc),
    yloc: raw.yloc === 'abovebar' || raw.yloc === 'belowbar' || raw.yloc === 'top' ||
      raw.yloc === 'bottom' ? raw.yloc : 'price',
    text: String(raw.text ?? ''),
    tooltip: String(raw.tooltip ?? ''),
    color: String(raw.color ?? ''),
    textColor: String(raw.textcolor ?? ''),
    style: String(raw.style ?? 'label_center'),
    size: String(raw.size ?? 'normal'),
    textAlign: raw.textalign === 'left' || raw.textalign === 'right' ? raw.textalign : 'center',
  }));

  const backgrounds: PineDrawings['backgrounds'] = [];
  for (const entry of result.bgcolors ?? []) {
    const index = entry.barIndex;
    if (index === undefined) continue;
    const from = bars[index]?.time;
    if (from === undefined) continue;
    const to = bars[index + 1]?.time ?? from + 1;
    const last = backgrounds[backgrounds.length - 1];
    if (last && last.color === entry.color && last.to === from) {
      last.to = to;
    } else {
      backgrounds.push({ from, to, color: entry.color });
    }
  }

  return { lines, boxes, labels, backgrounds };
}

function barOf(bar: PineBar): Bar {
  return {
    time: bar.time,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
  };
}

/**
 * Compile a script once so it can run over many instruments. The scanner
 * depends on this: a full-market scan would otherwise re-parse the script for
 * every symbol.
 */
export function compilePine(options: PineCompileOptions): PineProgram {
  const name = options.name ?? 'Pine';
  const compiled = compileSource(options.source);
  if (!compiled.success || !compiled.code) {
    const error = firstError(compiled);
    return {
      ok: false,
      error,
      meta: { ...metaOf(compiled, name), name },
      run: () => emptyRun(name, error),
    };
  }

  const meta = metaOf(compiled, name);
  const compileInputs = options.inputs ?? {};
  let runner: Runner;
  try {
    runner = buildRunner(compiled.code);
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : String(cause);
    return {
      ok: false,
      error,
      meta,
      run: () => emptyRun(name, error),
    };
  }

  return {
    ok: true,
    meta,
    run({ bars, timeframe, symbol, inputs }: PineRunBars): PineRunResult {
      const values: Record<string, unknown> = { ...compileInputs, ...(inputs ?? {}) };
      try {
        const result = executeRunner(runner, bars.map(barOf), {
          inputs: values,
          symbol,
          timeframe: canonicalTimeframe(timeframe ?? ''),
        });
        const runtimeWarnings = result.warnings ?? [];
        return {
          ok: true,
          name: meta.name,
          overlay: meta.overlay,
          plots: plotValues(result.plots, meta.plots, bars),
          drawings: drawingsOf(result, bars),
          inputs: meta.inputs,
          warnings: [...meta.warnings, ...runtimeWarnings],
          missingStd: result.missing ?? [],
        };
      } catch (cause) {
        return emptyRun(
          meta.name,
          cause instanceof Error ? cause.message : String(cause),
          meta.inputs,
          meta.warnings,
        );
      }
    },
  };
}

/** Compile and run in one call, for one-off executions. */
export function runPineScript(
  options: PineCompileOptions & Partial<PineRunBars> & { bars: readonly PineBar[] },
): PineRunResult {
  const program = compilePine(options);
  if (!program.ok) return emptyRun(program.meta.name, program.error ?? 'Compile failed');
  try {
    return program.run(options);
  } catch (cause) {
    return emptyRun(program.meta.name, cause instanceof Error ? cause.message : String(cause));
  }
}
