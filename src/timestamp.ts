// Pine `timestamp(dateString[, timezone])`: wall-clock text to epoch milliseconds.
// All timestamps are milliseconds (Unix epoch).

/** Minutes east of UTC for "GMT-5", "UTC+0", "UTC0"; null for IANA names. */
export function fixedOffsetMinutes(tz: string): number | null {
  const match = /^(?:GMT|UTC)([+-]?)(\d{1,2})(?::?(\d{2}))?$/i.exec(tz.trim());
  if (!match) return null;
  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? 0);
  return sign * (hours * 60 + minutes);
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// `2020-01-01`, `2020-01-01T12:30`, `2020-01-01 12:30:00 +0300`.
const ISO_TEXT =
  /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i;
// `01 Jan 2020`, `1 Aug 2010 12:30:00 +0000`.
const DAY_TEXT =
  /^(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i;

/** Minutes east of UTC for a trailing `Z` / `+0300` / `-05:00` token. */
function offsetOf(token: string | undefined): number | null {
  if (!token) return null;
  if (/^z$/i.test(token)) return 0;
  const match = /^([+-])(\d{2}):?(\d{2})$/.exec(token);
  if (!match) return null;
  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

/** Minutes east of UTC of `timezone` at `instant`; null when unreadable. */
function zoneOffsetMinutes(instant: number, timezone: string): number | null {
  const fixed = fixedOffsetMinutes(timezone);
  if (fixed !== null) return fixed;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(new Date(instant));
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    const wall = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour') % 24,
      get('minute'),
      get('second')
    );
    return Math.round((wall - instant) / 60_000);
  } catch {
    return null;
  }
}

/**
 * Parse a Pine date string. A zone in the text wins; otherwise `timezone`
 * applies; otherwise the wall clock is UTC. Returns NaN for unreadable text.
 */
export function parseTimestampString(text: string, timezone?: string): number {
  const raw = String(text ?? '').trim();
  let year = Number.NaN;
  let month = Number.NaN;
  let day = Number.NaN;
  let hour = 0;
  let minute = 0;
  let second = 0;
  let zone: string | undefined;

  const iso = ISO_TEXT.exec(raw);
  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
    hour = Number(iso[4] ?? 0);
    minute = Number(iso[5] ?? 0);
    second = Number(iso[6] ?? 0);
    zone = iso[7];
  } else {
    const parts = DAY_TEXT.exec(raw);
    if (!parts) return Number.NaN;
    const monthIndex = MONTHS.indexOf(parts[2]!.slice(0, 3).toLowerCase());
    if (monthIndex < 0) return Number.NaN;
    day = Number(parts[1]);
    month = monthIndex + 1;
    year = Number(parts[3]);
    hour = Number(parts[4] ?? 0);
    minute = Number(parts[5] ?? 0);
    second = Number(parts[6] ?? 0);
    zone = parts[7];
  }

  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) {
    return Number.NaN;
  }

  const wall = Date.UTC(year, month - 1, day, hour, minute, second);
  if (!Number.isFinite(wall)) return Number.NaN;

  const explicit = offsetOf(zone);
  if (explicit !== null) return wall - explicit * 60_000;
  if (!timezone) return wall;
  // The zone offset depends on the instant, so refine once after the first guess.
  const guess = wall - (zoneOffsetMinutes(wall, timezone) ?? 0) * 60_000;
  return wall - (zoneOffsetMinutes(guess, timezone) ?? 0) * 60_000;
}
