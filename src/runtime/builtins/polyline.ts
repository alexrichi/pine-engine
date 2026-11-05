export interface PolylineObject {
  id: number;
  points: unknown[];
  curved: boolean;
  closed: boolean;
  xloc: string;
  line_color: string;
  fill_color: string;
  line_style: string;
  line_width: number;
  _deleted: boolean;
}

export function createPolylineModule() {
  let nextId = 0;
  const polylines: PolylineObject[] = [];

  return {
    new(
      points: unknown[] = [],
      curved: boolean = false,
      closed: boolean = false,
      xloc: string = 'bar_index',
      line_color: string = '#2962FF',
      fill_color: string = '#2962FF33',
      line_style: string = 'solid',
      line_width: number = 1,
    ): PolylineObject {
      const polyline: PolylineObject = {
        id: nextId++,
        points: Array.isArray(points) ? points : [],
        curved,
        closed,
        xloc,
        line_color,
        fill_color,
        line_style,
        line_width,
        _deleted: false,
      };
      polylines.push(polyline);
      return polyline;
    },

    delete(polyline: PolylineObject | null | undefined): void {
      if (!polyline || typeof polyline !== 'object') return;
      polyline._deleted = true;
    },

    get all(): PolylineObject[] {
      return polylines.filter((polyline) => !polyline._deleted);
    },
  };
}
