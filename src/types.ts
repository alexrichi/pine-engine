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
  /** PineJS plot type: `line`, `histogram`, `circles`, `area`, `stepline`, `cross`. */
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

/** A drawing call emitted by `line.new`, `label.new`, `box.new`, `plotshape`, and friends. */
export interface PineVisualEvent {
  call: string;
  args: unknown[];
  barIndex: number;
  pineHandleId?: number;
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
}

export interface PineCompileOptions {
  source: string;
  /** Stable id for the transpiled indicator; used in its metainfo. */
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
  visuals: PineVisualEvent[];
  inputs: PineInput[];
  /**
   * Standard-library names the shim had to stub because OakScriptJS has no
   * matching function. An empty list means the script ran with full coverage.
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
