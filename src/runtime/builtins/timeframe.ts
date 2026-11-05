// Pine Script v6 timeframe built-in module

import { canonicalTimeframe } from './request';

export interface TimeframeInfo {
  period: string;
  multiplier: number;
  isdwm: boolean;
  isintraday: boolean;
  isminutes: boolean;
  ishours: boolean;
  isdaily: boolean;
  isweekly: boolean;
  ismonthly: boolean;
  isseconds: boolean;
  in_seconds: (tf?: string) => number;
  inSeconds: (tf?: string) => number;
  from_seconds: (seconds: number) => string;
  fromSeconds: (seconds: number) => string;
  change: (tf?: string) => boolean;
}

/**
 * Convert a timeframe period string to its duration in seconds.
 *
 * - Numeric strings (e.g. "1", "5", "60") are treated as minutes.
 * - "D" → 86 400  (1 day)
 * - "W" → 604 800 (7 days)
 * - "M" → 2 592 000 (30 days, Pine convention)
 *
 * @param tf  Period string.  If omitted the caller should supply a default.
 */
export function inSeconds(tf: string): number {
  if (tf === 'D') return 86400;
  if (tf === 'W') return 604800;
  if (tf === 'M') return 2592000;

  const num = parseInt(tf, 10);
  if (!isNaN(num)) {
    return num * 60; // numeric periods are minutes
  }

  // Unknown format — fall back to daily
  return 86400;
}

/**
 * Create a timeframe info object from a period string.
 *
 * Period string conventions (Pine Script):
 *   - "1", "5", "15", "60", "240" — intraday minute-based
 *   - "D" — daily
 *   - "W" — weekly
 *   - "M" — monthly
 *
 * Minutes < 60 are classified as isminutes; >= 60 as ishours.
 */
export function createTimeframe(periodStr?: string, getTime?: () => number): TimeframeInfo {
  const period = periodStr ?? 'D';
  const seenPeriods = new Map<string, string>();

  const isDWM = period === 'D' || period === 'W' || period === 'M';
  const isNumeric = /^\d+$/.test(period);
  const numericValue = isNumeric ? parseInt(period, 10) : 0;

  let multiplier = 1;
  if (isNumeric) {
    multiplier = numericValue;
  }

  return {
    period,
    multiplier,
    isdwm: isDWM,
    isintraday: !isDWM,
    isminutes: isNumeric && numericValue < 60,
    ishours: isNumeric && numericValue >= 60,
    isdaily: period === 'D',
    isweekly: period === 'W',
    ismonthly: period === 'M',
    isseconds: /S$/i.test(period),
    in_seconds(tf?: string): number {
      return inSeconds(tf ?? period);
    },
    inSeconds(tf?: string): number {
      return inSeconds(tf ?? period);
    },
    from_seconds(seconds: number): string {
      return fromSeconds(seconds);
    },
    fromSeconds(seconds: number): string {
      return fromSeconds(seconds);
    },
    change(tf?: string): boolean {
      if (!getTime) return false;
      const time = getTime();
      if (!Number.isFinite(time)) return false;
      const target = canonicalTimeframe(tf ?? period);
      const key = periodKey(time, target);
      const previous = seenPeriods.get(target);
      seenPeriods.set(target, key);
      return previous === undefined || previous !== key;
    },
  };
}

function fromSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  if (seconds % 2592000 === 0) return `${seconds / 2592000}M`;
  if (seconds % 604800 === 0) return `${seconds / 604800}W`;
  if (seconds % 86400 === 0) return `${seconds / 86400}D`;
  if (seconds % 60 === 0) return `${seconds / 60}`;
  return `${seconds}S`;
}

function periodKey(timeMs: number, timeframe: string): string {
  if (timeframe === 'D') return new Date(timeMs).toISOString().slice(0, 10);
  if (timeframe === 'W') {
    const date = new Date(timeMs);
    const day = date.getUTCDay();
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() - ((day + 6) % 7));
    return monday.toISOString().slice(0, 10);
  }
  if (timeframe === 'M') return new Date(timeMs).toISOString().slice(0, 7);
  const minutes = parseInt(timeframe, 10);
  const bucket = Number.isFinite(minutes) && minutes > 0 ? minutes : 1;
  return String(Math.floor(timeMs / (bucket * 60_000)));
}
