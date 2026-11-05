// Pine Script v6 array built-in functions

import { NA } from '../types/na';

export const arrayModule = {
  /** Create a new float (number) array. */
  newFloat(size?: number, val?: number): number[] {
    if (size === undefined || !Number.isFinite(size) || size <= 0) return [];
    return new Array(size).fill(val ?? 0);
  },

  /** Create a new int (number) array. */
  newInt(size?: number, val?: number): number[] {
    if (size === undefined || !Number.isFinite(size) || size <= 0) return [];
    return new Array(size).fill(val ?? 0);
  },

  /** Create a new boolean array. */
  newBool(size?: number, val?: boolean): boolean[] {
    if (size === undefined || !Number.isFinite(size) || size <= 0) return [];
    return new Array(size).fill(val ?? false);
  },

  /** Create a new string array. */
  newString(size?: number, val?: string): string[] {
    if (size === undefined || !Number.isFinite(size) || size <= 0) return [];
    return new Array(size).fill(val ?? '');
  },

  /** Generic new array. */
  new(size?: number, val?: any): any[] {
    if (size === undefined || !Number.isFinite(size) || size <= 0) return [];
    return new Array(size).fill(val ?? null);
  },

  /** Push a value onto the end of the array. */
  push(arr: any[], val: any): void {
    if (!Array.isArray(arr)) return;
    arr.push(val);
  },

  /** Remove and return the last element. */
  pop(arr: any[]): any {
    if (!Array.isArray(arr) || arr.length === 0) return NA;
    return arr.pop();
  },

  /** Get the element at the given index. */
  get(arr: any[], index: number): any {
    if (!Array.isArray(arr) || index < 0 || index >= arr.length) return NA;
    return arr[index];
  },

  /** Set the element at the given index. */
  set(arr: any[], index: number, val: any): void {
    if (!Array.isArray(arr)) return;
    if (index >= 0 && index < arr.length) {
      arr[index] = val;
    }
  },

  /** Return the size (length) of the array. */
  size(arr: any[]): number {
    return Array.isArray(arr) ? arr.length : 0;
  },

  /** Return the sum of all elements in a numeric array. */
  sum(arr: number[]): number {
    if (!Array.isArray(arr) || arr.length === 0) return 0;
    let total = 0;
    for (let i = 0; i < arr.length; i++) {
      total += arr[i];
    }
    return total;
  },

  /** Return the average of all elements in a numeric array. */
  avg(arr: number[]): number {
    if (!Array.isArray(arr) || arr.length === 0) return NaN;
    let total = 0;
    for (let i = 0; i < arr.length; i++) {
      total += arr[i];
    }
    return total / arr.length;
  },

  /** Return the maximum value in a numeric array. */
  max(arr: number[]): number {
    if (!Array.isArray(arr) || arr.length === 0) return NaN;
    let m = arr[0];
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] > m) m = arr[i];
    }
    return m;
  },

  /** Return the minimum value in a numeric array. */
  min(arr: number[]): number {
    if (!Array.isArray(arr) || arr.length === 0) return NaN;
    let m = arr[0];
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] < m) m = arr[i];
    }
    return m;
  },

  /** Insert a value at the given index, shifting elements right. */
  insert(arr: any[], index: number, val: any): void {
    if (!Array.isArray(arr)) return;
    arr.splice(index, 0, val);
  },

  /** Remove and return the element at the given index. */
  remove(arr: any[], index: number): any {
    if (!Array.isArray(arr) || index < 0 || index >= arr.length) return NA;
    return arr.splice(index, 1)[0];
  },

  /** Remove all elements from the array. */
  clear(arr: any[]): void {
    if (!Array.isArray(arr)) return;
    arr.length = 0;
  },

  /** Return a shallow copy of the array. */
  copy(arr: any[]): any[] {
    return Array.isArray(arr) ? arr.slice() : [];
  },

  /** Reverse the array in place. */
  reverse(arr: any[]): void {
    if (!Array.isArray(arr)) return;
    arr.reverse();
  },

  /**
   * Sort the array in place.
   * @param order - 'asc' (default) or 'desc'
   */
  sort(arr: any[], order?: string): void {
    const dir = order === 'desc' ? -1 : 1;
    arr.sort((a, b) => {
      if (a < b) return -1 * dir;
      if (a > b) return 1 * dir;
      return 0;
    });
  },

  /** Join all elements into a string with the given separator. */
  join(arr: any[], sep?: string): string {
    return arr.join(sep ?? ', ');
  },

  /** Return a shallow copy of a portion of the array. */
  slice(arr: any[], start: number, end?: number): any[] {
    if (end === undefined) return arr.slice(start);
    return arr.slice(start, end);
  },

  /** Check if the array contains a given value. */
  includes(arr: any[], val: any): boolean {
    return arr.includes(val);
  },

  /** Return the index of the first occurrence of val, or -1. */
  indexof(arr: any[], val: any): number {
    return arr.indexOf(val);
  },

  /** Return the index of the last occurrence of val, or -1. */
  lastindexof(arr: any[], val: any): number {
    return arr.lastIndexOf(val);
  },

  /** Create an array from the given values. */
  from(...vals: any[]): any[] {
    return [...vals];
  },

  /** Remove and return the first element. */
  shift(arr: any[]): any {
    if (!Array.isArray(arr) || arr.length === 0) return NA;
    return arr.shift();
  },

  /** Add element(s) to the beginning. */
  unshift(arr: any[], val: any): void {
    if (!Array.isArray(arr)) return;
    arr.unshift(val);
  },

  /** Return the median of a numeric array. */
  median(arr: number[]): number {
    if (!Array.isArray(arr) || arr.length === 0) return NaN;
    const sorted = arr.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  },

  /** Return the standard deviation. */
  stdev(arr: number[]): number {
    if (!Array.isArray(arr) || arr.length === 0) return NaN;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const sqDiffs = arr.map(v => (v - mean) ** 2);
    return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / arr.length);
  },

  /** Return the variance. */
  variance(arr: number[]): number {
    if (!Array.isArray(arr) || arr.length === 0) return NaN;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return arr.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / arr.length;
  },

  /** Return the range (max - min). */
  range(arr: number[]): number {
    if (!Array.isArray(arr) || arr.length === 0) return NaN;
    let lo = arr[0], hi = arr[0];
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] < lo) lo = arr[i];
      if (arr[i] > hi) hi = arr[i];
    }
    return hi - lo;
  },

  /** Return the first element. */
  first(arr: any[]): any {
    return Array.isArray(arr) && arr.length > 0 ? arr[0] : NA;
  },

  /** Return the last element. */
  last(arr: any[]): any {
    return Array.isArray(arr) && arr.length > 0 ? arr[arr.length - 1] : NA;
  },

  /** Concatenate two arrays into a new one. */
  concat(arr1: any[], arr2: any[]): any[] {
    return arr1.concat(arr2);
  },

  /** Create a new line array. */
  newLine(size?: number, val?: any): any[] {
    if (size === undefined || !Number.isFinite(size) || size <= 0) return [];
    return new Array(size).fill(val ?? null);
  },

  /** Create a new linefill array. */
  newLinefill(size?: number, val?: any): any[] {
    if (size === undefined || !Number.isFinite(size) || size <= 0) return [];
    return new Array(size).fill(val ?? null);
  },

  /** Create a new label array. */
  newLabel(size?: number, val?: any): any[] {
    if (size === undefined || !Number.isFinite(size) || size <= 0) return [];
    return new Array(size).fill(val ?? null);
  },

  /** Create a new box array. */
  newBox(size?: number, val?: any): any[] {
    if (size === undefined || !Number.isFinite(size) || size <= 0) return [];
    return new Array(size).fill(val ?? null);
  },

  /** Create a new table array. */
  newTable(size?: number, val?: any): any[] {
    if (size === undefined || !Number.isFinite(size) || size <= 0) return [];
    return new Array(size).fill(val ?? null);
  },

  /** Create a new color array. */
  newColor(size?: number, val?: any): any[] {
    if (size === undefined || !Number.isFinite(size) || size <= 0) return [];
    return new Array(size).fill(val ?? null);
  },

  /** Return absolute values of all elements. */
  abs(arr: number[]): number[] {
    return arr.map(v => Math.abs(v));
  },

  /** Binary search (array must be sorted). Returns index. */
  binarySearch(arr: number[], val: number): number {
    let lo = 0, hi = arr.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid] === val) return mid;
      if (arr[mid] < val) lo = mid + 1;
      else hi = mid - 1;
    }
    return -1;
  },

  binarySearchLeftmost(arr: number[], val: number): number {
    let lo = 0, hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid] < val) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  },

  binarySearchRightmost(arr: number[], val: number): number {
    let lo = 0, hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid] <= val) lo = mid + 1;
      else hi = mid;
    }
    return lo - 1;
  },

  /** Test if all elements pass a condition function. */
  every(arr: any[], fn: (val: any) => boolean): boolean {
    return arr.every(fn);
  },

  /** Test if any element passes a condition function. */
  some(arr: any[], fn: (val: any) => boolean): boolean {
    return arr.some(fn);
  },

  /** Fill array with a value. */
  fill(arr: any[], val: any, fromIndex?: number, toIndex?: number): void {
    arr.fill(val, fromIndex ?? 0, toIndex ?? arr.length);
  },

  /** Compute covariance between two arrays. */
  covariance(arr1: number[], arr2: number[]): number {
    const n = Math.min(arr1.length, arr2.length);
    if (n === 0) return NaN;
    const mean1 = arr1.slice(0, n).reduce((a, b) => a + b, 0) / n;
    const mean2 = arr2.slice(0, n).reduce((a, b) => a + b, 0) / n;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += (arr1[i] - mean1) * (arr2[i] - mean2);
    }
    return sum / n;
  },

  /** Return the mode (most common value). */
  mode(arr: number[]): number {
    if (arr.length === 0) return NaN;
    const counts = new Map<number, number>();
    for (const v of arr) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    let best = arr[0], bestCount = 0;
    for (const [v, c] of counts) {
      if (c > bestCount) { best = v; bestCount = c; }
    }
    return best;
  },

  /** Percentile using linear interpolation. */
  percentileLinearInterpolation(arr: number[], pct: number): number {
    if (arr.length === 0) return NaN;
    const sorted = arr.slice().sort((a, b) => a - b);
    const idx = (pct / 100) * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  },

  /** Percentile using nearest rank. */
  percentileNearestRank(arr: number[], pct: number): number {
    if (arr.length === 0) return NaN;
    const sorted = arr.slice().sort((a, b) => a - b);
    const idx = Math.ceil((pct / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
  },

  /** Percent rank of value within array. */
  percentrank(arr: number[], val: number): number {
    if (arr.length === 0) return NaN;
    let count = 0;
    for (const v of arr) {
      if (v <= val) count++;
    }
    return (count / arr.length) * 100;
  },

  /** Standardize array (z-score). */
  standardize(arr: number[]): number[] {
    if (arr.length === 0) return [];
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const std = Math.sqrt(arr.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / arr.length);
    if (std === 0) return arr.map(() => 0);
    return arr.map(v => (v - mean) / std);
  },

  /** Return sorted indices without modifying the original array. */
  sortIndices(arr: any[], order?: string): number[] {
    const dir = order === 'desc' ? -1 : 1;
    return arr.map((_, i) => i).sort((a, b) => {
      if (arr[a] < arr[b]) return -1 * dir;
      if (arr[a] > arr[b]) return 1 * dir;
      return 0;
    });
  },
};

// ─── Map Module ──────────────────────────────────────────────────────────────

export const mapModule = {
  /** Create a new map. */
  new<K = any, V = any>(): Map<K, V> {
    return new Map<K, V>();
  },

  /** Put a key-value pair into the map. Returns the previous value if the key existed. */
  put<K, V>(m: Map<K, V>, key: K, val: V): V | undefined {
    const prev = m.get(key);
    m.set(key, val);
    return prev;
  },

  /** Copy all key-value pairs from source into target. */
  putAll<K, V>(target: Map<K, V>, source: Map<K, V>): void {
    for (const [key, value] of source) target.set(key, value);
  },

  /** Get the value associated with the key, or undefined. */
  get<K, V>(m: Map<K, V>, key: K): V | undefined {
    const value = m.get(key);
    return value === undefined ? (NA as unknown as V) : value;
  },

  /** Check if the map contains the given key. */
  contains<K>(m: Map<K, any>, key: K): boolean {
    return m.has(key);
  },

  /** Remove the key-value pair. Returns the removed value. */
  remove<K, V>(m: Map<K, V>, key: K): V | undefined {
    const v = m.get(key);
    m.delete(key);
    return v;
  },

  /** Remove all key-value pairs from the map. */
  clear(m: Map<any, any>): void {
    m.clear();
  },

  /** Return the number of key-value pairs. */
  size(m: Map<any, any>): number {
    return m.size;
  },

  /** Return an array of all keys. */
  keys<K>(m: Map<K, any>): K[] {
    return Array.from(m.keys());
  },

  /** Return an array of all values. */
  values<V>(m: Map<any, V>): V[] {
    return Array.from(m.values());
  },
};

// ─── Matrix Module ───────────────────────────────────────────────────────────

/** Internal matrix representation: 2D array with row/col metadata. */
export interface PineMatrix<T = any> {
  data: T[][];
  rows: number;
  cols: number;
}

function matrixNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : Number.NaN;
}

