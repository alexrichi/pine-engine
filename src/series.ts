/**
 * A Pine series as the PineJS runtime contract expects it: `get(0)` is the
 * current bar, `get(1)` the previous one, and out-of-range offsets are `na`.
 */
export class Series {
  readonly values: number[] = [];

  push(value: unknown): void {
    this.values.push(typeof value === 'number' ? value : Number(value));
  }

  get(offset: number): number {
    const index = this.values.length - 1 - offset;
    return index >= 0 && index < this.values.length ? this.values[index]! : Number.NaN;
  }
}

export interface PineContext {
  barIndex: number;
  totalBars: number;
  isRealtime: boolean;
  vars: Series[];
  varIndex: number;
  symbol: {
    tickerid: string;
    timezone: string;
    session: string;
    pricescale: number;
    minmov: number;
    timeframe: string;
  };
  /** Documented PineJS primitive: one persistent series per call site. */
  new_var: (value: unknown) => unknown;
  /** Resets the per-bar call-site counter; the series themselves persist. */
  reset: () => void;
  [key: string]: unknown;
}

export function last(values: readonly number[]): number {
  return values.length > 0 ? values[values.length - 1]! : Number.NaN;
}

export function numberValue(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : Number.NaN;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }
  return Number.NaN;
}

export function seriesOf(value: unknown): Series {
  if (value instanceof Series) return value;
  const series = new Series();
  if (value !== undefined) series.push(value);
  return series;
}
