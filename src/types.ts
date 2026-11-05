/** A closed or forming bar. Time is a Unix timestamp in milliseconds. */
export interface PineBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type PineLineStyle = 'solid' | 'dashed' | 'dotted';

export interface PinePlotMeta {
  id: string;
  title: string;
  /** Pine plot style: `line`, `histogram`, `circles`, `area`, `stepline`, `cross`, `columns`. */
  type: string;
  /** Hex color from the plot declaration, including the engine default. */
  color?: string;
  width?: number;
  lineStyle?: PineLineStyle;
  /** 0-100, from `color.new()`. */
  transparency?: number;
}

export interface PinePlot extends PinePlotMeta {
  /** One value per input bar; `NaN` where Pine produced `na`. */
  values: number[];
}

export interface PineLine {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  xloc: 'bar_index' | 'bar_time';
  extend: 'none' | 'left' | 'right' | 'both';
  color: string;
  style: PineLineStyle;
  width: number;
  arrowLeft?: boolean;
  arrowRight?: boolean;
}

export interface PineBox {
  id: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
  xloc: 'bar_index' | 'bar_time';
  extend: 'none' | 'left' | 'right' | 'both';
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  borderStyle: PineLineStyle;
  text: string;
  textColor: string;
  textSize: string;
  hAlign: 'left' | 'center' | 'right';
  vAlign: 'top' | 'center' | 'bottom';
}

export interface PineLabel {
  id: number;
  x: number;
  y: number;
  xloc: 'bar_index' | 'bar_time';
  yloc: 'price' | 'abovebar' | 'belowbar' | 'top' | 'bottom';
  text: string;
  tooltip: string;
  color: string;
  textColor: string;
  style: string;
  size: string;
  textAlign: 'left' | 'center' | 'right';
}

export interface PineBackground {
  from: number;
  to: number;
  color: string;
}

export interface PineDrawings {
  lines: PineLine[];
  boxes: PineBox[];
  labels: PineLabel[];
  backgrounds: PineBackground[];
}

export interface PineInput {
  id: string;
  name: string;
  type: string;
  defval: number | boolean | string;
}

export interface PineScriptMeta {
  name: string;
  shortName?: string;
  /** `indicator(..., overlay = true)`: draw over the price scale. */
  overlay: boolean;
  inputs: PineInput[];
  plots: PinePlotMeta[];
  /** Source-level limitations found at compile time. */
  warnings: string[];
}

export interface PineCompileOptions {
  source: string;
  /** Stable id for the compiled indicator; used in its metadata. */
  id?: string;
  name?: string;
  /** Input overrides keyed by the input id from the script metadata. */
  inputs?: Record<string, number | boolean | string>;
}

export interface PineRunBars {
  bars: readonly PineBar[];
  /** Canonical timeframe key: `1`, `5`, `60`, `D`, `W`, `M`. */
  timeframe?: string;
  symbol?: string;
  /** Input overrides for this run; they win over the compile-time values. */
  inputs?: Record<string, number | boolean | string>;
}

export interface PineRunResult {
  ok: boolean;
  error?: string;
  name: string;
  overlay: boolean;
  plots: PinePlot[];
  drawings: PineDrawings;
  inputs: PineInput[];
  /** Source-level limitations found at compile time plus runtime warnings. */
  warnings: string[];
  /**
   * Builtin names the runtime had to stub because they are not implemented.
   * An empty list means the script ran with full coverage.
   */
  missingStd: string[];
}

export interface PineProgram {
  ok: boolean;
  error?: string;
  meta: PineScriptMeta;
  /** Run the compiled script over a bar set. Never throws. */
  run(options: PineRunBars): PineRunResult;
}