function matrixCopy(m: PineMatrix<any>): PineMatrix<any> {
  return { data: m.data.map((row) => row.slice()), rows: m.rows, cols: m.cols };
}

function matrixNumbers(m: PineMatrix<any>): number[][] {
  if (!m || !Array.isArray(m.data)) return [];
  return m.data.map((row) => row.map(matrixNumber));
}

function matrixMultiply(a: PineMatrix<any>, b: PineMatrix<any>): PineMatrix<number> {
  if (typeof b === 'number') {
    return {
      data: a.data.map((row) => row.map((value) => matrixNumber(value) * b)),
      rows: a.rows,
      cols: a.cols,
    };
  }
  if (typeof a === 'number') {
    return {
      data: b.data.map((row) => row.map((value) => matrixNumber(value) * a)),
      rows: b.rows,
      cols: b.cols,
    };
  }
  if (a.cols !== b.rows) return { data: [], rows: 0, cols: 0 };
  const data: number[][] = [];
  for (let r = 0; r < a.rows; r++) {
    const row: number[] = [];
    for (let c = 0; c < b.cols; c++) {
      let sum = 0;
      for (let k = 0; k < a.cols; k++) {
        sum += matrixNumber(a.data[r][k]) * matrixNumber(b.data[k][c]);
      }
      row.push(sum);
    }
    data.push(row);
  }
  return { data, rows: a.rows, cols: b.cols };
}

