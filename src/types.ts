/** A closed or forming bar. Time is a Unix timestamp in milliseconds. */
export interface PineBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PinePlot {
  id: string;
  title: string;
  /** PineJS plot type: `line`, `histogram`, `column`, `area`, `shape`, `hline`. */
  type: string;
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

export interface PineRunOptions {
  source: string;
  bars: readonly PineBar[];
  /** Canonical timeframe key: `1`, `5`, `60`, `D`, `W`, `M`. */
  timeframe?: string;
  symbol?: string;
  /** Input overrides keyed by the input id from the script metadata. */
  inputs?: Record<string, number | boolean | string>;
  id?: string;
  name?: string;
}

export interface PineRunResult {
  ok: boolean;
  error?: string;
  name: string;
  /** `indicator(..., overlay = true)`: draw over the price scale. */
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
