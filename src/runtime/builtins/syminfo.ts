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
    ...overrides,
  };
}
