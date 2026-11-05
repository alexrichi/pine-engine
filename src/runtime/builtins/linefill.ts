export interface LinefillObject {
  id: number;
  line1: unknown;
  line2: unknown;
  color: string;
  _deleted: boolean;
}

export function createLinefillModule() {
  let nextId = 0;
  const linefills: LinefillObject[] = [];

  return {
    new(line1: unknown, line2: unknown, color: string = '#2962FF'): LinefillObject {
      const linefill: LinefillObject = {
        id: nextId++,
        line1,
        line2,
        color,
        _deleted: false,
      };
      linefills.push(linefill);
      return linefill;
    },

    delete(linefill: LinefillObject | null | undefined): void {
      if (!linefill || typeof linefill !== 'object') return;
      linefill._deleted = true;
    },

    set_color(linefill: LinefillObject, color: string): void {
      linefill.color = color;
    },

    get_line1(linefill: LinefillObject): unknown {
      return linefill.line1;
    },

    get_line2(linefill: LinefillObject): unknown {
      return linefill.line2;
    },

    get all(): LinefillObject[] {
      return linefills.filter((linefill) => !linefill._deleted);
    },
  };
}
