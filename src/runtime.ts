import {
  compile as compileSource,
  type CompileResult,
  type InputDef,
  type PlotDef,
  type ScriptMetadata,
} from './compiler/index';
import { buildRunner, executeRunner, type Runner } from './runtime/engine';
import type { Bar } from './data/types';
import type { ExecutionResult, FillRef } from './runtime/index';
import { canonicalTimeframe } from './timeframe';
import type {
  PineBar,
  PineBarColor,
  PineBox,
  PineCandleBarColor,
  PineCandleSeries,
  PineCompileOptions,
  PineDrawings,
  PineFill,
  PineFillAnchor,
  PineInput,
  PineLabel,
  PineLine,
  PinePlot,
  PinePlotMeta,
  PinePriceLine,
  PineProgram,
  PineRunBars,
  PineRunResult,
  PineScriptMeta,
  PineTable,
  PineTableCell,
  PineTableMerge,
  PineShapePoint,
  PineLinefill,
  PinePolyline,
  PinePolylinePoint,
} from './types';

export const DEFAULT_ID = 'pine-engine';

const EMPTY_DRAWINGS: PineDrawings = {
  lines: [],
  boxes: [],
  labels: [],
  backgrounds: [],
  linefills: [],
  polylines: [],
};

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
      type === 'session' || type === 'symbol' || type === 'text_area' || type === 'enum') {
    return '';
  }
  return 0;
}

