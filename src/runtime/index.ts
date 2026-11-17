import { Bar } from '../data/types';
import { ScriptMetadata } from '../compiler/index';
import type { PineAlert } from '../types';
import { createEngine } from './engine';
import { StrategyResult } from './builtins/strategy';

export interface PlotData {
  index: number;
  title: string;
  color: string;
  linewidth: number;
  style: string;
  /** The color is a series expression; values may carry per-bar overrides. */
  seriesColor?: boolean;
  values: { time: number; value: number | null; barIndex?: number; offset?: number; color?: string }[];
}

export interface HlineData {
  index: number;
  price: number;
  title: string;
  color: string;
  linewidth: number;
  linestyle: string;
}

/** A handle returned by `plot()` or `hline()`, consumed by `fill()`. */
export interface PlotHandle {
  readonly __pinePlot: number;
}

export interface HlineHandle {
  readonly __pineHline: number;
}

export type FillRef = { kind: 'plot'; index: number } | { kind: 'hline'; index: number };

export interface FillData {
  from: FillRef;
  to: FillRef;
  /** Empty string means the script passed `na` for this bar. */
  color: string;
  barIndex?: number;
}

export interface BgColorData {
  time: number;
  color: string;
  barIndex?: number;
}

export interface BarColorData {
  time: number;
  color: string;
  barIndex?: number;
}

export interface PlotShapeData {
  index: number;
  title: string;
  style: string;
  location: string;
  color: string;
  size: string;
  values: { time: number; value: number | null; text?: string; barIndex?: number; offset?: number }[];
}

export interface PlotCharData {
  index: number;
  title: string;
  char: string;
  location: string;
  color: string;
  size: string;
  values: { time: number; value: number | null; text?: string; barIndex?: number; offset?: number }[];
}

export interface PlotArrowData {
  index: number;
  title: string;
  colorup: string;
  colordown: string;
  values: { time: number; value: number | null; barIndex?: number; offset?: number }[];
}

export interface PlotCandleData {
  index: number;
  title: string;
  color: string;
  wickcolor: string;
  bordercolor: string;
  values: {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    color?: string;
    wickcolor?: string;
    bordercolor?: string;
  }[];
}

export interface PlotBarData {
  index: number;
  title: string;
  color: string;
  values: {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    color?: string;
  }[];
}

export interface ExecutionResult {
  metadata: ScriptMetadata;
  plots: PlotData[];
  hlines: HlineData[];
  fills: FillData[];
  bgcolors: BgColorData[];
  barcolors: BarColorData[];
  plotshapes: PlotShapeData[];
  plotchars: PlotCharData[];
  plotarrows: PlotArrowData[];
  plotcandles: PlotCandleData[];
  plotbars: PlotBarData[];
  strategy?: StrategyResult;
  /** Alerts raised on the last (current) bar. */
  alerts?: PineAlert[];
  // Drawing objects
  lines?: any[];
  labels?: any[];
  boxes?: any[];
  tables?: any[];
  linefills?: any[];
  polylines?: any[];
  /** Builtin names the runtime had to stub. */
  missing?: string[];
  /** Runtime warnings such as unsupported request.security calls. */
  warnings?: string[];
  /** Top-level variable snapshot requested by the host. */
  debug?: { bar: number; values: Record<string, string> };
}

export function createRuntime(compiledCode: string, bars: Bar[]): ExecutionResult {
  const engine = createEngine(bars);
  return engine.execute(compiledCode);
}

// Re-export types and helpers
export { Series } from './types/series';
export { NA, isNa, nz, fixnan, naAdd, naSub, naMul, naDiv } from './types/na';
export type { NaType } from './types/na';
export { color, colorNew, rgb } from './types/color';
export { math } from './builtins/math';
export { str } from './builtins/str';
export { arrayModule, mapModule, matrixModule } from './builtins/collections';
export type { PineMatrix } from './builtins/collections';
export { createSyminfo } from './builtins/syminfo';
export type { SymInfo } from './builtins/syminfo';
export { createTimeframe } from './builtins/timeframe';
export type { TimeframeInfo } from './builtins/timeframe';
export { createTaModule } from './builtins/ta';
export { createBuiltinVariables } from './builtins/variables';
export { createEngine } from './engine';
export { createStrategyEngine } from './builtins/strategy';
export type { StrategyResult, ClosedTrade, StrategyEngine } from './builtins/strategy';
export { createLineModule } from './builtins/line';
export type { LineObject } from './builtins/line';
export { createLabelModule } from './builtins/label';
export type { LabelObject } from './builtins/label';
export { createBoxModule } from './builtins/box';
export type { BoxObject } from './builtins/box';
export { createTableModule } from './builtins/table';
export type { TableObject, TableCell } from './builtins/table';
export { createTimeFunctions } from './builtins/time-functions';
export { inSeconds } from './builtins/timeframe';
export { createRequestModule } from './builtins/request';
export type { RequestModule } from './builtins/request';