function matrixDeterminant(values: number[][]): number {
  const n = values.length;
  if (n === 0 || values.some((row) => row.length !== n)) return Number.NaN;
  const a = values.map((row) => row.slice());
  let determinant = 1;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    if (Math.abs(a[pivot][col]) < 1e-12) return 0;
    if (pivot !== col) {
      [a[pivot], a[col]] = [a[col], a[pivot]];
      determinant *= -1;
    }
    determinant *= a[col][col];
    const divisor = a[col][col];
    for (let row = col + 1; row < n; row++) {
      const factor = a[row][col] / divisor;
      for (let k = col; k < n; k++) a[row][k] -= factor * a[col][k];
    }
  }
  return determinant;
}

function matrixInverse(values: number[][]): number[][] {
  const n = values.length;
  if (n === 0 || values.some((row) => row.length !== n)) return [];
  const a = values.map((row, index) => [
    ...row,
    ...Array.from({ length: n }, (_, column) => (column === index ? 1 : 0)),
  ]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    if (Math.abs(a[pivot][col]) < 1e-12) return [];
    [a[pivot], a[col]] = [a[col], a[pivot]];
    const divisor = a[col][col];
    for (let k = 0; k < 2 * n; k++) a[col][k] /= divisor;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = a[row][col];
      for (let k = 0; k < 2 * n; k++) a[row][k] -= factor * a[col][k];
    }
  }
  return a.map((row) => row.slice(n));
}

