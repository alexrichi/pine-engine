import { NA, isNa } from '../types/na';
import { Series } from '../types/series';
import { windowSum } from './exact-sum';

/**
 * PineScript's seeded `math.random`: Java's linear congruential generator
 * (`java.util.Random`) and its `nextDouble()`. Each call site keeps its own
 * generator, so two `math.random(seed = n)` calls give different sequences.
 */
function seededRandom(seed: number): () => number {
  const mask = (1n << 48n) - 1n;
  let state = (BigInt(Math.trunc(seed)) ^ 0x5deece66dn) & mask;
  const next = (bits: bigint): bigint => {
    state = (0x5deece66dn * state + 11n) & mask;
    return state >> (48n - bits);
  };
  return () => {
    const hi = next(26n);
    const lo = next(27n);
    return Number((hi << 27n) + lo) / 2 ** 53;
  };
}

const seededRandoms = new Map<string, () => number>();

/** Starts every seeded `math.random` sequence again at the start of a script run. */
export function resetMathRandom(): void {
  seededRandoms.clear();
}

export const math = {
  abs: Math.abs,
  ceil: Math.ceil,
  floor: Math.floor,
  round: (x: number, precision?: number): number => {
    if (precision === undefined || precision === 0) return Math.round(x);
    const factor = Math.pow(10, precision);
    return Math.round(x * factor) / factor;
  },
  max: (...args: number[]) => Math.max(...args),
  min: (...args: number[]) => Math.min(...args),
  pow: Math.pow,
  sqrt: Math.sqrt,
  log: Math.log,
  log10: Math.log10,
  exp: Math.exp,
  sign: Math.sign,

  /**
   * math.avg(...values) — variadic average; NA values are excluded from sum and count.
   */
  avg: (...args: (number | typeof NA)[]): number => {
    let sum = 0;
    let count = 0;
    for (const v of args) {
      if (!isNa(v)) {
        sum += v as number;
        count++;
      }
    }
    if (count === 0) return NA as unknown as number;
    return sum / count;
  },

  /**
   * math.sum(source, length) — rolling sum of last `length` bars.
   * Any NA in the window propagates NA.
   * Also supports variadic form math.sum(a, b, c) for backward compatibility.
   */
  sum: (sourceOrFirst: Series<number> | number, lengthOrRest?: number, ...rest: number[]): number => {
    // If first arg is a Series, treat as rolling sum
    if (sourceOrFirst !== null && typeof sourceOrFirst === 'object' && typeof (sourceOrFirst as any).get === 'function') {
      const source = sourceOrFirst as Series<number>;
      const length = lengthOrRest as number;
      const total = windowSum(source, length);
      return Number.isFinite(total) ? total : (NA as unknown as number);
    }
    // Variadic numeric form: sum(a, b, c, ...)
    let total = sourceOrFirst as number;
    if (lengthOrRest !== undefined) total += lengthOrRest;
    for (const v of rest) total += v;
    return total;
  },

  // Trig functions
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,

  // Degree / radian conversion
  todegrees: (rad: number): number => rad * (180 / Math.PI),
  toradians: (deg: number): number => deg * (Math.PI / 180),

  // Random
  random: (min: number = 0, max: number = 1, seed?: number, site: string = ''): number => {
    if (!Number.isFinite(min) || !Number.isFinite(max)) return NaN;
    if (!Number.isFinite(seed)) return min + Math.random() * (max - min);
    const key = `${site}:${seed}`;
    let next = seededRandoms.get(key);
    if (!next) {
      next = seededRandom(seed as number);
      seededRandoms.set(key, next);
    }
    return min + next() * (max - min);
  },

  // Round to minimum tick (default mintick = 0.01)
  round_to_mintick: (x: number): number => Math.round(x * 100) / 100,

  // Constants
  pi: Math.PI,
  e: Math.E,
  phi: (1 + Math.sqrt(5)) / 2,
  rphi: 2 / (1 + Math.sqrt(5)),  // 1/phi = 0.618...
};
