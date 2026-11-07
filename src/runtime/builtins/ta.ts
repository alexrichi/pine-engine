import { Series } from '../types/series';
import { NA, isNa } from '../types/na';

function pivotLevels(type: string, high: number, low: number, close: number, open: number): number[] {
  const levels = new Array<number>(11).fill(NA as unknown as number);
  if ([high, low, close].some((value) => !Number.isFinite(value))) return levels;
  const range = high - low;
  const kind = type.toLowerCase();
  let p: number;
  let r1: number;
  let s1: number;

  if (kind === 'fibonacci') {
    p = (high + low + close) / 3;
    levels[0] = p;
    levels[1] = p + 0.382 * range;
    levels[2] = p - 0.382 * range;
    levels[3] = p + 0.618 * range;
    levels[4] = p - 0.618 * range;
    levels[5] = p + range;
    levels[6] = p - range;
    levels[7] = p + 1.618 * range;
    levels[8] = p - 1.618 * range;
    levels[9] = p + 2.618 * range;
    levels[10] = p - 2.618 * range;
    return levels;
  }

  if (kind === 'camarilla') {
    p = close;
    levels[0] = p;
    levels[1] = close + (1.1 * range) / 12;
    levels[2] = close - (1.1 * range) / 12;
    levels[3] = close + (1.1 * range) / 6;
    levels[4] = close - (1.1 * range) / 6;
    levels[5] = close + (1.1 * range) / 4;
    levels[6] = close - (1.1 * range) / 4;
    levels[7] = close + (1.1 * range) / 2;
    levels[8] = close - (1.1 * range) / 2;
    levels[9] = low === 0 ? NA as unknown as number : (high / low) * close;
    levels[10] = Number.isFinite(levels[9]) ? close - (levels[9] - close) : NA as unknown as number;
    return levels;
  }

  if (kind === 'woodie') {
    p = (high + low + 2 * close) / 3;
  } else if (kind === 'dm') {
    p = (high + low + close) / 3;
    levels[0] = p;
    levels[1] = p + range;
    levels[2] = p - range;
    return levels;
  } else {
    p = (high + low + close) / 3;
  }

  r1 = 2 * p - low;
  s1 = 2 * p - high;
  levels[0] = p;
  levels[1] = r1;
  levels[2] = s1;
  levels[3] = p + range;
  levels[4] = p - range;
  levels[5] = high + 2 * (p - low);
  levels[6] = low - 2 * (high - p);
  levels[7] = levels[5]! + range;
  levels[8] = levels[6]! - range;
  levels[9] = levels[7]! + range;
  levels[10] = levels[8]! - range;
  void open;
  return levels;
}

function rankValues(values: number[]): number[] {
  const order = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value || a.index - b.index);
  const ranks = new Array<number>(values.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1]!.value === order[i]!.value) j++;
    const rank = (i + j + 2) / 2; // average 1-based rank
    for (let k = i; k <= j; k++) ranks[order[k]!.index] = rank;
    i = j + 1;
  }
  return ranks;
}

function calcSma(source: Series<number>, length: number): number {
  if (source.length < length) return NA as unknown as number;
  let sum = 0;
  for (let i = 0; i < length; i++) {
    const v = source.get(i);
    if (isNa(v)) return NA as unknown as number;
    sum += v as number;
  }
  return sum / length;
}

function calcEmaInternal(
  current: number,
  prev: number | typeof NA,
  length: number
): number {
  const k = 2 / (length + 1);
  if (isNa(prev)) return current;
  return current * k + (prev as number) * (1 - k);
}

export interface TaModule {
  sma(source: Series<number>, length: number, id?: string): number;
  ema(source: Series<number>, length: number, id?: string): number;
  tsi(source: Series<number>, shortLength?: number, longLength?: number, id?: string): number;
  rsi(source: Series<number>, length: number, id?: string): number;
  macd(
    source: Series<number>,
    fast: number,
    slow: number,
    signal: number,
    id?: string
  ): [number, number, number];
  bb(
    source: Series<number>,
    length: number,
    mult: number,
    id?: string
  ): [number, number, number];
  atr(
    length: number,
    high: Series<number>,
    low: Series<number>,
    close: Series<number>,
    id?: string
  ): number;
  crossover(a: Series<number> | number, b: Series<number> | number): boolean;
  crossunder(a: Series<number> | number, b: Series<number> | number): boolean;
  change(source: Series<number>, length?: number): number;
  highest(source: Series<number>, length: number): number;
  lowest(source: Series<number>, length: number): number;

  // New TA functions
  stoch(source: Series<number>, high: Series<number>, low: Series<number>, length: number): number;
  wma(source: Series<number>, length: number, id?: string): number;
  vwma(source: Series<number>, volume: Series<number>, length: number, id?: string): number;
  rma(source: Series<number>, length: number, id?: string): number;
  swma(source: Series<number>, id?: string): number;
  alma(source: Series<number>, length: number, offset: number, sigma: number, id?: string): number;
  stdev(source: Series<number>, length: number, id?: string): number;
  variance(source: Series<number>, length: number, id?: string): number;
  cum(source: Series<number>, id?: string): number;
  valuewhen(condition: boolean, source: Series<number>, occurrence: number, id?: string): number;
  barssince(condition: boolean, id?: string): number;
  highestbars(source: Series<number>, length: number): number;
  lowestbars(source: Series<number>, length: number): number;
  mom(source: Series<number>, length: number): number;
  cci(source: Series<number>, length: number, id?: string): number;
  dmi(diLength: number, adxSmoothing: number, high: Series<number>, low: Series<number>, close: Series<number>, id?: string): [number, number, number];
  tr(handleNa?: boolean, high?: Series<number>, low?: Series<number>, close?: Series<number>): number;
  pivothigh(source: Series<number>, leftBars: number, rightBars: number): number;
  pivotlow(source: Series<number>, leftBars: number, rightBars: number): number;
  falling(source: Series<number>, length: number): boolean;
  rising(source: Series<number>, length: number): boolean;
  percentrank(source: Series<number>, length: number): number;
  correlation(source1: Series<number>, source2: Series<number>, length: number): number;
  dev(source: Series<number>, length: number): number;
  mfi(series: Series<number>, length: number, high?: Series<number>, low?: Series<number>, close?: Series<number>, volume?: Series<number>, id?: string): number;
  readonly obv: number;
  readonly accdist: number;
  readonly nvi: number;
  readonly pvi: number;
  readonly pvt: number;
  readonly wad: number;
  readonly wvad: number;
  supertrend(factor: number, atrPeriod: number, high?: Series<number>, low?: Series<number>, close?: Series<number>, id?: string): [number, number];

  // P1 additions
  hma(source: Series<number>, length: number, id?: string): number;
  kc(source: Series<number>, length: number, mult: number, useTrueRange?: boolean, id?: string): [number, number, number];
  donchian(length: number, high?: Series<number>, low?: Series<number>): [number, number, number];
  linreg(source: Series<number>, length: number, offset?: number): number;
  median(source: Series<number>, length: number): number;
  roc(source: Series<number>, length: number, id?: string): number;
  vwap(source?: Series<number>, anchor?: string, stdevMult?: number, id?: string): number | [number, number, number];
  wpr(length: number): number;
  sar(start?: number, increment?: number, maximum?: number, id?: string): number;
  bbw(source: Series<number>, length: number, mult: number): number;
  kcw(source: Series<number>, length: number, mult: number, useTrueRange?: boolean, id?: string): number;
  cog(source: Series<number>, length: number): number;
  cross(a: Series<number> | number, b: Series<number> | number): boolean;
  max(source: Series<number>, id?: string): number;
  min(source: Series<number>, id?: string): number;
  mode(source: Series<number>, length: number): number;
  range(source: Series<number>, length: number): number;
  rci(source: Series<number>, length: number): number;
  pivot_point_levels(type: string, anchor: boolean, developing?: boolean, id?: string): number[];
}

