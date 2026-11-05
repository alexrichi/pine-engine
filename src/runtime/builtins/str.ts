// Pine Script v6 string built-in functions

import { NA } from '../types/na';

/** Coerce a Pine string argument; non-strings (including na) yield ''. */
function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export const str = {
  /**
   * Convert any value to its string representation.
   * Optionally accepts a format string (e.g. "#.##" for number formatting)
   * or a named format specifier ("format.mintick", "format.volume", "format.percent").
   */
  tostring(value: any, format?: string): string {
    if (value === null || value === undefined || (typeof value === 'number' && isNaN(value))) {
      return 'NaN';
    }
    if (format !== undefined && typeof value === 'number') {
      // Named format specifiers
      if (format === 'format.mintick') {
        return value.toFixed(2);
      }
      if (format === 'format.volume') {
        const abs = Math.abs(value);
        if (abs >= 1e9) return (value / 1e9).toFixed(2) + 'B';
        if (abs >= 1e6) return (value / 1e6).toFixed(2) + 'M';
        if (abs >= 1e3) return (value / 1e3).toFixed(2) + 'K';
        return String(Math.round(value));
      }
      if (format === 'format.percent') {
        return value.toFixed(2) + '%';
      }
      // Handle Pine-style format strings like "#.##", "0.00", etc.
      const m = format.match(/[#0]*\.([#0]+)/);
      if (m) {
        const decimals = m[1].length;
        return value.toFixed(decimals);
      }
      return String(value);
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
