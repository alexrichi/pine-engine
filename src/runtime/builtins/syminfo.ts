// Pine Script v6 syminfo built-in module

export interface SymInfo {
  ticker: string;
  tickerid: string;
  prefix: string;
  root: string;
  mintick: number;
  pointvalue: number;
  timezone: string;
  type: string;
  session: string;
  basecurrency: string;
  currency: string;
  description: string;
  /** Price scale (`10^digits`), e.g. 10 for a 0.1 tick. */
  pricescale: number;
  /** Float shares outstanding; na for instruments that do not report it (crypto). */
  shares_outstanding_float: number;
  /** Total shares outstanding; na for instruments that do not report it (crypto). */
  shares_outstanding_total: number;
  /** Function form: `syminfo.ticker(symbol)`. */
  tickerOf(symbol: unknown): string;
  /** Function form: `syminfo.prefix(symbol)`. */
  prefixOf(symbol: unknown): string;
}

/**
 * Create a default syminfo object.
 * Users can override individual fields when loading real market data.
 */
export function createSyminfo(overrides: Partial<SymInfo> = {}): SymInfo {
  const ticker = overrides.ticker ?? 'AAPL';
  const prefix = overrides.prefix ?? 'NASDAQ';
  return {
    ticker,
    tickerid: `${prefix}:${ticker}`,
    prefix,
    root: overrides.root ?? ticker,
    mintick: overrides.mintick ?? 0.01,
    pointvalue: overrides.pointvalue ?? 1,
    timezone: overrides.timezone ?? 'America/New_York',
    type: overrides.type ?? 'stock',
    session: overrides.session ?? 'regular',
    basecurrency: overrides.basecurrency ?? 'USD',
    currency: overrides.currency ?? 'USD',
    description: overrides.description ?? ticker,
    pricescale: overrides.pricescale ?? 100,
    shares_outstanding_float: overrides.shares_outstanding_float ?? Number.NaN,
    shares_outstanding_total: overrides.shares_outstanding_total ?? Number.NaN,
    ...overrides,
    tickerOf: (symbol: unknown) => splitSymbol(symbol)[1],
    prefixOf: (symbol: unknown) => splitSymbol(symbol)[0],
  };
}

/** `"BINANCE:ETHUSDT"` → `["BINANCE", "ETHUSDT"]`; no prefix yields empty strings. */
function splitSymbol(symbol: unknown): [string, string] {
  const value = symbol && typeof symbol === 'object' && 'get' in symbol
    ? (symbol as { get(index: number): unknown }).get(0)
    : symbol;
  if (value === null || value === undefined || (typeof value === 'number' && Number.isNaN(value))) {
    return ['', ''];
  }
  const plain = String(value);
  const at = plain.indexOf(':');
  return at < 0 ? ['', ''] : [plain.slice(0, at), plain.slice(at + 1)];
}
