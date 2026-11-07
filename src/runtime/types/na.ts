/**
 * Pine's `na` is a missing value, not a distinct type. Modeling it as `NaN`
 * keeps JavaScript arithmetic, comparisons and truthiness aligned with Pine:
 * `na + 1` is `na`, `na > 5` is false and `na` is falsy in a condition.
 */
export const NA: number = Number.NaN;
export type NaType = number;

export function isNa(val: unknown): boolean {
  return val === null || val === undefined || (typeof val === 'number' && isNaN(val));
}

export function nz(val: unknown, replacement: number = 0): number {
  if (isNa(val)) return replacement;
  return val as number;
}

let _lastNonNa: number = NA;

/** Reset the state behind `fixnan`; call once per engine run. */
export function resetNaState(): void {
  _lastNonNa = NA;
}

/** Save/restore the `fixnan` state around a nested security-probe run. */
export function getFixnanState(): number {
  return _lastNonNa;
}

export function setFixnanState(value: number): void {
  _lastNonNa = value;
}

export function fixnan(val: unknown): number {
  if (!isNa(val)) {
    _lastNonNa = val as number;
    return val as number;
  }
  return _lastNonNa;
}

export function naAdd(a: unknown, b: unknown): number {
  if (isNa(a) || isNa(b)) return NA;
  return (a as number) + (b as number);
}

export function naSub(a: unknown, b: unknown): number {
  if (isNa(a) || isNa(b)) return NA;
  return (a as number) - (b as number);
}

export function naMul(a: unknown, b: unknown): number {
  if (isNa(a) || isNa(b)) return NA;
  return (a as number) * (b as number);
}

export function naDiv(a: unknown, b: unknown): number {
  if (isNa(a) || isNa(b)) return NA;
  const divisor = b as number;
  if (divisor === 0) return NA;
  return (a as number) / divisor;
}
