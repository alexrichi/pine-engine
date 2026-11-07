import { numeric } from '../types/series';

function pointXY(point: unknown): { x: number; y: number } | null {
  if (Array.isArray(point) && point.length >= 2) {
    const x = Number(point[0]);
    const y = Number(point[1]);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  }
  if (point && typeof point === 'object') {
    const value = point as { x?: unknown; y?: unknown };
    const x = Number(value.x);
    const y = Number(value.y);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  }
  return null;
}

/** A `chart.point` anchor: x comes from `time` or `index` depending on `xloc`. */
function pointAnchor(point: unknown, xloc: string): { x: number; y: number } | null {
  if (!point || typeof point !== 'object') return null;
  const value = point as { time?: unknown; index?: unknown; price?: unknown };
  const x = Number(xloc === 'bar_time' ? value.time : value.index ?? value.time);
  const y = Number(value.price);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

export interface LineObject {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  xloc: string;
  extend: string;
  color: string;
  style: string;
  width: number;
  _deleted: boolean;
}

export function createLineModule() {
  let nextId = 0;
  const lines: LineObject[] = [];

  const createLine = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    opts?: {
      xloc?: string;
      extend?: string;
      color?: string;
      style?: string;
      width?: number;
    }
  ): LineObject => {
    const line: LineObject = {
      id: nextId++,
      x1: numeric(x1),
      y1: numeric(y1),
      x2: numeric(x2),
      y2: numeric(y2),
      xloc: opts?.xloc ?? 'bar_index',
      extend: opts?.extend ?? 'none',
      color: opts?.color ?? '#2962FF',
      style: opts?.style ?? 'solid',
      width: opts?.width ?? 1,
      _deleted: false,
    };
    lines.push(line);
    return line;
  };

  return {
    new: createLine,

    /** `line.new(first_point, second_point, ...)` with `chart.point` anchors. */
    newPoints(
      first: unknown,
      second: unknown,
      opts?: { xloc?: string; extend?: string; color?: string; style?: string; width?: number }
    ): LineObject {
      const xloc = opts?.xloc ?? 'bar_time';
      const a = pointAnchor(first, xloc);
      const b = pointAnchor(second, xloc);
      if (!a || !b) return createLine(NaN, NaN, NaN, NaN, opts);
      return createLine(a.x, a.y, b.x, b.y, opts);
    },

    delete(line: LineObject | null | undefined): void {
      if (!line || typeof line !== 'object') return;
      line._deleted = true;
    },

    set_x1(line: LineObject, val: number): void {
      if (!line || typeof line !== 'object') return;
      line.x1 = numeric(val);
    },

    set_y1(line: LineObject, val: number): void {
      if (!line || typeof line !== 'object') return;
      line.y1 = numeric(val);
    },

    set_x2(line: LineObject, val: number): void {
      if (!line || typeof line !== 'object') return;
      line.x2 = numeric(val);
    },

    set_y2(line: LineObject, val: number): void {
      if (!line || typeof line !== 'object') return;
      line.y2 = numeric(val);
    },

    set_xy1(line: LineObject, x: number, y: number): void {
      if (!line || typeof line !== 'object') return;
      line.x1 = numeric(x);
      line.y1 = numeric(y);
    },

    set_xy2(line: LineObject, x: number, y: number): void {
      if (!line || typeof line !== 'object') return;
      line.x2 = numeric(x);
      line.y2 = numeric(y);
    },

    set_first_point(line: LineObject, point: unknown): void {
      if (!line || typeof line !== 'object') return;
      const value = pointAnchor(point, line.xloc) ?? pointXY(point);
      if (!value) return;
      line.x1 = value.x;
      line.y1 = value.y;
    },

    set_second_point(line: LineObject, point: unknown): void {
      if (!line || typeof line !== 'object') return;
      const value = pointAnchor(point, line.xloc) ?? pointXY(point);
      if (!value) return;
      line.x2 = value.x;
      line.y2 = value.y;
    },

    set_xloc(line: LineObject, val: string): void {
      line.xloc = val;
    },

    set_extend(line: LineObject, val: string): void {
      line.extend = val;
    },

    set_color(line: LineObject, val: string): void {
      if (!line || typeof line !== 'object') return;
      line.color = val;
    },

    set_style(line: LineObject, val: string): void {
      if (!line || typeof line !== 'object') return;
      line.style = val;
    },

    set_width(line: LineObject, val: number): void {
      if (!line || typeof line !== 'object') return;
      line.width = numeric(val);
    },

    get_x1(line: LineObject): number {
      return line.x1;
    },

    get_y1(line: LineObject): number {
      return line.y1;
    },

    get_x2(line: LineObject): number {
      return line.x2;
    },

    get_y2(line: LineObject): number {
      return line.y2;
    },

    get_price(line: LineObject, x: number): number {
      const dx = line.x2 - line.x1;
      if (dx === 0) {
        return line.y1;
      }
      const t = (x - line.x1) / dx;
      return line.y1 + t * (line.y2 - line.y1);
    },

    copy(line: LineObject): LineObject {
      const copied: LineObject = {
        id: nextId++,
        x1: line.x1,
        y1: line.y1,
        x2: line.x2,
        y2: line.y2,
        xloc: line.xloc,
        extend: line.extend,
        color: line.color,
        style: line.style,
        width: line.width,
        _deleted: false,
      };
      lines.push(copied);
      return copied;
    },

    get all(): LineObject[] {
      return lines.filter((l) => !l._deleted);
    },
  };
}
