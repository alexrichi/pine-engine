// Pine Script v6 request.security() runtime module.
//
// The engine only has the chart's own bars. A higher timeframe or a foreign
// symbol would need another data feed, so those calls return `na` and report a
// warning instead of silently returning the chart's values. Same-symbol,
// same-timeframe calls keep working and return the expression unchanged.

import { Series } from '../types/series';
import { NA } from '../types/na';

export interface RequestModule {
  security(symbol: string | any, timeframe: string, expression: any, gaps?: string, lookahead?: string): any;
  security_lower_tf(symbol: string | any, timeframe: string, expression: any): any;
  currency_rate(from: string, to: string): number;
  financial(symbol: string, financialId: string, period?: string, gaps?: string): any;
  economic(countryCode: string, field: string, time?: number): any;
  dividends(symbol: string, dividendType: string, gaps?: string): any;
  earnings(symbol: string, earningsType: string, gaps?: string): any;
  splits(symbol: string, splitType: string, gaps?: string): any;
  quandl(code: string, gaps?: string): any;
  seed(seed: number, ...args: any[]): any;
}

const ALIASES: Record<string, string> = {
  '1m': '1', '3m': '3', '5m': '5', '15m': '15', '30m': '30', '45m': '45',
  '1h': '60', '2h': '120', '3h': '180', '4h': '240', '6h': '360',
  '8h': '480', '12h': '720', '1d': 'D', '1w': 'W', '1mo': 'M',
  '4H': '240', '1D': 'D', '1W': 'W', '1M': 'M',
};

export function canonicalTimeframe(timeframe: string): string {
  return ALIASES[timeframe] ?? ALIASES[timeframe.toLowerCase()] ?? timeframe;
}

function sameSymbol(requested: unknown, current: string): boolean {
  if (requested === null || requested === undefined || requested === '') return true;
  const value = String(requested);
  if (value === current) return true;
  // Scripts commonly pass syminfo.tickerid; a bare root also matches the chart.
  const root = current.includes(':') ? current.split(':').pop()! : current;
  return value === root || (value.includes(':') && value.split(':').pop() === root);
}

export function createRequestModule(
  _bars: unknown[],
  _getCurrentBarIndex: () => number,
  getCurrentTimeframe: () => string,
  getCurrentSymbol: () => string = () => '',
  onWarning: (message: string) => void = () => {},
): RequestModule {
  const warned = new Set<string>();

  function warn(symbol: string, timeframe: string): void {
    const key = `${symbol}@${timeframe}`;
    if (warned.has(key)) return;
    warned.add(key);
    onWarning(
      `request.security(${symbol || 'chart'}, ${timeframe || 'chart'}) is not supported; its values are na`,
    );
  }

  function unsupported(name: string): number {
    if (!warned.has(name)) {
      warned.add(name);
      onWarning(`request.${name} has no data source; its values are na`);
    }
    return NA;
  }

  function security(
    symbol: string | any,
    timeframe: string,
    expression: any,
    _gaps: string = 'barmerge.gaps_off',
    _lookahead: string = 'barmerge.lookahead_off',
  ): any {
    const tuple = Array.isArray(expression);
    const currentTimeframe = getCurrentTimeframe();
    const requested = timeframe || currentTimeframe;
    if (!sameSymbol(symbol, getCurrentSymbol()) || canonicalTimeframe(requested) !== canonicalTimeframe(currentTimeframe)) {
      warn(String(symbol ?? ''), requested);
      return tuple ? expression.map(() => NA) : NA;
    }
    if (tuple) {
      return expression.map((value: unknown) =>
        value instanceof Series ? (value as Series<number>).get(0) : value,
      );
    }
    if (expression instanceof Series) return (expression as Series<number>).get(0);
    return expression;
  }

  return {
    security,
    security_lower_tf(_symbol: string, _timeframe: string, expression: any): any {
      unsupported('security_lower_tf');
      return Array.isArray(expression) ? expression.map(() => NA) : [NA];
    },
    currency_rate(from: string, to: string): number {
      if (String(from) === String(to)) return 1;
      return unsupported('currency_rate');
    },
    financial(): any {
      return unsupported('financial');
    },
    economic(): any {
      return unsupported('economic');
    },
    dividends(): any {
      return unsupported('dividends');
    },
    earnings(): any {
      return unsupported('earnings');
    },
    splits(): any {
      return unsupported('splits');
    },
    quandl(): any {
      return unsupported('quandl');
    },
    seed(): any {
      return unsupported('seed');
    },
  };
}