function matrixRank(values: number[][]): number {
  const a = values.map((row) => row.slice());
  const rows = a.length;
  const cols = rows > 0 ? a[0].length : 0;
  let rank = 0;
  for (let col = 0; col < cols && rank < rows; col++) {
    let pivot = rank;
    for (let row = rank + 1; row < rows; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    if (Math.abs(a[pivot][col]) < 1e-12) continue;
    [a[pivot], a[rank]] = [a[rank], a[pivot]];
    const divisor = a[rank][col];
    for (let k = col; k < cols; k++) a[rank][k] /= divisor;
    for (let row = 0; row < rows; row++) {
      if (row === rank) continue;
      const factor = a[row][col];
      for (let k = col; k < cols; k++) a[row][k] -= factor * a[rank][k];
    }
    rank++;
  }
  return rank;
}

/** Jacobi eigen decomposition for a symmetric matrix. */
function matrixEigen(values: number[][]): { values: number[]; vectors: number[][] } {
  const n = values.length;
  if (n === 0 || values.some((row) => row.length !== n)) return { values: [], vectors: [] };
  const a = values.map((row) => row.slice());
  const vectors: number[][] = Array.from({ length: n }, (_, row) =>
    Array.from({ length: n }, (_, col) => (row === col ? 1 : 0)),
  );
  for (let iteration = 0; iteration < 100 * n * n; iteration++) {
    let p = 0;
    let q = 1;
    let max = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(a[i][j]) > max) {
          max = Math.abs(a[i][j]);
          p = i;
          q = j;
        }
      }
    }
    if (max < 1e-12) break;
    const angle = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const app = a[p][p];
    const aqq = a[q][q];
    const apq = a[p][q];
    for (let k = 0; k < n; k++) {
      const akp = a[k][p];
      const akq = a[k][q];
      a[k][p] = cos * akp - sin * akq;
      a[k][q] = sin * akp + cos * akq;
    }
    for (let k = 0; k < n; k++) {
      const apk = a[p][k];
      const aqk = a[q][k];
      a[p][k] = cos * apk - sin * aqk;
      a[q][k] = sin * apk + cos * aqk;
    }
    a[p][p] = cos * cos * app - 2 * sin * cos * apq + sin * sin * aqq;
    a[q][q] = sin * sin * app + 2 * sin * cos * apq + cos * cos * aqq;
    a[p][q] = 0;
    a[q][p] = 0;
    for (let k = 0; k < n; k++) {
      const vkp = vectors[k][p];
      const vkq = vectors[k][q];
      vectors[k][p] = cos * vkp - sin * vkq;
      vectors[k][q] = sin * vkp + cos * vkq;
    }
  }
  return { values: a.map((row, index) => row[index]), vectors };
}