function inputOf(input: InputDef): PineInput {
  return {
    id: input.id,
    // Keep an explicit blank title blank: it is Pine's "no label" idiom and the
    // settings dialog understands it. An omitted title already defaults to the id.
    name: input.title,
    type: input.type,
    defval: inputValue(input.defaultValue, input.type),
    ...(input.options ? { options: input.options } : {}),
    ...(input.group ? { group: input.group } : {}),
    ...(input.inline ? { inline: input.inline } : {}),
    ...(input.tooltip ? { tooltip: input.tooltip } : {}),
    ...(input.min !== undefined ? { min: input.min } : {}),
    ...(input.max !== undefined ? { max: input.max } : {}),
    ...(input.step !== undefined ? { step: input.step } : {}),
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
    initialCapital: metadata?.initialCapital,
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
    tables: [],
    shapes: [],
    candles: [],
    priceLines: [],
    fills: [],
    barColors: [],
    inputs,
    alerts: [],
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

function lineOf(raw: Record<string, unknown>): PineLine {
  const style = String(raw.style ?? 'solid');
  return {
    id: Number(raw.id),
    x1: Number(raw.x1),
    y1: Number(raw.y1),
    x2: Number(raw.x2),
    y2: Number(raw.y2),
    xloc: xlocOf(raw.xloc),
    extend: extendOf(raw.extend),
    color: raw.color === undefined || raw.color === null ? '#2962FF' : colorOf(raw.color),
    style: lineStyleOf(style),
    width: Number(raw.width ?? 1),
    arrowLeft: style === 'arrow_left' || style === 'arrow_both',
    arrowRight: style === 'arrow_right' || style === 'arrow_both',
  };
}

/**
 * A drawing color as text. `na` arrives as a number; passing it through would
 * turn into the string "NaN" and the chart would fall back to a default color.
 */
function colorOf(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function polylinePointOf(raw: unknown): PinePolylinePoint | null {
  if (Array.isArray(raw) && raw.length >= 2) {
    const x = Number(raw[0]);
    const price = Number(raw[1]);
    return Number.isFinite(x) && Number.isFinite(price)
      ? { xloc: 'bar_index', x, price }
      : null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const point = raw as { index?: unknown; time?: unknown; price?: unknown };
  const price = Number(point.price);
  if (!Number.isFinite(price)) return null;
  if (point.index !== undefined && Number.isFinite(Number(point.index))) {
    return { xloc: 'bar_index', x: Number(point.index), price };
  }
  if (point.time !== undefined && Number.isFinite(Number(point.time))) {
    return { xloc: 'bar_time', x: Number(point.time), price };
  }
  return null;
}

function drawingsOf(result: ExecutionResult, bars: readonly PineBar[]): PineDrawings {
  const rawLines = (result.lines ?? []) as Record<string, unknown>[];
  const lines: PineLine[] = rawLines.map(lineOf);
  const lineById = new Map(lines.map((line) => [line.id, line]));

  const boxes: PineBox[] = ((result.boxes ?? []) as Record<string, unknown>[]).map((raw) => ({
    id: Number(raw.id),
    left: Number(raw.left),
    top: Number(raw.top),
    right: Number(raw.right),
    bottom: Number(raw.bottom),
    xloc: xlocOf(raw.xloc),
    extend: extendOf(raw.extend),
    backgroundColor: colorOf(raw.bgcolor),
    borderColor: colorOf(raw.border_color),
    borderWidth: Number(raw.border_width ?? 1),
    borderStyle: lineStyleOf(raw.border_style),
    text: String(raw.text ?? ''),
    textColor: colorOf(raw.text_color),
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
    color: colorOf(raw.color),
    textColor: colorOf(raw.textcolor),
    style: String(raw.style ?? 'label_center'),
    size: String(raw.size ?? 'normal'),
    textAlign: raw.textalign === 'left' || raw.textalign === 'right' ? raw.textalign : 'center',
  }));

  const backgrounds: PineDrawings['backgrounds'] = [];
  for (const entry of result.bgcolors ?? []) {
    const index = entry.barIndex;
    if (index === undefined) continue;
    if (typeof entry.color !== 'string' || entry.color.length === 0) continue;
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

  const linefills: PineDrawings['linefills'] = [];
  for (const raw of (result.linefills ?? []) as Record<string, unknown>[]) {
    const first = raw.line1 as Record<string, unknown> | undefined;
    const second = raw.line2 as Record<string, unknown> | undefined;
    if (!first || !second) continue;
    const line1 = lineById.get(Number(first.id)) ?? lineOf(first);
    const line2 = lineById.get(Number(second.id)) ?? lineOf(second);
    linefills.push({
      id: Number(raw.id),
      line1,
      line2,
      color: colorOf(raw.color),
    });
  }

  const polylines: PineDrawings['polylines'] = [];
  for (const raw of (result.polylines ?? []) as Record<string, unknown>[]) {
    const points: PinePolylinePoint[] = [];
    for (const point of (raw.points as unknown[] | undefined) ?? []) {
      const mapped = polylinePointOf(point);
      if (mapped) points.push(mapped);
    }
    polylines.push({
      id: Number(raw.id),
      points,
      curved: raw.curved === true,
      closed: raw.closed === true,
      lineColor: colorOf(raw.line_color),
      fillColor: colorOf(raw.fill_color),
      lineWidth: Number(raw.line_width ?? 1),
      lineStyle: lineStyleOf(raw.line_style),
    });
  }

  return { lines, boxes, labels, backgrounds, linefills, polylines };
}

function tableDimension(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function tablesOf(result: ExecutionResult): PineTable[] {
  return ((result.tables ?? []) as Record<string, unknown>[]).map((raw) => {
    const rows = Number(raw.rows ?? 0);
    const columns = Number(raw.columns ?? 0);
    const rawCells = (raw.cells ?? []) as (Record<string, unknown> | null)[][];
    const merges: PineTableMerge[] = [];
    const covered = new Set<string>();

    const cells: (PineTableCell | null)[][] = [];
    for (let row = 0; row < rows; row++) {
      const outputRow: (PineTableCell | null)[] = [];
      for (let column = 0; column < columns; column++) {
        const cell = rawCells[row]?.[column];
        if (!cell) {
          outputRow.push(null);
          continue;
        }
        const colspan = Number(cell.colspan ?? 1);
        const rowspan = Number(cell.rowspan ?? 1);
        if (colspan > 1 || rowspan > 1) {
          merges.push({
            startCol: column,
            startRow: row,
            endCol: column + colspan - 1,
            endRow: row + rowspan - 1,
          });
          for (let r = row; r < row + rowspan; r++) {
            for (let c = column; c < column + colspan; c++) {
              if (r !== row || c !== column) covered.add(`${r}:${c}`);
            }
          }
        }
        const formatting = String(cell.text_formatting ?? '');
        outputRow.push({
          text: String(cell.text ?? ''),
          textColor: colorOf(cell.text_color),
          backgroundColor: colorOf(cell.bgcolor),
          textSize: (cell.text_size as string | number | undefined) ?? 'auto',
          hAlign: cell.text_halign === 'left' || cell.text_halign === 'right'
            ? cell.text_halign
            : 'center',
          vAlign: cell.text_valign === 'top' || cell.text_valign === 'bottom'
            ? cell.text_valign
            : 'center',
          tooltip: String(cell.tooltip ?? ''),
          bold: /bold/i.test(formatting),
          italic: /italic/i.test(formatting),
          width: tableDimension(cell.width),
          height: tableDimension(cell.height),
          merged: covered.has(`${row}:${column}`),
        });
      }
      cells.push(outputRow);
    }

    return {
      id: Number(raw.id),
      position: String(raw.position ?? 'top_right'),
      columns,
      rows,
      backgroundColor: colorOf(raw.bgcolor),
      frameColor: colorOf(raw.frame_color),
      frameWidth: Number(raw.frame_width ?? 0),
      borderColor: colorOf(raw.border_color),
      borderWidth: Number(raw.border_width ?? 0),
      cells,
      merges,
    };
  });
}

function shapesOf(result: ExecutionResult): PineShapePoint[] {
  const points: PineShapePoint[] = [];
  let group = 0;

  for (const shape of result.plotshapes ?? []) {
    const signature = group++;
    for (const value of shape.values) {
      if (value.value === null || value.value === 0) continue;
      points.push({
        group: signature,
        title: shape.title,
        time: value.time,
        value: value.value,
        text: value.text,
        style: shape.style,
        location: shape.location,
        color: shape.color,
        size: shape.size,
      });
    }
  }

  for (const shape of result.plotchars ?? []) {
    const signature = group++;
    for (const value of shape.values) {
      if (value.value === null || value.value === 0) continue;
      points.push({
        group: signature,
        title: shape.title,
        time: value.time,
        value: value.value,
        text: value.text ?? shape.char,
        style: 'text_outline',
        location: shape.location,
        color: shape.color,
        size: shape.size,
      });
    }
  }

  for (const shape of result.plotarrows ?? []) {
    const signature = group++;
    for (const value of shape.values) {
      if (value.value === null || value.value === 0) continue;
      const up = value.value > 0;
      points.push({
        group: signature,
        title: shape.title,
        time: value.time,
        value: value.value,
        style: up ? 'arrowup' : 'arrowdown',
        location: up ? 'abovebar' : 'belowbar',
        color: up ? shape.colorup : shape.colordown,
        size: 'normal',
      });
    }
  }

  return points;
}

function priceLinesOf(result: ExecutionResult): PinePriceLine[] {
  const byIndex = new Map<number, PinePriceLine>();
  for (const line of result.hlines ?? []) {
    const index = Number(line.index);
    const price = Number(line.price);
    if (!Number.isFinite(index) || !Number.isFinite(price)) continue;
    byIndex.set(index, {
      id: index,
      price,
      title: String(line.title || `hline_${index}`),
      color: colorOf(line.color) || '#787B86',
      width: Number.isFinite(Number(line.linewidth)) ? Number(line.linewidth) : 1,
      style: lineStyleOf(line.linestyle),
    });
  }
  return [...byIndex.values()].sort((a, b) => a.id - b.id);
}

function anchorOf(ref: FillRef, hlines: Map<number, number>): PineFillAnchor | null {
  if (ref.kind === 'hline') {
    const price = hlines.get(ref.index);
    return price === undefined ? null : { kind: 'hline', index: ref.index, price };
  }
  return { kind: 'plot', index: ref.index };
}

function fillsOf(result: ExecutionResult, bars: readonly PineBar[]): PineFill[] {
  const hlines = new Map<number, number>();
  for (const line of result.hlines ?? []) {
    const price = Number(line.price);
    if (Number.isFinite(price)) hlines.set(Number(line.index), price);
  }

  interface Bucket {
    from: FillRef;
    to: FillRef;
    colors: (string | null)[];
  }
  const groups = new Map<string, Bucket>();

  for (const fill of result.fills ?? []) {
    const index = fill.barIndex;
    if (index === undefined || index < 0 || index >= bars.length) continue;
    const key = `${fill.from.kind}:${fill.from.index}>${fill.to.kind}:${fill.to.index}`;
    let bucket = groups.get(key);
    if (!bucket) {
      bucket = { from: fill.from, to: fill.to, colors: new Array<string | null>(bars.length).fill(null) };
      groups.set(key, bucket);
    }
    bucket.colors[index] = typeof fill.color === 'string' && fill.color.length > 0 ? fill.color : null;
  }

  const fills: PineFill[] = [];
  for (const [id, bucket] of groups) {
    const present = bucket.colors.filter((color): color is string => color !== null);
    if (present.length === 0) continue;
    const from = anchorOf(bucket.from, hlines);
    const to = anchorOf(bucket.to, hlines);
    if (!from || !to) continue;
    // A flat color only when every bar carries the same color; any `na` gap or a
    // second color keeps the per-bar array so conditional fills stay conditional.
    const flat = bucket.colors.every((color) => color === present[0]) ? present[0] : undefined;
    fills.push(flat ? { id, from, to, color: flat } : { id, from, to, colors: bucket.colors });
  }
  return fills;
}

function barColorsOf(result: ExecutionResult): PineBarColor[] {
  const byTime = new Map<number, string>();
  for (const entry of result.barcolors ?? []) {
    const time = Number(entry.time);
    if (!Number.isFinite(time)) continue;
    byTime.set(time, typeof entry.color === 'string' ? entry.color : '');
  }
  return [...byTime.entries()]
    .filter(([, color]) => color.length > 0)
    .map(([time, color]) => ({ time, color }))
    .sort((a, b) => a.time - b.time);
}

type CandleValue = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  color?: string;
  wickcolor?: string;
  bordercolor?: string;
};

function candlesOf(result: ExecutionResult, bars: readonly PineBar[]): PineCandleSeries[] {
  const byTime = new Map<number, number>();
  bars.forEach((bar, index) => {
    if (!byTime.has(bar.time)) byTime.set(bar.time, index);
  });
  const series: PineCandleSeries[] = [];

  for (const candle of result.plotcandles ?? []) {
    const values: CandleValue[] = bars.map((bar) => ({
      time: bar.time,
      open: Number.NaN,
      high: Number.NaN,
      low: Number.NaN,
      close: Number.NaN,
    }));
    for (const value of candle.values) {
      const index = byTime.get(value.time);
      if (index === undefined) continue;
      values[index] = value;
    }
    const barColors = values.map((value): PineCandleBarColor | null => {
      if (!value.color && !value.wickcolor && !value.bordercolor) return null;
      return { color: value.color, wickColor: value.wickcolor, borderColor: value.bordercolor };
    });
    series.push({
      id: candle.index,
      title: candle.title,
      kind: 'candle',
      color: candle.color,
      wickColor: candle.wickcolor,
      borderColor: candle.bordercolor,
      bars: values.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })),
      barColors: barColors.some((color) => color !== null) ? barColors : undefined,
    });
  }

  for (const barPlot of result.plotbars ?? []) {
    const values: CandleValue[] = bars.map((bar) => ({
      time: bar.time,
      open: Number.NaN,
      high: Number.NaN,
      low: Number.NaN,
      close: Number.NaN,
    }));
    for (const value of barPlot.values) {
      const index = byTime.get(value.time);
      if (index === undefined) continue;
      values[index] = value;
    }
    const barColors = values.map((value): PineCandleBarColor | null =>
      value.color ? { color: value.color } : null,
    );
    series.push({
      id: barPlot.index,
      title: barPlot.title,
      kind: 'bar',
      color: barPlot.color,
      bars: values.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })),
      barColors: barColors.some((color) => color !== null) ? barColors : undefined,
    });
  }

  return series;
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
    run({ bars, timeframe, symbol, inputs, lowerBars, foreignBars, onLowerTimeframe, onForeignSymbol, symbolInfo, live, visibleRange, securityProbeCache }: PineRunBars): PineRunResult {
      const values: Record<string, unknown> = { ...compileInputs, ...(inputs ?? {}) };
      try {
        const result = executeRunner(runner, bars.map(barOf), {
          inputs: values,
          symbol,
          timeframe: canonicalTimeframe(timeframe ?? ''),
          symbolInfo: symbolInfo as import('./runtime/context').ContextOptions['symbolInfo'],
          live,
          visibleRange,
          securityProbeCache,
          strategyInitialCapital: meta.initialCapital,
          lowerBars: lowerBars
            ? Object.fromEntries(
                Object.entries(lowerBars).map(([key, series]) => [key, series.map(barOf)]),
              )
            : undefined,
          foreignBars: foreignBars
            ? Object.fromEntries(
                Object.entries(foreignBars).map(([key, series]) => [key, series.map(barOf)]),
              )
            : undefined,
          onLowerTimeframe,
          onForeignSymbol,
        });
        const runtimeWarnings = result.warnings ?? [];
        return {
          ok: true,
          name: meta.name,
          overlay: meta.overlay,
          plots: plotValues(result.plots, meta.plots, bars),
          drawings: drawingsOf(result, bars),
          tables: tablesOf(result),
          shapes: shapesOf(result),
          candles: candlesOf(result, bars),
          priceLines: priceLinesOf(result),
          fills: fillsOf(result, bars),
          barColors: barColorsOf(result),
          inputs: meta.inputs,
          alerts: result.alerts ?? [],
          strategy: result.strategy,
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
