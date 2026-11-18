/**
 * Window sums the way PineScript computes them: the exactly summed doubles,
 * rounded once. A left-to-right running sum drifts in the last bits and can
 * flip exact comparisons (`ma > ma[1]`), so window functions use Shewchuk
 * partials (the algorithm behind Python's `math.fsum`).
 */
import type { Series } from '../types/series';

/** Adds `value` to the non-overlapping partials, exactly. */
export function addExact(partials: number[], value: number): void {
  let x = value;
  let i = 0;
  for (let j = 0; j < partials.length; j++) {
    let y = partials[j]!;
    if (Math.abs(x) < Math.abs(y)) {
      const swap = x;
      x = y;
      y = swap;
    }
    const hi = x + y;
    const lo = y - (hi - x);
    if (lo !== 0) partials[i++] = lo;
    x = hi;
  }
  partials.length = i;
  partials.push(x);
}

/** The partials' exact sum, rounded once to a double (half to even). */
export function roundExact(partials: readonly number[]): number {
  let n = partials.length;
  if (n === 0) return 0;
  let hi = partials[--n]!;
  while (n > 0) {
    const x = hi;
    const y = partials[--n]!;
    hi = x + y;
    const lo = y - (hi - x);
    if (lo !== 0) {
      // A tie rounds away from zero only while the rest has the same sign.
      if (n > 0 && ((lo < 0 && partials[n - 1]! < 0) || (lo > 0 && partials[n - 1]! > 0))) {
        const doubled = lo * 2;
        const candidate = hi + doubled;
        if (doubled === candidate - hi) hi = candidate;
      }
      break;
    }
  }
  return hi;
}

/** Exact sum of the values, rounded once. */
export function exactSum(values: readonly number[]): number {
  const partials: number[] = [];
  for (const value of values) addExact(partials, value);
  return roundExact(partials);
}

/** Exact sum of the newest `length` values; `NaN` when short or when any is na. */
export function windowSum(source: Series<number>, length: number): number {
  if (!(length > 0) || source.length < length) return Number.NaN;
  const partials: number[] = [];
  for (let index = 0; index < length; index++) {
    const value = source.get(index);
    if (!Number.isFinite(value)) return Number.NaN;
    addExact(partials, value as number);
  }
  return roundExact(partials);
}
