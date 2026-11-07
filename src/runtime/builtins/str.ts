// Pine Script v6 string built-in functions

import { NA } from '../types/na';

/** Coerce a Pine string argument; non-strings (including na) yield ''. */
function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

const VOLUME_UNITS: Array<[number, string]> = [
  [1e12, 'T'],
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K'],
];

/**
 * Pine pattern digits: `#` prints an optional digit, `0` a required one, `,`
 * groups whole digits, and a trailing `%` scales the value by 100. Optional
 * fractional zeros drop, required ones stay, so `#.##` prints `2.5` and `0.00`
 * prints `2.50`.
 */
function formatPattern(value: number, pattern: string): string {
  let scaled = value;
  let suffix = '';
  if (pattern.endsWith('%')) {
    scaled *= 100;
    suffix = '%';
    pattern = pattern.slice(0, -1);
  }
  const dot = pattern.indexOf('.');
  const wholePattern = dot >= 0 ? pattern.slice(0, dot) : pattern;
  const fractionPattern = dot >= 0 ? pattern.slice(dot + 1) : '';
  const required = (fractionPattern.match(/0/g) ?? []).length;

  const [rawWhole = '0', rawFraction = ''] = Math.abs(scaled).toFixed(fractionPattern.length).split('.');
  const fraction = rawFraction.replace(/0+$/, '').padEnd(required, '0');
  let whole = rawWhole.padStart((wholePattern.match(/0/g) ?? []).length, '0');
  if (wholePattern.includes(',')) {
    whole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  const sign = scaled < 0 && Number(`${rawWhole}.${rawFraction}`) !== 0 ? '-' : '';
  return sign + whole + (fraction ? '.' + fraction : '') + suffix;
}

/** `format.volume`: 3 fractional digits with K/M/B/T units, trailing zeros dropped. */
function formatVolume(value: number): string {
  const abs = Math.abs(value);
  const unit = VOLUME_UNITS.find(([size]) => abs >= size);
  return formatPattern(unit ? value / unit[0] : value, unit ? '#.###' : '#') + (unit ? unit[1] : '');
}

export const str = {
  /**
   * Convert any value to its string representation.
   * Optionally accepts a Pine pattern (e.g. "#.##") or a named format specifier
   * ("format.mintick", "format.volume", "format.percent"). The compiler emits
   * the bare enum member (`"volume"`), so both spellings are accepted.
   */
  tostring(value: any, format?: string): string {
    if (value === null || value === undefined || (typeof value === 'number' && isNaN(value))) {
      return 'NaN';
    }
    if (typeof value === 'number') {
      if (format === undefined || format === '') {
        return formatPattern(value, '#.########');
      }
      const spec = format.startsWith('format.') ? format.slice('format.'.length) : format;
      if (spec === 'mintick') {
        return value.toFixed(2);
      }
      if (spec === 'volume') {
        return formatVolume(value);
      }
      if (spec === 'percent') {
        return formatPattern(value, '0.00') + '%';
      }
      if (!/[#0]/.test(spec)) {
        return String(value);
      }
      return formatPattern(value, spec);
    }
    return String(value);
  },

  /**
   * Parse a string to a number.  Returns NaN if parsing fails.
   */
  tonumber(s: string): number {
    if (s === null || s === undefined) return NaN;
    const n = Number(s);
    return n;
  },

  /** Return the length of a string. */
  length(s: string): number {
    return text(s).length;
  },

  /** Convert to lowercase. */
  lower(s: string): string {
    return text(s).toLowerCase();
  },

  /** Convert to uppercase. */
  upper(s: string): string {
    return text(s).toUpperCase();
  },

  /** Check if the string contains the given substring. */
  contains(s: string, substr: string): boolean {
    return text(s).includes(text(substr));
  },

  /** Check if the string starts with the given prefix. */
  startswith(s: string, prefix: string): boolean {
    return text(s).startsWith(text(prefix));
  },

  /** Check if the string ends with the given suffix. */
  endswith(s: string, suffix: string): boolean {
    return text(s).endsWith(text(suffix));
  },

  /** Extract a substring. */
  substring(s: string, begin: number, end?: number): string {
    if (end === undefined) return text(s).substring(begin);
    return text(s).substring(begin, end);
  },

  /** Split a string by a separator. */
  split(s: string, sep: string): string[] {
    return text(s).split(text(sep));
  },

  /** Trim whitespace from both ends. */
  trim(s: string): string {
    return text(s).trim();
  },

  /** Replace the first occurrence of target with replacement. */
  replace(s: string, target: string, replacement: string): string {
    return text(s).replace(text(target), text(replacement));
  },

  /** Replace all occurrences of target with replacement. */
  replaceAll(s: string, target: string, replacement: string): string {
    // Use split/join for broad compatibility
    return text(s).split(text(target)).join(text(replacement));
  },

  /**
   * Returns the first match of the regex in the string, or na if not found.
   * Pine Script str.match returns the matched substring, not a boolean.
   */
  match(s: string, regex: string): string | typeof NA {
    if (regex === null || regex === undefined) return NA;
    try {
      const m = text(s).match(new RegExp(text(regex)));
      return m ? m[0] : NA;
    } catch {
      return NA;
    }
  },

  /**
   * Find the position of the first occurrence of substr in s.
   * Returns -1 if not found (Pine returns na, but we use -1 for JS compat).
   */
  pos(s: string, substr: string): number {
    return text(s).indexOf(text(substr));
  },

  /**
   * Pine-style str.format: "{0} is {1}" with positional placeholders.
   */
  format(template: string, ...args: any[]): string {
    if (template === null || template === undefined) return '';
    return template.replace(/\{(\d+)\}/g, (_, idx) => {
      const i = parseInt(idx, 10);
      return i < args.length ? String(args[i]) : `{${idx}}`;
    });
  },

  /**
   * Repeat a string count times.
   * Returns empty string if s is empty or count is <= 0.
   */
  repeat(s: string, count: number): string {
    if (count <= 0) return '';
    return text(s).repeat(Math.floor(count));
  },

  /**
   * Format a timestamp (milliseconds) using a format string.
   *
   * Supported tokens:
   *   yyyy — 4-digit year        yy — 2-digit year
   *   MM   — 2-digit month       dd — 2-digit day
   *   HH   — 24-hour hour        hh — 12-hour hour
   *   mm   — minute              ss — second
   *   EEEE — full weekday name   EEE — short weekday name
   *   a    — AM/PM
   */
  formatTime(timestamp: number, format: string, timezone?: string): string {
    if (timestamp === null || timestamp === undefined || !Number.isFinite(timestamp)) return '';
    if (format === null || format === undefined) return '';

    const d = new Date(timestamp);
    let year: number, month: number, day: number;
    let hour: number, minute: number, second: number;
    let weekdayShort: string, weekdayFull: string;

    if (timezone) {
      // Timezone-aware extraction via Intl
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
        weekday: 'long',
      });
      const parts = fmt.formatToParts(d);
      const map: Record<string, string> = {};
      for (const p of parts) {
        map[p.type] = p.value;
      }
      year = parseInt(map.year, 10);
      month = parseInt(map.month, 10);
      day = parseInt(map.day, 10);
      hour = parseInt(map.hour, 10);
      if (hour === 24) hour = 0;
      minute = parseInt(map.minute, 10);
      second = parseInt(map.second, 10);
      weekdayFull = map.weekday;
      weekdayShort = weekdayFull.substring(0, 3);
    } else {
      // UTC
      year = d.getUTCFullYear();
      month = d.getUTCMonth() + 1;
      day = d.getUTCDate();
      hour = d.getUTCHours();
      minute = d.getUTCMinutes();
      second = d.getUTCSeconds();
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      weekdayFull = dayNames[d.getUTCDay()];
      weekdayShort = weekdayFull.substring(0, 3);
    }

    const pad2 = (n: number): string => n.toString().padStart(2, '0');
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;

    // Replace tokens — order matters: longer tokens first to avoid partial matches
    let result = format;
    result = result.replace(/yyyy/g, year.toString());
    result = result.replace(/yy/g, (year % 100).toString().padStart(2, '0'));
    result = result.replace(/EEEE/g, weekdayFull);
    result = result.replace(/EEE/g, weekdayShort);
    result = result.replace(/MM/g, pad2(month));
    result = result.replace(/dd/g, pad2(day));
    result = result.replace(/HH/g, pad2(hour));
    result = result.replace(/hh/g, pad2(hour12));
    result = result.replace(/mm/g, pad2(minute));
    result = result.replace(/ss/g, pad2(second));
    result = result.replace(/a/g, ampm);

    return result;
  },
};