function matrixPseudoInverse(m: PineMatrix<any>): PineMatrix<number> {
  const values = matrixNumbers(m);
  const rows = m?.rows ?? 0;
  const cols = m?.cols ?? 0;
  if (rows === 0 || cols === 0) return { data: [], rows: 0, cols: 0 };
  const transposed = matrixModule.transpose({ data: values, rows, cols });
  const product = matrixMultiply(transposed, { data: values, rows, cols });
  const inverse = matrixInverse(product.data);
  if (inverse.length === 0) return { data: [], rows: 0, cols: 0 };
  return matrixMultiply(
    { data: inverse, rows: inverse.length, cols: inverse.length },
    transposed,
  );
}

export const matrixModule = {
  /** Create a new matrix with given rows, cols, and fill value. */
  new<T = number>(rows: number, cols: number, val?: T): PineMatrix<T> {
    const defaultVal = (val !== undefined ? val : 0) as T;
    const data: T[][] = [];
    for (let r = 0; r < rows; r++) {
      data.push(new Array(cols).fill(defaultVal));
    }
    return { data, rows, cols };
  },

  /** Get the value at (row, col). */
  get<T>(m: PineMatrix<T>, row: number, col: number): T | undefined {
    if (row < 0 || row >= m.rows || col < 0 || col >= m.cols) return NA as unknown as T;
    return m.data[row][col];
  },

  /** Set the value at (row, col). */
  set<T>(m: PineMatrix<T>, row: number, col: number, val: T): void {
    if (row >= 0 && row < m.rows && col >= 0 && col < m.cols) {
      m.data[row][col] = val;
    }
  },

  /** Return the number of rows. */
  rows<T>(m: PineMatrix<T>): number {
    return m.rows;
  },

  /** Return the number of columns. */
  columns<T>(m: PineMatrix<T>): number {
    return m.cols;
  },

  /** Add a row at the given index. vals may be an array of values or a single fill value. */
  addRow<T>(m: PineMatrix<T>, idx: number, vals?: T | T[]): void {
    const newRow: T[] = Array.isArray(vals)
      ? vals.slice(0, m.cols)
      : new Array(m.cols).fill(vals !== undefined ? vals : 0);
    // Pad if needed
    while (newRow.length < m.cols) newRow.push((vals !== undefined ? vals : 0) as T);
    const clampedIdx = Math.max(0, Math.min(idx, m.rows));
    m.data.splice(clampedIdx, 0, newRow);
    m.rows++;
  },

  /** Add a column at the given index. vals may be an array of values or a single fill value. */
  addCol<T>(m: PineMatrix<T>, idx: number, vals?: T | T[]): void {
    const clampedIdx = Math.max(0, Math.min(idx, m.cols));
    for (let r = 0; r < m.rows; r++) {
      const v: T = Array.isArray(vals)
        ? (vals[r] !== undefined ? vals[r] : (0 as unknown as T))
        : (vals !== undefined ? vals : 0 as unknown as T);
      m.data[r].splice(clampedIdx, 0, v);
    }
    m.cols++;
  },

  /** Remove a row at the given index. Returns the removed row. */
  removeRow<T>(m: PineMatrix<T>, idx: number): T[] | undefined {
    if (idx < 0 || idx >= m.rows) return undefined;
    const removed = m.data.splice(idx, 1)[0];
    m.rows--;
    return removed;
  },

  /** Remove a column at the given index. Returns the removed column values. */
  removeCol<T>(m: PineMatrix<T>, idx: number): T[] | undefined {
    if (idx < 0 || idx >= m.cols) return undefined;
    const removed: T[] = [];
    for (let r = 0; r < m.rows; r++) {
      removed.push(m.data[r].splice(idx, 1)[0]);
    }
    m.cols--;
    return removed;
  },

  newFloat(rows: number, cols: number, val: number = 0): PineMatrix<number> {
    return matrixModule.new(rows, cols, val);
  },

  newInt(rows: number, cols: number, val: number = 0): PineMatrix<number> {
    return matrixModule.new(rows, cols, Math.trunc(val));
  },

  newBool(rows: number, cols: number, val: boolean = false): PineMatrix<boolean> {
    return matrixModule.new(rows, cols, val);
  },

  copy<T>(m: PineMatrix<T>): PineMatrix<T> {
    return { data: m.data.map((row) => row.slice()), rows: m.rows, cols: m.cols };
  },

  fill<T>(m: PineMatrix<T>, val: T): void {
    for (const row of m.data) row.fill(val);
  },

  sum(m: PineMatrix<any>): number {
    let total = 0;
    let found = false;
    for (const row of m.data) {
      for (const value of row) {
        const number = matrixNumber(value);
        if (Number.isFinite(number)) {
          total += number;
          found = true;
        }
      }
    }
    return found ? total : Number.NaN;
  },

  avg(m: PineMatrix<any>): number {
    let total = 0;
    let count = 0;
    for (const row of m.data) {
      for (const value of row) {
        const number = matrixNumber(value);
        if (Number.isFinite(number)) {
          total += number;
          count++;
        }
      }
    }
    return count > 0 ? total / count : Number.NaN;
  },

  max(m: PineMatrix<any>): number {
    let result = Number.NEGATIVE_INFINITY;
    for (const row of m.data) {
      for (const value of row) {
        const number = matrixNumber(value);
        if (Number.isFinite(number) && number > result) result = number;
      }
    }
    return Number.isFinite(result) ? result : Number.NaN;
  },

  min(m: PineMatrix<any>): number {
    let result = Number.POSITIVE_INFINITY;
    for (const row of m.data) {
      for (const value of row) {
        const number = matrixNumber(value);
        if (Number.isFinite(number) && number < result) result = number;
      }
    }
    return Number.isFinite(result) ? result : Number.NaN;
  },

  median(m: PineMatrix<any>): number {
    const values = m.data.flat().map(matrixNumber).filter(Number.isFinite).sort((a, b) => a - b);
    if (values.length === 0) return Number.NaN;
    const middle = Math.floor(values.length / 2);
    return values.length % 2 === 1 ? values[middle]! : (values[middle - 1]! + values[middle]!) / 2;
  },

  mode(m: PineMatrix<any>): number {
    const counts = new Map<number, number>();
    for (const value of m.data.flat()) {
      const number = matrixNumber(value);
      if (Number.isFinite(number)) counts.set(number, (counts.get(number) ?? 0) + 1);
    }
    let best = Number.NaN;
    let bestCount = 0;
    for (const [value, count] of counts) {
      if (count > bestCount || (count === bestCount && (Number.isNaN(best) || value < best))) {
        best = value;
        bestCount = count;
      }
    }
    return best;
  },

  transpose<T>(m: PineMatrix<T>): PineMatrix<T> {
    const data: T[][] = [];
    for (let c = 0; c < m.cols; c++) {
      const row: T[] = [];
      for (let r = 0; r < m.rows; r++) row.push(m.data[r][c]);
      data.push(row);
    }
    return { data, rows: m.cols, cols: m.rows };
  },

  reverse<T>(m: PineMatrix<T>): void {
    m.data.reverse();
    for (const row of m.data) row.reverse();
  },

  sort(m: PineMatrix<any>, column: number, order?: string): void {
    const dir = order === 'descending' || order === 'desc' ? -1 : 1;
    if (column < 0 || column >= m.cols) return;
    m.data.sort((a, b) => {
      const left = matrixNumber(a[column]);
      const right = matrixNumber(b[column]);
      if (Number.isNaN(left) && Number.isNaN(right)) return 0;
      if (Number.isNaN(left)) return 1;
      if (Number.isNaN(right)) return -1;
      return (left - right) * dir;
    });
  },

  reshape<T>(m: PineMatrix<T>, rows: number, cols: number): void {
    const flat = m.data.flat();
    const data: T[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: T[] = [];
      for (let c = 0; c < cols; c++) {
        row.push((flat[r * cols + c] ?? Number.NaN) as T);
      }
      data.push(row);
    }
    m.data = data;
    m.rows = rows;
    m.cols = cols;
  },

  row<T>(m: PineMatrix<T>, row: number): T[] {
    if (row < 0 || row >= m.rows) return [];
    return m.data[row].slice();
  },

  col<T>(m: PineMatrix<T>, column: number): T[] {
    if (column < 0 || column >= m.cols) return [];
    return m.data.map((row) => row[column]);
  },

  submatrix<T>(
    m: PineMatrix<T>,
    fromRow: number,
    toRow: number,
    fromCol: number,
    toCol: number,
  ): PineMatrix<T> {
    const r0 = Math.max(0, Math.min(fromRow, m.rows - 1));
    const r1 = Math.max(r0, Math.min(toRow, m.rows - 1));
    const c0 = Math.max(0, Math.min(fromCol, m.cols - 1));
    const c1 = Math.max(c0, Math.min(toCol, m.cols - 1));
    const data: T[][] = [];
    for (let r = r0; r <= r1; r++) data.push(m.data[r].slice(c0, c1 + 1));
    return { data, rows: data.length, cols: data[0]?.length ?? 0 };
  },

  concat<T>(first: PineMatrix<T>, second: PineMatrix<T>): PineMatrix<T> {
    if (first.cols !== second.cols) return { data: [], rows: 0, cols: 0 };
    return {
      data: [...first.data.map((row) => row.slice()), ...second.data.map((row) => row.slice())],
      rows: first.rows + second.rows,
      cols: first.cols,
    };
  },

  diff(m1: PineMatrix<any>, m2: PineMatrix<any> | number): PineMatrix<number> {
    if (typeof m2 === 'number') {
      return {
        data: m1.data.map((row) => row.map((value) => matrixNumber(value) - m2)),
        rows: m1.rows,
        cols: m1.cols,
      };
    }
    if (m1.rows !== m2.rows || m1.cols !== m2.cols) return { data: [], rows: 0, cols: 0 };
    return {
      data: m1.data.map((row, r) => row.map((value, c) => matrixNumber(value) - matrixNumber(m2.data[r][c]))),
      rows: m1.rows,
      cols: m1.cols,
    };
  },

  mult(a: PineMatrix<any>, b: PineMatrix<any> | number): PineMatrix<number> {
    return matrixMultiply(a, b as any);
  },

  pow(m: PineMatrix<any>, exponent: number): PineMatrix<number> {
    return {
      data: m.data.map((row) => row.map((value) => Math.pow(matrixNumber(value), exponent))),
      rows: m.rows,
      cols: m.cols,
    };
  },

  kron(a: PineMatrix<any>, b: PineMatrix<any>): PineMatrix<number> {
    const data: number[][] = [];
    for (let ar = 0; ar < a.rows; ar++) {
      for (let br = 0; br < b.rows; br++) {
        const row: number[] = [];
        for (let ac = 0; ac < a.cols; ac++) {
          for (let bc = 0; bc < b.cols; bc++) {
            row.push(matrixNumber(a.data[ar][ac]) * matrixNumber(b.data[br][bc]));
          }
        }
        data.push(row);
      }
    }
    return { data, rows: data.length, cols: data[0]?.length ?? 0 };
  },

  trace(m: PineMatrix<any>): number {
    let total = 0;
    const size = Math.min(m.rows, m.cols);
    for (let i = 0; i < size; i++) total += matrixNumber(m.data[i][i]);
    return total;
  },

  det(m: PineMatrix<any>): number {
    return matrixDeterminant(matrixNumbers(m));
  },

  inv(m: PineMatrix<any>): PineMatrix<number> {
    const inverse = matrixInverse(matrixNumbers(m));
    return { data: inverse, rows: inverse.length, cols: inverse[0]?.length ?? 0 };
  },

  pinv(m: PineMatrix<any>): PineMatrix<number> {
    return matrixPseudoInverse(m);
  },

  rank(m: PineMatrix<any>): number {
    return matrixRank(matrixNumbers(m));
  },

  eigenvalues(m: PineMatrix<any>): number[] {
    return matrixEigen(matrixNumbers(m)).values;
  },

  eigenvectors(m: PineMatrix<any>): PineMatrix<number> {
    const { vectors } = matrixEigen(matrixNumbers(m));
    return { data: vectors, rows: vectors.length, cols: vectors[0]?.length ?? 0 };
  },

  elementsCount(m: PineMatrix<any>): number {
    return m.rows * m.cols;
  },

  swapRows<T>(m: PineMatrix<T>, first: number, second: number): void {
    if (first < 0 || first >= m.rows || second < 0 || second >= m.rows) return;
    [m.data[first], m.data[second]] = [m.data[second], m.data[first]];
  },

  swapColumns<T>(m: PineMatrix<T>, first: number, second: number): void {
    if (first < 0 || first >= m.cols || second < 0 || second >= m.cols) return;
    for (const row of m.data) {
      [row[first], row[second]] = [row[second], row[first]];
    }
  },

  isSquare(m: PineMatrix<any>): boolean {
    return m.rows === m.cols;
  },

  isZero(m: PineMatrix<any>): boolean {
    return m.data.every((row) => row.every((value) => matrixNumber(value) === 0));
  },

  isBinary(m: PineMatrix<any>): boolean {
    return m.data.every((row) =>
      row.every((value) => {
        const number = matrixNumber(value);
        return number === 0 || number === 1;
      }),
    );
  },

  isIdentity(m: PineMatrix<any>): boolean {
    if (m.rows !== m.cols) return false;
    for (let r = 0; r < m.rows; r++) {
      for (let c = 0; c < m.cols; c++) {
        if (matrixNumber(m.data[r][c]) !== (r === c ? 1 : 0)) return false;
      }
    }
    return true;
  },

  isDiagonal(m: PineMatrix<any>): boolean {
    if (m.rows !== m.cols) return false;
    for (let r = 0; r < m.rows; r++) {
      for (let c = 0; c < m.cols; c++) {
        if (r !== c && matrixNumber(m.data[r][c]) !== 0) return false;
      }
    }
    return true;
  },

  isAntidiagonal(m: PineMatrix<any>): boolean {
    if (m.rows !== m.cols) return false;
    for (let r = 0; r < m.rows; r++) {
      for (let c = 0; c < m.cols; c++) {
        if (r + c !== m.cols - 1 && matrixNumber(m.data[r][c]) !== 0) return false;
      }
    }
    return true;
  },

  isSymmetric(m: PineMatrix<any>): boolean {
    if (m.rows !== m.cols) return false;
    for (let r = 0; r < m.rows; r++) {
      for (let c = 0; c < m.cols; c++) {
        if (matrixNumber(m.data[r][c]) !== matrixNumber(m.data[c][r])) return false;
      }
    }
    return true;
  },

  isAntisymmetric(m: PineMatrix<any>): boolean {
    if (m.rows !== m.cols) return false;
    for (let r = 0; r < m.rows; r++) {
      for (let c = 0; c < m.cols; c++) {
        if (matrixNumber(m.data[r][c]) !== -matrixNumber(m.data[c][r])) return false;
      }
    }
    return true;
  },

  isTriangular(m: PineMatrix<any>): boolean {
    if (m.rows !== m.cols) return false;
    let upper = true;
    let lower = true;
    for (let r = 0; r < m.rows; r++) {
      for (let c = 0; c < m.cols; c++) {
        if (r > c && matrixNumber(m.data[r][c]) !== 0) upper = false;
        if (r < c && matrixNumber(m.data[r][c]) !== 0) lower = false;
      }
    }
    return upper || lower;
  },

  isStochastic(m: PineMatrix<any>): boolean {
    for (const row of m.data) {
      let sum = 0;
      for (const value of row) {
        const number = matrixNumber(value);
        if (number < 0 || number > 1) return false;
        sum += number;
      }
      if (Math.abs(sum - 1) > 1e-9) return false;
    }
    return true;
  },
};
