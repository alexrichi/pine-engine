/** Timeframe aliases sent by Vela and Pine → canonical keys. */
const TF_ALIASES: Record<string, string> = {
  '1m': '1',
  '3m': '3',
  '5m': '5',
  '15m': '15',
  '30m': '30',
  '45m': '45',
  '1h': '60',
  '2h': '120',
  '3h': '180',
  '4h': '240',
  '6h': '360',
  '8h': '480',
  '12h': '720',
  '1d': 'D',
  '1w': 'W',
  '1mo': 'M',
  '1D': 'D',
  '1W': 'W',
  '1M': 'M',
  '4H': '240',
};

export function canonicalTimeframe(timeframe: string): string {
  return TF_ALIASES[timeframe] ?? TF_ALIASES[timeframe.toLowerCase()] ?? timeframe;
}

const MINUTES: Record<string, number> = {
  '1': 1,
  '3': 3,
  '5': 5,
  '15': 15,
  '30': 30,
  '60': 60,
  '120': 120,
  '240': 240,
  '360': 360,
  '480': 480,
  '720': 720,
};

/** Bar duration in ms for a canonical timeframe key; `0` when unknown. */
export function timeframeMs(timeframe: string): number {
  const canonical = canonicalTimeframe(timeframe);
  if (canonical in MINUTES) return MINUTES[canonical]! * 60_000;
  if (canonical === 'D') return 86_400_000;
  if (canonical === 'W') return 7 * 86_400_000;
  if (canonical === 'M') return 30 * 86_400_000;
  return 0;
}

export function timeframeMinutes(timeframe: string): number {
  if (!timeframe) return 0;
  return Math.round(timeframeMs(timeframe) / 60_000);
}