export function createTaModule(
  getCurrentBarIndex: () => number,
  getHigh?: () => Series<number>,
  getLow?: () => Series<number>,
  getClose?: () => Series<number>,
  getVolume?: () => Series<number>,
  getOpen?: () => Series<number>
): TaModule {
  // Per-run state. The compiler keys every stateful call by its source location,
  // so two ema() calls never share a slot and a scan run never inherits the
  // previous instrument's state.
  const emaState = new Map<string, { prev: number; prevBarIndex: number; sum: number; count: number; seeded: boolean }>();
  const rsiState = new Map<string, { avgGain: number; avgLoss: number; prevVal: number; initialized: boolean; count: number }>();
  const rmaState = new Map<string, { prev: number; prevBarIndex: number; count: number; sum: number; seeded: boolean }>();
  const atrState = new Map<string, { prev: number; prevBarIndex: number; sum: number; count: number; seeded: boolean }>();
  const cumState = new Map<string, { sum: number; prevBarIndex: number }>();
  const valuewhenState = new Map<string, { values: { value: number }[] }>();
  const barsSinceState = new Map<string, { lastTrueBar: number }>();
  const dmiState = new Map<string, {
    prevHigh: number;
    prevLow: number;
    prevClose: number;
    smoothedPlusDM: number;
    smoothedMinusDM: number;
    smoothedTR: number;
    adx: number;
    prevBarIndex: number;
    count: number;
  }>();
  const cumulativeState = new Map<string, { prevClose: number; prevVolume: number; value: number; barIndex: number }>();
  const supertrendState = new Map<string, {
    prevSupertrend: number;
    prevDirection: number;
    prevClose: number;
    prevBarIndex: number;
  }>();
  const crossoverState = new Map<string, number>();
  const crossunderState = new Map<string, number>();
  const hmaState = new Map<string, {
    deltaBuf: number[];
    capacity: number;
    prevBarIndex: number;
  }>();
  const vwapState = new Map<string, { pv: number; volume: number; prevBarIndex: number }>();
  const sarState = new Map<string, {
    sar: number;
    extreme: number;
    acceleration: number;
    up: boolean;
    prevBarIndex: number;
  }>();
  const extremeState = new Map<string, { high: number; low: number; prevBarIndex: number }>();
  const pivotState = new Map<string, {
    open: number;
    high: number;
    low: number;
    close: number;
    levels: number[] | null;
    prevBarIndex: number;
  }>();

  // A TA source can be a builtin series or a plain value produced by another
  // expression (`ta.ema(fast, 9)`, `ta.highest(close - open, 10)`). Plain
  // values are recorded into a per-call-site series so lookbacks see history.
  const sourceSeries = new Map<string, { series: Series<number>; lastBar: number }>();
  function asSeries(value: unknown, id: string, slot: number): Series<number> {
    if (value instanceof Series) return value;
    const bar = getCurrentBarIndex();
    const key = `${id}:${slot}`;
    let entry = sourceSeries.get(key);
    if (!entry) {
      entry = { series: new Series<number>(4096), lastBar: bar - 1 };
      sourceSeries.set(key, entry);
      for (let i = 0; i < bar; i++) entry.series.push(NA as unknown as number);
    }
    if (bar === entry.lastBar) {
      entry.series.set(value as number);
    } else {
      for (let i = entry.lastBar + 1; i < bar; i++) entry.series.push(NA as unknown as number);
      entry.series.push(value as number);
      entry.lastBar = bar;
    }
    return entry.series;
  }

  function pivotAt(source: Series<number>, leftBars: number, rightBars: number, high: boolean): number {
    const bars = source.length;
    const current = bars - 1;
    if (leftBars < 0 || rightBars < 0 || current < leftBars + rightBars) {
      return NA as unknown as number;
    }
    const candidate = source.get(rightBars);
    if (isNa(candidate)) return NA as unknown as number;

    // The window holds `leftBars + rightBars + 1` non-na values; na bars are skipped.
    const windowSize = leftBars + rightBars + 1;
    let seen = 0;
    for (let back = 0; back < bars && seen < windowSize; back++) {
      const value = source.get(back);
      if (isNa(value)) continue;
      seen++;
      if (back === rightBars) continue;
      const number = value as number;
      if (high) {
        if (number > (candidate as number)) return NA as unknown as number;
      } else if (number < (candidate as number)) {
        return NA as unknown as number;
      }
      // A newer equal takes the pivot; an older equal does not.
      if (back < rightBars && number === (candidate as number)) {
        return NA as unknown as number;
      }
    }
    return candidate as number;
  }

  type CumulativeName = 'obv' | 'accdist' | 'nvi' | 'pvi' | 'pvt' | 'wad' | 'wvad';
  function cumulativeValue(name: CumulativeName): number {
    const close = getClose?.();
    const volume = getVolume?.();
    if (!close || !volume) return NA as unknown as number;
    const curClose = close.get(0);
    const curVolume = volume.get(0);
    if (isNa(curClose) || isNa(curVolume)) return NA as unknown as number;
    const barIndex = getCurrentBarIndex();
    let state = cumulativeState.get(name);
    if (state && state.barIndex === barIndex) return state.value;

    const initial = name === 'nvi' || name === 'pvi' ? 1000 : 0;
    if (!state || state.barIndex !== barIndex - 1) {
      state = { prevClose: curClose as number, prevVolume: curVolume as number, value: initial, barIndex };
      cumulativeState.set(name, state);
      return initial;
    }

    const c = curClose as number;
    const v = curVolume as number;
    let value = state.value;
    switch (name) {
      case 'obv':
        if (c > state.prevClose) value += v;
        else if (c < state.prevClose) value -= v;
        break;
      case 'accdist': {
        const high = getHigh?.().get(0);
        const low = getLow?.().get(0);
        if (isNa(high) || isNa(low)) return NA as unknown as number;
        const range = (high as number) - (low as number);
        const clv = range === 0 ? 0 : ((c - (low as number)) - ((high as number) - c)) / range;
        value += clv * v;
        break;
      }
      case 'nvi':
        if (v < state.prevVolume && state.prevClose !== 0) value += (value * (c - state.prevClose)) / state.prevClose;
        break;
      case 'pvi':
        if (v > state.prevVolume && state.prevClose !== 0) value += (value * (c - state.prevClose)) / state.prevClose;
        break;
      case 'pvt':
        if (state.prevClose !== 0) value += (v * (c - state.prevClose)) / state.prevClose;
        break;
      case 'wad': {
        const high = getHigh?.().get(0);
        const low = getLow?.().get(0);
        if (isNa(high) || isNa(low)) return NA as unknown as number;
        if (c > state.prevClose) value += c - Math.min(low as number, state.prevClose);
        else if (c < state.prevClose) value += c - Math.max(high as number, state.prevClose);
        break;
      }
      case 'wvad': {
        const high = getHigh?.().get(0);
        const low = getLow?.().get(0);
        const open = getOpen?.().get(0);
        if (isNa(high) || isNa(low) || isNa(open)) return NA as unknown as number;
        const range = (high as number) - (low as number);
        if (range !== 0) value += (v * (c - (open as number))) / range;
        break;
      }
    }
    state.value = value;
    state.prevClose = c;
    state.prevVolume = v;
    state.barIndex = barIndex;
    return value;
  }

  /**
   * The previous pair for a cross: the last bar where both sides were non-na,
   * so a call skipped by lazy `and` / `or` still sees the pair it last saw.
   */
  function previousPair(a: Series<number>, b: Series<number>): [number, number] {
    const bars = Math.max(a.length, b.length);
    for (let back = 1; back < bars; back++) {
      const x = a.get(back);
      const y = b.get(back);
      if (!isNa(x) && !isNa(y)) return [x as number, y as number];
    }
    return [NA as unknown as number, NA as unknown as number];
  }

  const ta: TaModule = {

    sma(source: Series<number>, length: number, _id?: string): number {
      return calcSma(source, length);
    },

    ema(source: Series<number>, length: number, id: string = 'default_ema'): number {
      const current = source.get(0);
      const barIndex = getCurrentBarIndex();
      let state = emaState.get(id);

      if (!state || state.prevBarIndex !== barIndex - 1) {
        state = { prev: NA as unknown as number, prevBarIndex: barIndex, sum: 0, count: 0, seeded: false };
        emaState.set(id, state);
      }

      if (isNa(current)) {
        state.prevBarIndex = barIndex;
        return NA as unknown as number;
      }

      const value = current as number;
      if (length <= 1) {
        state.prev = value;
        state.seeded = true;
        state.prevBarIndex = barIndex;
        return value;
      }

      if (!state.seeded) {
        state.sum += value;
        state.count += 1;
        state.prevBarIndex = barIndex;
        if (state.count < length) return NA as unknown as number;
        const seed = state.sum / length;
        state.prev = seed;
        state.seeded = true;
        return seed;
      }

      const newVal = calcEmaInternal(value, state.prev, length);
      state.prev = newVal;
      state.prevBarIndex = barIndex;
      return newVal;
    },

    tsi(
      source: Series<number>,
      shortLength: number = 3,
      longLength: number = 10,
      id: string = 'default_tsi',
    ): number {
      const current = source.get(0);
      if (isNa(current)) return NA as unknown as number;
      const previous = source.get(1);
      const change = isNa(previous) ? (NA as unknown as number) : (current as number) - (previous as number);
      const changeSeries = asSeries(change, id, 0);
      const absSeries = asSeries(isNa(change) ? NA : Math.abs(change), id, 1);
      const longChange = this.ema(changeSeries, longLength, `${id}:long`);
      const longAbs = this.ema(absSeries, longLength, `${id}:longAbs`);
      const shortChange = this.ema(asSeries(longChange, id, 2), shortLength, `${id}:short`);
      const shortAbs = this.ema(asSeries(longAbs, id, 3), shortLength, `${id}:shortAbs`);
      if (isNa(shortChange) || isNa(shortAbs) || shortAbs === 0) return NA as unknown as number;
      return (100 * (shortChange as number)) / (shortAbs as number);
    },

    rsi(source: Series<number>, length: number, id: string = 'default_rsi'): number {
      const current = source.get(0);
      if (isNa(current)) return NA as unknown as number;

      let state = rsiState.get(id);
      if (!state) {
        state = { avgGain: 0, avgLoss: 0, prevVal: NA, initialized: false, count: 0 };
        rsiState.set(id, state);
      }

      if (isNa(state.prevVal)) {
        state.prevVal = current;
        return NA as unknown as number;
      }

      const diff = (current as number) - (state.prevVal as number);
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;
      state.prevVal = current;
      state.count++;

      if (!state.initialized) {
        state.avgGain += gain;
        state.avgLoss += loss;

        if (state.count >= length) {
          state.avgGain /= length;
          state.avgLoss /= length;
          state.initialized = true;
        } else {
          return NA as unknown as number;
        }
      } else {
        // Wilder's smoothing
        state.avgGain = (state.avgGain * (length - 1) + gain) / length;
        state.avgLoss = (state.avgLoss * (length - 1) + loss) / length;
      }

      if (state.avgLoss === 0) return 100;
      const rs = state.avgGain / state.avgLoss;
      return 100 - 100 / (1 + rs);
    },

    macd(
      source: Series<number>,
      fast: number,
      slow: number,
      signal: number,
      id: string = 'default_macd'
    ): [number, number, number] {
      const fastVal = this.ema(source, fast, `${id}:fast`);
      const slowVal = this.ema(source, slow, `${id}:slow`);
      if (isNa(fastVal) || isNa(slowVal)) {
        return [NA as unknown as number, NA as unknown as number, NA as unknown as number];
      }
      const macdLine = (fastVal as number) - (slowVal as number);
      const signalVal = this.ema(asSeries(macdLine, id, 0), signal, `${id}:signal`);
      const histogram = isNa(signalVal) ? (NA as unknown as number) : macdLine - (signalVal as number);
      return [macdLine, signalVal, histogram];
    },

    bb(
      source: Series<number>,
      length: number,
      mult: number,
      _id: string = 'default_bb'
    ): [number, number, number] {
      const middle = calcSma(source, length);
      if (isNa(middle)) return [NA as unknown as number, NA as unknown as number, NA as unknown as number];

      let variance = 0;
      for (let i = 0; i < length; i++) {
        const v = source.get(i);
        if (isNa(v)) return [NA as unknown as number, NA as unknown as number, NA as unknown as number];
        const diff = (v as number) - (middle as number);
        variance += diff * diff;
      }
      const stddev = Math.sqrt(variance / length);
      const upper = (middle as number) + mult * stddev;
      const lower = (middle as number) - mult * stddev;
      return [middle as number, upper, lower];
    },

    atr(
      length: number,
      high: Series<number>,
      low: Series<number>,
      close: Series<number>,
      id: string = 'default_atr'
    ): number {
      // True range for the current bar; the first bar has no previous close.
      const h = high.get(0);
      const l = low.get(0);
      const pc = close.get(1);
      if (isNa(h) || isNa(l)) return NA as unknown as number;

      const tr = isNa(pc)
        ? (h as number) - (l as number)
        : Math.max(
            (h as number) - (l as number),
            Math.abs((h as number) - (pc as number)),
            Math.abs((l as number) - (pc as number)),
          );
      const barIndex = getCurrentBarIndex();
      let state = atrState.get(id);
      if (!state || state.prevBarIndex !== barIndex - 1) {
        state = { prev: NA as unknown as number, prevBarIndex: barIndex, sum: 0, count: 0, seeded: false };
        atrState.set(id, state);
      }

      if (length <= 1) {
        state.prev = tr;
        state.seeded = true;
        state.prevBarIndex = barIndex;
        return tr;
      }

      if (!state.seeded) {
        state.sum += tr;
        state.count += 1;
        state.prevBarIndex = barIndex;
        if (state.count < length) return NA as unknown as number;
        const seed = state.sum / length;
        state.prev = seed;
        state.seeded = true;
        return seed;
      }

      const rmaVal = ((state.prev as number) * (length - 1) + tr) / length;
      state.prev = rmaVal;
      state.prevBarIndex = barIndex;
      return rmaVal;
    },

    crossover(a: Series<number> | number, b: Series<number> | number): boolean {
      const isSeries = (v: any): v is Series<number> =>
        v !== null && typeof v === 'object' && typeof v.get === 'function';

      if (isSeries(a) && isSeries(b)) {
        const a0 = a.get(0);
        const b0 = b.get(0);
        if (isNa(a0) || isNa(b0)) return false;
        let [a1, b1] = [a.get(1), b.get(1)];
        if (isNa(a1) || isNa(b1)) [a1, b1] = previousPair(a, b);
        if (isNa(a1) || isNa(b1)) return false;
        return (a0 as number) > (b0 as number) && (a1 as number) <= (b1 as number);
      }

      let a0: number | typeof NA, a1: number | typeof NA;
      if (isSeries(a)) {
        a0 = a.get(0); a1 = a.get(1);
      } else {
        a0 = typeof a === 'number' ? a : NA;
        const prev = crossoverState.get('a');
        a1 = prev !== undefined ? prev : NA;
        crossoverState.set('a', a0 as number);
      }

      let b0: number | typeof NA, b1: number | typeof NA;
      if (isSeries(b)) {
        b0 = b.get(0); b1 = b.get(1);
      } else {
        b0 = typeof b === 'number' ? b : NA;
        const prev = crossoverState.get('b');
        b1 = prev !== undefined ? prev : NA;
        crossoverState.set('b', b0 as number);
      }

      if (isNa(a0) || isNa(a1) || isNa(b0) || isNa(b1)) return false;
      return (a0 as number) > (b0 as number) && (a1 as number) <= (b1 as number);
    },

    crossunder(a: Series<number> | number, b: Series<number> | number): boolean {
      const isSeries = (v: any): v is Series<number> =>
        v !== null && typeof v === 'object' && typeof v.get === 'function';

      if (isSeries(a) && isSeries(b)) {
        const a0 = a.get(0);
        const b0 = b.get(0);
        if (isNa(a0) || isNa(b0)) return false;
        let [a1, b1] = [a.get(1), b.get(1)];
        if (isNa(a1) || isNa(b1)) [a1, b1] = previousPair(a, b);
        if (isNa(a1) || isNa(b1)) return false;
        return (a0 as number) < (b0 as number) && (a1 as number) >= (b1 as number);
      }

      let a0: number | typeof NA, a1: number | typeof NA;
      if (isSeries(a)) {
        a0 = a.get(0); a1 = a.get(1);
      } else {
        a0 = typeof a === 'number' ? a : NA;
        const prev = crossunderState.get('a');
        a1 = prev !== undefined ? prev : NA;
        crossunderState.set('a', a0 as number);
      }

      let b0: number | typeof NA, b1: number | typeof NA;
      if (isSeries(b)) {
        b0 = b.get(0); b1 = b.get(1);
      } else {
        b0 = typeof b === 'number' ? b : NA;
        const prev = crossunderState.get('b');
        b1 = prev !== undefined ? prev : NA;
        crossunderState.set('b', b0 as number);
      }

      if (isNa(a0) || isNa(a1) || isNa(b0) || isNa(b1)) return false;
      return (a0 as number) < (b0 as number) && (a1 as number) >= (b1 as number);
    },

    change(source: Series<number>, length: number = 1): number {
      const current = source.get(0);
      const prev = source.get(length);
      if (isNa(current) || isNa(prev)) return NA as unknown as number;
      return (current as number) - (prev as number);
    },

    highest(source: Series<number>, length: number): number {
      if (source.length < length) return NA as unknown as number;
      let max = -Infinity;
      for (let i = 0; i < length; i++) {
        const v = source.get(i);
        if (isNa(v)) return NA as unknown as number;
        if ((v as number) > max) max = v as number;
      }
      return max;
    },

    lowest(source: Series<number>, length: number): number {
      if (source.length < length) return NA as unknown as number;
      let min = Infinity;
      for (let i = 0; i < length; i++) {
        const v = source.get(i);
        if (isNa(v)) return NA as unknown as number;
        if ((v as number) < min) min = v as number;
      }
      return min;
    },

    // ========================================================================
    // NEW TA FUNCTIONS
    // ========================================================================

    /**
     * ta.stoch(source, high, low, length)
     * Stochastic %K = 100 * (source - lowest(low, length)) / (highest(high, length) - lowest(low, length))
     */
    stoch(source: Series<number>, high: Series<number>, low: Series<number>, length: number): number {
      const src = source.get(0);
      if (isNa(src)) return NA as unknown as number;
      if (high.length < length || low.length < length) return NA as unknown as number;

      let hh = -Infinity;
      let ll = Infinity;
      for (let i = 0; i < length; i++) {
        const h = high.get(i);
        const l = low.get(i);
        if (isNa(h) || isNa(l)) return NA as unknown as number;
        if ((h as number) > hh) hh = h as number;
        if ((l as number) < ll) ll = l as number;
      }

      const range = hh - ll;
      if (range === 0) return 0;
      return 100 * ((src as number) - ll) / range;
    },

    /**
     * ta.wma(source, length)
     * Weighted Moving Average: sum(source[i] * (length - i)) / sum(weights)
     * Weight for bar i (0=current) = (length - i)
     */
    wma(source: Series<number>, length: number, _id?: string): number {
      if (source.length < length) return NA as unknown as number;
      let weightedSum = 0;
      let weightSum = 0;
      for (let i = 0; i < length; i++) {
        const v = source.get(i);
        if (isNa(v)) return NA as unknown as number;
        const weight = length - i;
        weightedSum += (v as number) * weight;
        weightSum += weight;
      }
      return weightedSum / weightSum;
    },

    /**
     * ta.vwma(source, volume, length)
     * Volume Weighted Moving Average: sma(source * volume, length) / sma(volume, length)
     */
    vwma(source: Series<number>, volume: Series<number>, length: number, _id?: string): number {
      if (source.length < length || volume.length < length) return NA as unknown as number;
      let svSum = 0;
      let vSum = 0;
      for (let i = 0; i < length; i++) {
        const s = source.get(i);
        const v = volume.get(i);
        if (isNa(s) || isNa(v)) return NA as unknown as number;
        svSum += (s as number) * (v as number);
        vSum += v as number;
      }
      if (vSum === 0) return NA as unknown as number;
      return svSum / vSum;
    },

    /**
     * ta.rma(source, length)
     * Running Moving Average (Wilder's smoothing)
     * rma = (prev * (length - 1) + source) / length
     * First value is seeded with SMA of first `length` values.
     */
    rma(source: Series<number>, length: number, id: string = 'default_rma'): number {
      const current = source.get(0);
      const barIndex = getCurrentBarIndex();
      let state = rmaState.get(id);

      if (!state || state.prevBarIndex !== barIndex - 1) {
        state = { prev: NA as unknown as number, prevBarIndex: barIndex, count: 0, sum: 0, seeded: false };
        rmaState.set(id, state);
      }

      if (isNa(current)) {
        state.prevBarIndex = barIndex;
        return NA as unknown as number;
      }

      const value = current as number;
      if (length <= 1) {
        state.prev = value;
        state.seeded = true;
        state.prevBarIndex = barIndex;
        return value;
      }

      if (!state.seeded) {
        state.sum += value;
        state.count += 1;
        state.prevBarIndex = barIndex;
        if (state.count < length) return NA as unknown as number;
        const seed = state.sum / length;
        state.prev = seed;
        state.seeded = true;
        return seed;
      }

      const rmaVal = ((state.prev as number) * (length - 1) + value) / length;
      state.prev = rmaVal;
      state.prevBarIndex = barIndex;
      return rmaVal;
    },

    /**
     * ta.swma(source)
     * Symmetrically Weighted Moving Average (fixed 4-bar)
     * swma = source[3]*1/6 + source[2]*2/6 + source[1]*2/6 + source[0]*1/6
     */
    swma(source: Series<number>, _id?: string): number {
      if (source.length < 4) return NA as unknown as number;
      const v0 = source.get(0);
      const v1 = source.get(1);
      const v2 = source.get(2);
      const v3 = source.get(3);
      if (isNa(v0) || isNa(v1) || isNa(v2) || isNa(v3)) return NA as unknown as number;
      return ((v3 as number) * 1 + (v2 as number) * 2 + (v1 as number) * 2 + (v0 as number) * 1) / 6;
    },

    /**
     * ta.alma(source, length, offset, sigma)
     * Arnaud Legoux Moving Average
     * Uses a Gaussian window centered at offset * (length - 1) from the beginning.
     * weight[i] = exp(-((i - m)^2) / (2 * s^2))
     * where m = offset * (length - 1), s = length / sigma
     */
    alma(source: Series<number>, length: number, offset: number, sigma: number, _id?: string): number {
      if (source.length < length) return NA as unknown as number;

      const m = offset * (length - 1);
      const s = length / sigma;

      let weightSum = 0;
      let normSum = 0;

      for (let i = 0; i < length; i++) {
        // In Pine Script, i=0 is the oldest bar in the window, so we map:
        // Pine's window index i -> our series lookback = (length - 1 - i)
        const lookback = length - 1 - i;
        const v = source.get(lookback);
        if (isNa(v)) return NA as unknown as number;

        const w = Math.exp(-((i - m) * (i - m)) / (2 * s * s));
        weightSum += w * (v as number);
        normSum += w;
      }

      if (normSum === 0) return NA as unknown as number;
      return weightSum / normSum;
    },

    /**
     * ta.stdev(source, length)
     * Population standard deviation over `length` bars.
     * stdev = sqrt(variance) where variance uses population formula (divides by length, not length-1).
     * Pine Script v6: ta.stdev uses population stdev (biased).
     */
    stdev(source: Series<number>, length: number, _id?: string): number {
      if (source.length < length) return NA as unknown as number;

      let sum = 0;
      for (let i = 0; i < length; i++) {
        const v = source.get(i);
        if (isNa(v)) return NA as unknown as number;
        sum += v as number;
      }
      const mean = sum / length;

      let sqDiffSum = 0;
      for (let i = 0; i < length; i++) {
        const diff = (source.get(i) as number) - mean;
        sqDiffSum += diff * diff;
      }
      return Math.sqrt(sqDiffSum / length);
    },

    /**
     * ta.variance(source, length)
     * Population variance over `length` bars.
     */
    variance(source: Series<number>, length: number, _id?: string): number {
      if (source.length < length) return NA as unknown as number;

      let sum = 0;
      for (let i = 0; i < length; i++) {
        const v = source.get(i);
        if (isNa(v)) return NA as unknown as number;
        sum += v as number;
      }
      const mean = sum / length;

      let sqDiffSum = 0;
      for (let i = 0; i < length; i++) {
        const diff = (source.get(i) as number) - mean;
        sqDiffSum += diff * diff;
      }
      return sqDiffSum / length;
    },

    /**
     * ta.cum(source)
     * Cumulative (running) sum of source values across all bars.
     */
    cum(source: Series<number>, id: string = 'default_cum'): number {
      const current = source.get(0);
      if (isNa(current)) return NA as unknown as number;

      const barIndex = getCurrentBarIndex();
      let state = cumState.get(id);

      if (!state || state.prevBarIndex !== barIndex - 1) {
        // First bar or discontinuity
        cumState.set(id, { sum: current as number, prevBarIndex: barIndex });
        return current as number;
      }

      const newSum = state.sum + (current as number);
      cumState.set(id, { sum: newSum, prevBarIndex: barIndex });
      return newSum;
    },

    /**
     * ta.valuewhen(condition, source, occurrence)
     * Returns the value of `source` at the `occurrence`-th most recent bar where `condition` was true.
     * occurrence = 0 means the most recent true bar.
     */
    valuewhen(condition: boolean, source: Series<number>, occurrence: number, id: string = 'default_valuewhen'): number {
      let state = valuewhenState.get(id);
      if (!state) {
        state = { values: [] };
        valuewhenState.set(id, state);
      }

      if (condition) {
        const v = source.get(0);
        if (!isNa(v)) {
          state.values.unshift({ value: v as number });
        }
      }

      if (occurrence >= 0 && occurrence < state.values.length) {
        return state.values[occurrence].value;
      }
      return NA as unknown as number;
    },

    /**
     * ta.barssince(condition)
     * Returns the number of bars since `condition` was last true.
     * Returns NA if condition has never been true.
     */
    barssince(condition: boolean, id: string = 'default_barssince'): number {
      const barIndex = getCurrentBarIndex();
      let state = barsSinceState.get(id);

      if (!state) {
        state = { lastTrueBar: -1 };
        barsSinceState.set(id, state);
      }

      if (condition) {
        state.lastTrueBar = barIndex;
      }

      if (state.lastTrueBar < 0) return NA as unknown as number;
      return barIndex - state.lastTrueBar;
    },

    /**
     * ta.highestbars(source, length)
     * Returns the offset (as a negative number or zero) to the bar with the highest value over the last `length` bars.
     * 0 means current bar, -1 means 1 bar ago, etc.
     */
    highestbars(source: Series<number>, length: number): number {
      if (source.length < length) return NA as unknown as number;
      let maxVal = -Infinity;
      let maxIdx = 0;
      for (let i = 0; i < length; i++) {
        const v = source.get(i);
        if (isNa(v)) return NA as unknown as number;
        if ((v as number) > maxVal) {
          maxVal = v as number;
          maxIdx = i;
        }
      }
      return -maxIdx;
    },

    /**
     * ta.lowestbars(source, length)
     * Returns the offset (as a negative number or zero) to the bar with the lowest value over the last `length` bars.
     */
    lowestbars(source: Series<number>, length: number): number {
      if (source.length < length) return NA as unknown as number;
      let minVal = Infinity;
      let minIdx = 0;
      for (let i = 0; i < length; i++) {
        const v = source.get(i);
        if (isNa(v)) return NA as unknown as number;
        if ((v as number) < minVal) {
          minVal = v as number;
          minIdx = i;
        }
      }
      return -minIdx;
    },

    /**
     * ta.mom(source, length)
     * Momentum. Same as ta.change(source, length).
     * mom = source - source[length]
     */
    mom(source: Series<number>, length: number): number {
      const current = source.get(0);
      const prev = source.get(length);
      if (isNa(current) || isNa(prev)) return NA as unknown as number;
      return (current as number) - (prev as number);
    },

    /**
     * ta.cci(source, length)
     * Commodity Channel Index
     * CCI = (source - sma(source, length)) / (0.015 * dev(source, length))
     * where dev is the mean absolute deviation.
     */
    cci(source: Series<number>, length: number, _id?: string): number {
      if (source.length < length) return NA as unknown as number;

      // Calculate SMA
      let sum = 0;
      for (let i = 0; i < length; i++) {
        const v = source.get(i);
        if (isNa(v)) return NA as unknown as number;
        sum += v as number;
      }
      const mean = sum / length;

      // Mean absolute deviation
      let madSum = 0;
      for (let i = 0; i < length; i++) {
        madSum += Math.abs((source.get(i) as number) - mean);
      }
      const mad = madSum / length;

      const current = source.get(0);
      if (isNa(current)) return NA as unknown as number;
      if (mad === 0) return 0;

      return ((current as number) - mean) / (0.015 * mad);
    },

    /**
     * ta.dmi(diLength, adxSmoothing, high, low, close)
     * Directional Movement Index
     * Returns [plusDI, minusDI, adx]
     *
     * Uses Wilder's smoothing (RMA) for the directional indicators and ADX.
     */
    dmi(
      diLength: number,
      adxSmoothing: number,
      high: Series<number>,
      low: Series<number>,
      close: Series<number>,
      id: string = 'default_dmi'
    ): [number, number, number] {
      const naResult: [number, number, number] = [NA as unknown as number, NA as unknown as number, NA as unknown as number];

      const curHigh = high.get(0);
      const curLow = low.get(0);
      const curClose = close.get(0);
      if (isNa(curHigh) || isNa(curLow) || isNa(curClose)) return naResult;

      let state = dmiState.get(id);
      const barIndex = getCurrentBarIndex();

      if (!state || state.prevBarIndex !== barIndex - 1) {
        state = {
          prevHigh: curHigh,
          prevLow: curLow,
          prevClose: curClose,
          smoothedPlusDM: NA,
          smoothedMinusDM: NA,
          smoothedTR: NA,
          adx: NA,
          prevBarIndex: barIndex,
          count: 0,
        };
        dmiState.set(id, state);
        return naResult;
      }

      const prevHigh = state.prevHigh as number;
      const prevLow = state.prevLow as number;

      // True Range
      const trueRange = Math.max(
        (curHigh as number) - (curLow as number),
        Math.abs((curHigh as number) - (state.prevClose as number)),
        Math.abs((curLow as number) - (state.prevClose as number))
      );

      // Directional Movement
      const upMove = (curHigh as number) - prevHigh;
      const downMove = prevLow - (curLow as number);
      const plusDM = (upMove > downMove && upMove > 0) ? upMove : 0;
      const minusDM = (downMove > upMove && downMove > 0) ? downMove : 0;

      state.count++;

      // Wilder's smoothing (RMA)
      if (isNa(state.smoothedTR)) {
        state.smoothedTR = trueRange;
        state.smoothedPlusDM = plusDM;
        state.smoothedMinusDM = minusDM;
      } else {
        state.smoothedTR = ((state.smoothedTR as number) * (diLength - 1) + trueRange) / diLength;
        state.smoothedPlusDM = ((state.smoothedPlusDM as number) * (diLength - 1) + plusDM) / diLength;
        state.smoothedMinusDM = ((state.smoothedMinusDM as number) * (diLength - 1) + minusDM) / diLength;
      }

      // DI+ and DI-
      const smoothedTR = state.smoothedTR as number;
      let plusDI = 0;
      let minusDI = 0;
      if (smoothedTR !== 0) {
        plusDI = 100 * (state.smoothedPlusDM as number) / smoothedTR;
        minusDI = 100 * (state.smoothedMinusDM as number) / smoothedTR;
      }

      // DX
      const diSum = plusDI + minusDI;
      const dx = diSum === 0 ? 0 : 100 * Math.abs(plusDI - minusDI) / diSum;

      // ADX (RMA of DX)
      if (isNa(state.adx)) {
        state.adx = dx;
      } else {
        state.adx = ((state.adx as number) * (adxSmoothing - 1) + dx) / adxSmoothing;
      }

      state.prevHigh = curHigh;
      state.prevLow = curLow;
      state.prevClose = curClose;
      state.prevBarIndex = barIndex;

      return [plusDI, minusDI, state.adx as number];
    },

    /**
     * ta.tr(handleNa)
     * True Range.
     * tr = max(high - low, abs(high - close[1]), abs(low - close[1]))
     * If handleNa is true, when close[1] is na, tr = high - low.
     */
    tr(handleNa: boolean = false, high?: Series<number>, low?: Series<number>, close?: Series<number>): number {
      const h = high ? high : getHigh ? getHigh() : undefined;
      const l = low ? low : getLow ? getLow() : undefined;
      const c = close ? close : getClose ? getClose() : undefined;

      if (!h || !l || !c) return NA as unknown as number;

      const curHigh = h.get(0);
      const curLow = l.get(0);
      const prevClose = c.get(1);

      if (isNa(curHigh) || isNa(curLow)) return NA as unknown as number;

      if (isNa(prevClose)) {
        if (handleNa) {
          return (curHigh as number) - (curLow as number);
        }
        return NA as unknown as number;
      }

      return Math.max(
        (curHigh as number) - (curLow as number),
        Math.abs((curHigh as number) - (prevClose as number)),
        Math.abs((curLow as number) - (prevClose as number))
      );
    },

    /**
     * ta.pivothigh(source, leftBars, rightBars)
     * TradingView semantics: the candidate `rightBars` bars back is the pivot when
     * it is the highest of the last `leftBars + rightBars + 1` non-na values.
     * A newer equal value disqualifies it; an older equal does not.
     */
    pivothigh(source: Series<number>, leftBars: number, rightBars: number): number {
      return pivotAt(source, leftBars, rightBars, true);
    },

    /**
     * ta.pivotlow(source, leftBars, rightBars)
     * Same window and tie rules as pivothigh, lowest value wins.
     */
    pivotlow(source: Series<number>, leftBars: number, rightBars: number): number {
      return pivotAt(source, leftBars, rightBars, false);
    },

    /**
     * ta.falling(source, length)
     * Returns true if source has been falling (strictly decreasing) for `length` consecutive bars.
     */
    falling(source: Series<number>, length: number): boolean {
      if (source.length < length + 1) return false;
      for (let i = 0; i < length; i++) {
        const current = source.get(i);
        const prev = source.get(i + 1);
        if (isNa(current) || isNa(prev)) return false;
        if ((current as number) >= (prev as number)) return false;
      }
      return true;
    },

    /**
     * ta.rising(source, length)
     * Returns true if source has been rising (strictly increasing) for `length` consecutive bars.
     */
    rising(source: Series<number>, length: number): boolean {
      if (source.length < length + 1) return false;
      for (let i = 0; i < length; i++) {
        const current = source.get(i);
        const prev = source.get(i + 1);
        if (isNa(current) || isNa(prev)) return false;
        if ((current as number) <= (prev as number)) return false;
      }
      return true;
    },

    /**
     * ta.percentrank(source, length)
     * Percent rank: percentage of past `length` values that are less than or equal to the current value.
     */
    percentrank(source: Series<number>, length: number): number {
      if (source.length < length + 1) return NA as unknown as number;
      const current = source.get(0);
      if (isNa(current)) return NA as unknown as number;

      let count = 0;
      for (let i = 1; i <= length; i++) {
        const v = source.get(i);
        if (isNa(v)) return NA as unknown as number;
        if ((v as number) <= (current as number)) count++;
      }
      return (count / length) * 100;
    },

    /**
     * ta.correlation(source1, source2, length)
     * Pearson correlation coefficient between source1 and source2 over `length` bars.
     */
    correlation(source1: Series<number>, source2: Series<number>, length: number): number {
      if (source1.length < length || source2.length < length) return NA as unknown as number;

      let sum1 = 0, sum2 = 0;
      for (let i = 0; i < length; i++) {
        const v1 = source1.get(i);
        const v2 = source2.get(i);
        if (isNa(v1) || isNa(v2)) return NA as unknown as number;
        sum1 += v1 as number;
        sum2 += v2 as number;
      }
      const mean1 = sum1 / length;
      const mean2 = sum2 / length;

      let cov = 0, var1 = 0, var2 = 0;
      for (let i = 0; i < length; i++) {
        const d1 = (source1.get(i) as number) - mean1;
        const d2 = (source2.get(i) as number) - mean2;
        cov += d1 * d2;
        var1 += d1 * d1;
        var2 += d2 * d2;
      }

      const denom = Math.sqrt(var1 * var2);
      if (denom === 0) return 0;
      return cov / denom;
    },

    /**
     * ta.dev(source, length)
     * Mean absolute deviation of source over `length` bars.
     * dev = avg(abs(source[i] - sma(source, length))) for i in 0..length-1
     */
    dev(source: Series<number>, length: number): number {
      if (source.length < length) return NA as unknown as number;

      let sum = 0;
      for (let i = 0; i < length; i++) {
        const v = source.get(i);
        if (isNa(v)) return NA as unknown as number;
        sum += v as number;
      }
      const mean = sum / length;

      let madSum = 0;
      for (let i = 0; i < length; i++) {
        madSum += Math.abs((source.get(i) as number) - mean);
      }
      return madSum / length;
    },

    /**
     * ta.mfi(series, length, high?, low?, close?, volume?)
     * Money Flow Index.
     * Typical price = (high + low + close) / 3
     * Raw money flow = typical price * volume
     * MFI uses Wilder-like summation over `length` bars.
     *
     * When called from Pine Script: ta.mfi(hlc3_series, length)
     * The `series` parameter is typically hlc3. We use it as the typical price directly.
     * We need volume to calculate raw money flow.
     */
    mfi(
      series: Series<number>,
      length: number,
      high?: Series<number>,
      low?: Series<number>,
      close?: Series<number>,
      volume?: Series<number>,
      _id?: string
    ): number {
      // Get volume from parameter or closure
      const vol = volume ? volume : getVolume ? getVolume() : undefined;
      if (!vol) return NA as unknown as number;

      // We need length+1 bars to compare current typical price with previous
      if (series.length < length + 1 || vol.length < length) return NA as unknown as number;

      let posFlow = 0;
      let negFlow = 0;

      for (let i = 0; i < length; i++) {
        const tp = series.get(i);
        const prevTp = series.get(i + 1);
        const v = vol.get(i);
        if (isNa(tp) || isNa(prevTp) || isNa(v)) return NA as unknown as number;

        const rawMf = (tp as number) * (v as number);
        if ((tp as number) > (prevTp as number)) {
          posFlow += rawMf;
        } else if ((tp as number) < (prevTp as number)) {
          negFlow += rawMf;
        }
        // If equal, money flow is not counted for either side
      }

      if (negFlow === 0) return 100;
      const mfr = posFlow / negFlow;
      return 100 - 100 / (1 + mfr);
    },

    get obv(): number { return cumulativeValue('obv'); },
    get accdist(): number { return cumulativeValue('accdist'); },
    get nvi(): number { return cumulativeValue('nvi'); },
    get pvi(): number { return cumulativeValue('pvi'); },
    get pvt(): number { return cumulativeValue('pvt'); },
    get wad(): number { return cumulativeValue('wad'); },
    get wvad(): number { return cumulativeValue('wvad'); },

    /**
     * ta.supertrend(factor, atrPeriod, high?, low?, close?)
     * Supertrend indicator.
     * Returns [supertrend, direction]
     * direction: -1 = uptrend (bullish), 1 = downtrend (bearish)
     *
     * upperBand = hl2 + factor * atr
     * lowerBand = hl2 - factor * atr
     * Supertrend flips between upper and lower bands based on close price.
     */
    supertrend(
      factor: number,
      atrPeriod: number,
      high?: Series<number>,
      low?: Series<number>,
      close?: Series<number>,
      id: string = 'default_supertrend'
    ): [number, number] {
      const naResult: [number, number] = [NA as unknown as number, NA as unknown as number];

      const h = high ? high : getHigh ? getHigh() : undefined;
      const l = low ? low : getLow ? getLow() : undefined;
      const c = close ? close : getClose ? getClose() : undefined;

      if (!h || !l || !c) return naResult;
      if (h.length < 2) return naResult;

      const curHigh = h.get(0);
      const curLow = l.get(0);
      const curClose = c.get(0);
      const prevClose = c.get(1);

      if (isNa(curHigh) || isNa(curLow) || isNa(curClose) || isNa(prevClose)) return naResult;

      // Calculate ATR using internal RMA-based ATR
      const atrId = id + '_atr';
      const atrVal = this.atr(atrPeriod, h, l, c, atrId);
      if (isNa(atrVal)) return naResult;

      const hl2 = ((curHigh as number) + (curLow as number)) / 2;
      let upperBand = hl2 + factor * (atrVal as number);
      let lowerBand = hl2 - factor * (atrVal as number);

      const barIndex = getCurrentBarIndex();
      let state = supertrendState.get(id);

      if (!state || state.prevBarIndex !== barIndex - 1) {
        // First bar: default to downtrend (direction = 1)
        state = {
          prevSupertrend: upperBand,
          prevDirection: 1,
          prevClose: curClose as number,
          prevBarIndex: barIndex,
        };
        supertrendState.set(id, state);
        return [upperBand, 1];
      }

      // Adjust bands based on previous values (band clamping)
      const prevST = state.prevSupertrend;
      const prevDir = state.prevDirection;

      // If previous supertrend was acting as lower band (uptrend), only allow it to go up
      if (prevDir === -1) {
        // Uptrend: supertrend = lowerBand
        if (lowerBand < prevST) {
          lowerBand = prevST;
        }
      } else {
        // Downtrend: supertrend = upperBand
        if (upperBand > prevST) {
          upperBand = prevST;
        }
      }

      let direction: number;
      let supertrend: number;

      if (prevDir === -1) {
        // Was uptrend
        if ((curClose as number) < lowerBand) {
          // Flip to downtrend
          direction = 1;
          supertrend = upperBand;
        } else {
          direction = -1;
          supertrend = lowerBand;
        }
      } else {
        // Was downtrend
        if ((curClose as number) > upperBand) {
          // Flip to uptrend
          direction = -1;
          supertrend = lowerBand;
        } else {
          direction = 1;
          supertrend = upperBand;
        }
      }

      state.prevSupertrend = supertrend;
      state.prevDirection = direction;
      state.prevClose = curClose as number;
      state.prevBarIndex = barIndex;

      return [supertrend, direction];
    },

    // ========================================================================
    // P1 TA FUNCTIONS
    // ========================================================================

    /**
     * ta.hma(source, length)
     * Hull Moving Average: WMA(2*WMA(src, length/2) - WMA(src, length), floor(sqrt(length)))
     */
    hma(source: Series<number>, length: number, id: string = 'default_hma'): number {
      if (source.length < length) return NA as unknown as number;

      const halfLen = Math.floor(length / 2);
      const sqrtLen = Math.floor(Math.sqrt(length));

      // Compute wma1 (half-length) and wma2 (full-length) inline
      let ws1 = 0, wn1 = 0, ws2 = 0, wn2 = 0;
      for (let i = 0; i < length; i++) {
        const v = source.get(i);
        if (isNa(v)) return NA as unknown as number;
        const w2 = length - i;
        ws2 += (v as number) * w2;
        wn2 += w2;
        if (i < halfLen) {
          const w1 = halfLen - i;
          ws1 += (v as number) * w1;
          wn1 += w1;
        }
      }
      if (wn1 === 0 || wn2 === 0) return NA as unknown as number;
      const delta = 2 * (ws1 / wn1) - (ws2 / wn2);

      // Accumulate delta in ring buffer
      const barIndex = getCurrentBarIndex();
      let state = hmaState.get(id);
      if (!state || state.capacity !== sqrtLen) {
        state = { deltaBuf: [], capacity: sqrtLen, prevBarIndex: barIndex };
        hmaState.set(id, state);
      }
      state.deltaBuf.unshift(delta);
      if (state.deltaBuf.length > sqrtLen) state.deltaBuf.length = sqrtLen;
      state.prevBarIndex = barIndex;

      if (state.deltaBuf.length < sqrtLen) return NA as unknown as number;

      // WMA over delta buffer
      let wSum = 0, wN = 0;
      for (let i = 0; i < sqrtLen; i++) {
        const w = sqrtLen - i;
        wSum += state.deltaBuf[i] * w;
        wN += w;
      }
      return wSum / wN;
    },

    /**
     * ta.kc(source, length, mult, useTrueRange?)
     * Keltner Channels. Returns [upper, basis, lower].
     * basis = EMA(source, length)
     * range = ATR(1) if useTrueRange, else EMA(high-low, length)
     */
    kc(
      source: Series<number>,
      length: number,
      mult: number,
      useTrueRange: boolean = true,
      id: string = 'default_kc'
    ): [number, number, number] {
      const NA3: [number, number, number] = [NA as unknown as number, NA as unknown as number, NA as unknown as number];

      const h = getHigh ? getHigh() : undefined;
      const l = getLow ? getLow() : undefined;
      const c = getClose ? getClose() : undefined;
      if (!h || !l || !c) return NA3;

      // basis EMA
      const basisId = id + '_basis';
      const basis = this.ema(source, length, basisId);
      if (isNa(basis)) return NA3;

      let rangeVal: number;
      if (useTrueRange) {
        rangeVal = this.atr(length, h, l, c, id + '_atr');
      } else {
        // EMA of (high - low) using stateful EMA
        const curHigh = h.get(0);
        const curLow = l.get(0);
        if (isNa(curHigh) || isNa(curLow)) return NA3;
        const curr = (curHigh as number) - (curLow as number);
        const rangeId = id + '_range';
        const barIndex = getCurrentBarIndex();
        const rangeState = emaState.get(rangeId);
        if (!rangeState || rangeState.prevBarIndex !== barIndex - 1) {
          emaState.set(rangeId, { prev: curr, prevBarIndex: barIndex, sum: 0, count: 0, seeded: true });
          rangeVal = curr;
        } else {
          const k = 2 / (length + 1);
          rangeVal = curr * k + (rangeState.prev as number) * (1 - k);
          emaState.set(rangeId, { prev: rangeVal, prevBarIndex: barIndex, sum: 0, count: 0, seeded: true });
        }
      }
      if (isNa(rangeVal)) return NA3;

      const upper = (basis as number) + mult * rangeVal;
      const lower = (basis as number) - mult * rangeVal;
      return [upper, basis as number, lower];
    },

    /**
     * ta.donchian(length)
     * Donchian Channels. Returns [upper, basis, lower].
     * upper = highest(high, length), lower = lowest(low, length), basis = (upper+lower)/2
     */
    donchian(
      length: number,
      high?: Series<number>,
      low?: Series<number>
    ): [number, number, number] {
      const NA3: [number, number, number] = [NA as unknown as number, NA as unknown as number, NA as unknown as number];
      const h = high ? high : (getHigh ? getHigh() : undefined);
      const l = low ? low : (getLow ? getLow() : undefined);
      if (!h || !l) return NA3;

      const upper = this.highest(h, length);
      const lower = this.lowest(l, length);
      if (isNa(upper) || isNa(lower)) return NA3;

      const basis = ((upper as number) + (lower as number)) / 2;
      return [upper as number, basis, lower as number];
    },

    /**
     * ta.linreg(source, length, offset)
     * Least-squares linear regression value.
     * Returns the fitted value at `offset` bars back from most recent.
     */
    linreg(source: Series<number>, length: number, offset: number = 0): number {
      if (source.length < length + offset) return NA as unknown as number;

      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      for (let i = 0; i < length; i++) {
        const x = i; // 0 = oldest in window
        const v = source.get(length - 1 - i + offset); // oldest first
        if (isNa(v)) return NA as unknown as number;
        sumX += x;
        sumY += v as number;
        sumXY += x * (v as number);
        sumX2 += x * x;
      }

      const denom = length * sumX2 - sumX * sumX;
      if (denom === 0) return sumY / length;

      const slope = (length * sumXY - sumX * sumY) / denom;
      const intercept = (sumY - slope * sumX) / length;

      // Value at the most recent end of the regression line
      return intercept + slope * (length - 1);
    },

    /**
     * ta.median(source, length)
     * Median value over `length` bars.
     * For even-length: returns the lower of the two middle values.
     */
    median(source: Series<number>, length: number): number {
      if (source.length < length) return NA as unknown as number;

      const vals: number[] = [];
      for (let i = 0; i < length; i++) {
        const v = source.get(i);
        if (isNa(v)) return NA as unknown as number;
        vals.push(v as number);
      }

      vals.sort((a, b) => a - b);
      const mid = Math.floor(length / 2);
      // Pine uses lower middle for even-length
      return length % 2 === 1 ? vals[mid] : vals[mid - 1];
    },

    roc(source: Series<number>, length: number, _id?: string): number {
      if (source.length <= length) return NA as unknown as number;
      const current = source.get(0);
      const past = source.get(length);
      if (isNa(current) || isNa(past) || (past as number) === 0) return NA as unknown as number;
      return ((current as number) - (past as number)) / (past as number) * 100;
    },

    vwap(
      source?: Series<number>,
      _anchor?: string,
      stdevMult?: number,
      id: string = 'default_vwap',
    ): number | [number, number, number] {
      const series = source ?? getClose?.();
      const volume = getVolume?.();
      if (!series || !volume) return NA as unknown as number;
      const price = series.get(0);
      const size = volume.get(0);
      if (isNa(price) || isNa(size)) return NA as unknown as number;

      const bar = getCurrentBarIndex();
      let state = vwapState.get(id);
      if (!state || state.prevBarIndex !== bar - 1) {
        state = { pv: 0, volume: 0, prevBarIndex: bar - 1 };
        vwapState.set(id, state);
      }
      state.pv += (price as number) * (size as number);
      state.volume += size as number;
      const value = state.volume === 0 ? (NA as unknown as number) : state.pv / state.volume;
      if (typeof stdevMult === 'number' && Number.isFinite(stdevMult)) {
        return [value, value, value];
      }
      return value;
    },

    wpr(length: number): number {
      const high = getHigh?.();
      const low = getLow?.();
      const close = getClose?.();
      if (!high || !low || !close || high.length < length || low.length < length) {
        return NA as unknown as number;
      }
      let highest = -Infinity;
      let lowest = Infinity;
      for (let i = 0; i < length; i++) {
        const h = high.get(i);
        const l = low.get(i);
        if (isNa(h) || isNa(l)) return NA as unknown as number;
        if ((h as number) > highest) highest = h as number;
        if ((l as number) < lowest) lowest = l as number;
      }
      const current = close.get(0);
      if (isNa(current) || highest === lowest) return NA as unknown as number;
      return -100 * (highest - (current as number)) / (highest - lowest);
    },

    sar(
      start: number = 0.02,
      increment: number = 0.02,
      maximum: number = 0.2,
      id: string = 'default_sar',
    ): number {
      const high = getHigh?.();
      const low = getLow?.();
      const close = getClose?.();
      if (!high || !low || !close) return NA as unknown as number;
      const h = high.get(0);
      const l = low.get(0);
      const c = close.get(0);
      if (isNa(h) || isNa(l) || isNa(c)) return NA as unknown as number;

      const bar = getCurrentBarIndex();
      let state = sarState.get(id);
      if (!state || state.prevBarIndex !== bar - 1) {
        state = {
          sar: low.get(1) as number,
          extreme: high.get(1) as number,
          acceleration: start,
          up: true,
          prevBarIndex: bar - 1,
        };
        if (isNa(state.sar) || isNa(state.extreme)) {
          state.sar = l as number;
          state.extreme = h as number;
        }
        sarState.set(id, state);
      }

      let sar = state.sar + state.acceleration * (state.extreme - state.sar);
      const previousHigh = high.get(1);
      const previousLow = low.get(1);
      if (!isNa(previousHigh) && !isNa(previousLow)) {
        sar = state.up
          ? Math.min(sar, previousHigh as number, previousLow as number)
          : Math.max(sar, previousHigh as number, previousLow as number);
      }

      if (state.up) {
        if ((l as number) < sar) {
          state.up = false;
          sar = state.extreme;
          state.extreme = l as number;
          state.acceleration = start;
        } else if ((h as number) > state.extreme) {
          state.extreme = h as number;
          state.acceleration = Math.min(maximum, state.acceleration + increment);
        }
      } else if ((h as number) > sar) {
        state.up = true;
        sar = state.extreme;
        state.extreme = h as number;
        state.acceleration = start;
      } else if ((l as number) < state.extreme) {
        state.extreme = l as number;
        state.acceleration = Math.min(maximum, state.acceleration + increment);
      }

      state.sar = sar;
      state.prevBarIndex = bar;
      return sar;
    },

    bbw(source: Series<number>, length: number, mult: number): number {
      const [basis, upper, lower] = this.bb(source, length, mult);
      if (isNa(basis) || isNa(upper) || isNa(lower) || basis === 0) return NA as unknown as number;
      return (((upper as number) - (lower as number)) / (basis as number)) * 100;
    },

    kcw(
      source: Series<number>,
      length: number,
      mult: number,
      useTrueRange: boolean = true,
      id: string = 'default_kcw',
    ): number {
      const [upper, basis, lower] = this.kc(source, length, mult, useTrueRange, id + '_kc');
      if (isNa(basis) || isNa(upper) || isNa(lower) || basis === 0) return NA as unknown as number;
      return ((upper as number) - (lower as number)) / (basis as number);
    },

    cog(source: Series<number>, length: number): number {
      if (source.length < length) return NA as unknown as number;
      let sum = 0;
      let weighted = 0;
      for (let i = 0; i < length; i++) {
        const value = source.get(i);
        if (isNa(value)) return NA as unknown as number;
        sum += value as number;
        weighted += (value as number) * (i + 1);
      }
      if (sum === 0) return NA as unknown as number;
      return -weighted / sum;
    },

    cross(a: Series<number> | number, b: Series<number> | number): boolean {
      const asSeries = (value: Series<number> | number): Series<number> => {
        if (value instanceof Series) return value;
        const series = new Series<number>(2);
        series.push(value);
        return series;
      };
      const left = asSeries(a);
      const right = asSeries(b);
      const a0 = left.get(0);
      const a1 = left.get(1);
      const b0 = right.get(0);
      const b1 = right.get(1);
      if (isNa(a0) || isNa(a1) || isNa(b0) || isNa(b1)) return false;
      return (
        ((a0 as number) > (b0 as number) && (a1 as number) <= (b1 as number)) ||
        ((a0 as number) < (b0 as number) && (a1 as number) >= (b1 as number))
      );
    },

    max(source: Series<number>, id: string = 'default_max'): number {
      const bar = getCurrentBarIndex();
      let state = extremeState.get(id);
      if (!state || state.prevBarIndex !== bar - 1) {
        state = { high: NA as unknown as number, low: NA as unknown as number, prevBarIndex: bar - 1 };
        extremeState.set(id, state);
      }
      const value = source.get(0);
      if (!isNa(value)) {
        state.high = isNa(state.high) ? (value as number) : Math.max(state.high, value as number);
      }
      state.prevBarIndex = bar;
      return state.high;
    },

    min(source: Series<number>, id: string = 'default_min'): number {
      const bar = getCurrentBarIndex();
      let state = extremeState.get(id);
      if (!state || state.prevBarIndex !== bar - 1) {
        state = { high: NA as unknown as number, low: NA as unknown as number, prevBarIndex: bar - 1 };
        extremeState.set(id, state);
      }
      const value = source.get(0);
      if (!isNa(value)) {
        state.low = isNa(state.low) ? (value as number) : Math.min(state.low, value as number);
      }
      state.prevBarIndex = bar;
      return state.low;
    },

    mode(source: Series<number>, length: number): number {
      if (source.length < length) return NA as unknown as number;
      const counts = new Map<number, number>();
      for (let i = 0; i < length; i++) {
        const value = source.get(i);
        if (isNa(value)) continue;
        counts.set(value as number, (counts.get(value as number) ?? 0) + 1);
      }
      let best = NA as unknown as number;
      let bestCount = 0;
      for (const [value, count] of counts) {
        if (count > bestCount || (count === bestCount && (isNa(best) || value < best))) {
          best = value;
          bestCount = count;
        }
      }
      return best;
    },

    range(source: Series<number>, length: number): number {
      if (source.length < length) return NA as unknown as number;
      let high = -Infinity;
      let low = Infinity;
      for (let i = 0; i < length; i++) {
        const value = source.get(i);
        if (isNa(value)) continue;
        if ((value as number) > high) high = value as number;
        if ((value as number) < low) low = value as number;
      }
      if (high === -Infinity || low === Infinity) return NA as unknown as number;
      return high - low;
    },

    rci(source: Series<number>, length: number): number {
      if (source.length < length) return NA as unknown as number;
      const values: number[] = [];
      for (let i = length - 1; i >= 0; i--) {
        const value = source.get(i);
        if (isNa(value)) return NA as unknown as number;
        values.push(value as number);
      }
      const ranks = rankValues(values);
      let sumSquared = 0;
      for (let i = 0; i < length; i++) {
        const diff = ranks[i]! - (i + 1);
        sumSquared += diff * diff;
      }
      const denominator = length * (length * length - 1);
      if (denominator === 0) return NA as unknown as number;
      return (1 - (6 * sumSquared) / denominator) * 100;
    },

    pivot_point_levels(
      type: string,
      anchor: boolean,
      _developing: boolean = false,
      id: string = 'default_pivots',
    ): number[] {
      const bar = getCurrentBarIndex();
      const high = getHigh?.().get(0);
      const low = getLow?.().get(0);
      const close = getClose?.().get(0);
      const open = getOpen?.().get(0) ?? close;
      if (isNa(high) || isNa(low) || isNa(close)) {
        return new Array<number>(11).fill(NA as unknown as number);
      }

      let state = pivotState.get(id);
      if (!state || state.prevBarIndex !== bar - 1) {
        state = {
          open: open as number,
          high: high as number,
          low: low as number,
          close: close as number,
          levels: null,
          prevBarIndex: bar,
        };
        pivotState.set(id, state);
        if (anchor) {
          state.open = open as number;
          state.high = high as number;
          state.low = low as number;
          state.close = close as number;
        }
        return new Array<number>(11).fill(NA as unknown as number);
      }

      if (anchor) {
        state.levels = pivotLevels(type, state.high, state.low, state.close, state.open);
        state.open = open as number;
        state.high = high as number;
        state.low = low as number;
        state.close = close as number;
      } else {
        state.high = Math.max(state.high, high as number);
        state.low = Math.min(state.low, low as number);
        state.close = close as number;
      }
      state.prevBarIndex = bar;
      return state.levels ?? new Array<number>(11).fill(NA as unknown as number);
    },
  };

  // Functions whose result depends on the previous bar.
  const STATEFUL = new Set([
    'ema', 'rsi', 'macd', 'atr', 'rma', 'cum', 'valuewhen', 'barssince',
    'dmi', 'mfi', 'obv', 'supertrend', 'hma', 'kc', 'vwap', 'sar',
    'kcw', 'max', 'min', 'pivot_point_levels',
  ]);

  // Arguments that Pine treats as a series. Each is recorded per call site so
  // `ta.ema(fast, 9)` sees `fast`'s history instead of a single scalar.
  const SOURCE_SLOTS: Record<string, number[] | 'pivot'> = {
    sma: [0], ema: [0], rsi: [0], macd: [0], bb: [0], wma: [0], vwma: [0],
    rma: [0], cum: [0], swma: [0], alma: [0], stdev: [0], variance: [0],
    change: [0], highest: [0], lowest: [0], highestbars: [0], lowestbars: [0],
    mom: [0], cci: [0], dev: [0], percentrank: [0], falling: [0], rising: [0],
    hma: [0], kc: [0], linreg: [0], median: [0], mfi: [0],
    roc: [0], vwap: [0], bbw: [0], kcw: [0], cog: [0], cross: [0, 1],
    crossover: [0, 1], crossunder: [0, 1],
    max: [0], min: [0], mode: [0], range: [0], rci: [0],
    valuewhen: [1], correlation: [0, 1], stoch: [0, 1, 2],
    tsi: [0], obv: [0, 1],
    pivothigh: 'pivot', pivotlow: 'pivot',
  };

  function invoke(name: string, rawArgs: unknown[]): unknown {
    const fn = (ta as unknown as Record<string, (...args: unknown[]) => unknown>)[name];
    if (typeof fn !== 'function') return NA;
    const args = [...rawArgs];
    const lead = args[0];
    const id = typeof lead === 'string' && lead.startsWith('__cs')
      ? (args.shift() as string)
      : `default:${name}`;

    // `ta.highest(length)` / `ta.lowest(length)` use the bar's high / low.
    if (args.length === 1) {
      if (name === 'highest' || name === 'highestbars') {
        args.unshift(getHigh?.() ?? (NA as unknown as Series<number>));
      } else if (name === 'lowest' || name === 'lowestbars') {
        args.unshift(getLow?.() ?? (NA as unknown as Series<number>));
      }
    }

    const slots = SOURCE_SLOTS[name];
    if (slots) {
      const indices = slots === 'pivot' ? (args.length >= 3 ? [0] : []) : slots;
      for (const slot of indices) {
        if (slot < args.length) args[slot] = asSeries(args[slot], id, slot);
      }
    }

    if (STATEFUL.has(name)) {
      if (name === 'supertrend') {
        return fn.call(ta, args[0], args[1], undefined, undefined, undefined, id);
      }
      if (name === 'mfi') {
        return fn.call(ta, args[0], args[1], undefined, undefined, undefined, undefined, id);
      }
      if (name === 'obv') {
        return fn.call(ta, args[0], args[1], id);
      }
      if (name === 'kc' || name === 'kcw') {
        return fn.call(ta, args[0], args[1], args[2], args[3], id);
      }
      if (name === 'vwap') {
        return fn.call(ta, args[0], args[1], args[2], id);
      }
      if (name === 'sar') {
        return fn.call(ta, args[0], args[1], args[2], id);
      }
      if (name === 'pivot_point_levels') {
        return fn.call(ta, args[0], args[1], args[2], id);
      }
      return fn.call(ta, ...args, id);
    }

    return fn.apply(ta, args);
  }

  return new Proxy(ta, {
    get(target, property, receiver) {
      const name = String(property);
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => invoke(name, args);
    },
  }) as TaModule;
}
