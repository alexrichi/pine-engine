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

export interface PineTableCell {
  text: string;
  textColor: string;
  backgroundColor: string;
  textSize: string | number;
  hAlign: 'left' | 'center' | 'right';
  vAlign: 'top' | 'center' | 'bottom';
  tooltip: string;
  bold: boolean;
  italic: boolean;
  width?: number;
  height?: number;
  merged?: boolean;
}

export interface PineTableMerge {
  startCol: number;
  startRow: number;
  endCol: number;
  endRow: number;
}

export interface PineTable {
  id: number;
  position: string;
  columns: number;
  rows: number;
  backgroundColor: string;
  frameColor: string;
  frameWidth: number;
  borderColor: string;
  borderWidth: number;
  cells: (PineTableCell | null)[][];
  merges: PineTableMerge[];
}

/** One `plotshape`/`plotchar`/`plotarrow` marker. */
export interface PineShapePoint {
  /** Declaration index; points from one plot call share it. */
  group: number;
  title: string;
  time: number;
  value: number | null;
  text?: string;
  /** Pine shape/style token, e.g. `triangleup`, `arrowdown`, `circle`. */
  style: string;
  /** Pine location token: `abovebar`, `belowbar`, `top`, `bottom`, `absolute`. */
  location: string;
  color: string;
  size: string;
}

/** A horizontal price line (Pine `hline()`). */
export interface PinePriceLine {
  /** Declaration index; repeated calls over bars collapse to one line. */
  id: number;
  price: number;
  title: string;
  color: string;
  width: number;
  style: PineLineStyle;
}

/** One side of a `fill()` band: a plot declaration or an hline level. */
export interface PineFillAnchor {
  kind: 'plot' | 'hline';
  index: number;
  /** Set for hline anchors. */
  price?: number;
}

/** A band between two plots or hlines (Pine `fill()`). */
export interface PineFill {
  id: string;
  from: PineFillAnchor;
  to: PineFillAnchor;
  /** Flat band color when every bar has the same color. */
  color?: string;
  /** Per-bar colors aligned to the input bars; `null` marks an `na` gap. */
  colors?: (string | null)[];
}

export interface PineBarColor {
  time: number;
  color: string;
}

export interface PineCandleBarColor {
  color?: string;
  wickColor?: string;
  borderColor?: string;
}

/** A `plotcandle`/`plotbar` series. */
export interface PineCandleSeries {
  id: number;
  title: string;
  kind: 'candle' | 'bar';
  color: string;
  wickColor?: string;
  borderColor?: string;
  bars: {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
  }[];
  /** Per-bar plotcandle/plotbar colors, aligned to `bars`. */
  barColors?: (PineCandleBarColor | null)[];
}

export interface PineDrawings {
  lines: PineLine[];
  boxes: PineBox[];
  labels: PineLabel[];
  backgrounds: PineBackground[];
  linefills: PineLinefill[];
  polylines: PinePolyline[];
}

/** A `linefill.new(line1, line2, color)` band. */
export interface PineLinefill {
  id: number;
  line1: PineLine;
  line2: PineLine;
  color: string;
}

export interface PinePolylinePoint {
  xloc: 'bar_index' | 'bar_time';
  x: number;
  price: number;
}

/** A `polyline.new(...)` path. */
export interface PinePolyline {
  id: number;
  points: PinePolylinePoint[];
  curved: boolean;
  closed: boolean;
  lineColor: string;
  fillColor: string;
  lineWidth: number;
  lineStyle: PineLineStyle;
}

export interface PineInput {
  id: string;
  name: string;
  type: string;
  defval: number | boolean | string;
  options?: string[];
  group?: string;
  inline?: string;
  tooltip?: string;
  min?: number;
  max?: number;
  step?: number;
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
  /** Host metadata for `syminfo.*` (mintick, pricescale, type, tickerid, ...). */
  symbolInfo?: Record<string, unknown>;
  /** True while the host streams live bars; the last bar may still be forming. */
  live?: boolean;
  /** Input overrides for this run; they win over the compile-time values. */
  inputs?: Record<string, number | boolean | string>;
  /**
   * Bars for lower timeframes, keyed `<symbol>@<canonical timeframe>`.
   * Used by `request.security` and `request.security_lower_tf`.
   */
  lowerBars?: Record<string, readonly PineBar[]>;
  /** Called when a script asks for a lower timeframe that the host can supply. */
  onLowerTimeframe?: (symbol: string, timeframe: string) => void;
  /** The chart's visible bar window for `chart.*_visible_bar_time`; absent = na. */
  visibleRange?: { left: number; right: number };
  /** A shared cache for nested HTF/LTF security probes (one per engine session). */
  securityProbeCache?: Map<string, unknown[]>;
}

export interface PineRunResult {
  ok: boolean;
  error?: string;
  name: string;
  overlay: boolean;
  plots: PinePlot[];
  drawings: PineDrawings;
  tables: PineTable[];
  shapes: PineShapePoint[];
  candles: PineCandleSeries[];
  priceLines: PinePriceLine[];
  fills: PineFill[];
  barColors: PineBarColor[];
  inputs: PineInput[];
  /** Alerts raised on the last (current) bar by `alert()` / `alertcondition()`. */
  alerts: PineAlert[];
  /** Source-level limitations found at compile time plus runtime warnings. */
  warnings: string[];
  /**
   * Builtin names the runtime had to stub because they are not implemented.
   * An empty list means the script ran with full coverage.
   */
  missingStd: string[];
}

/** One alert raised by a script on its current bar. */
export interface PineAlert {
  message: string;
  title?: string;
  /** Bar open time in epoch ms. */
  time: number;
  barIndex: number;
  freq?: string;
  /** Generated call-site id; absent for alerts without one. */
  site?: string;
}

export interface PineProgram {
  ok: boolean;
  error?: string;
  meta: PineScriptMeta;
  /** Run the compiled script over a bar set. Never throws. */
  run(options: PineRunBars): PineRunResult;
}
