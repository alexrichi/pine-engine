export interface LabelObject {
  id: number;
  x: number;
  y: number;
  xloc: string;
  yloc: string;
  text: string;
  tooltip: string;
  color: string;
  textcolor: string;
  style: string;
  size: string;
  textalign: string;
  text_font_family: string;
  text_formatting: string;
  _deleted: boolean;
}

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

export function createLabelModule() {
  let nextId = 0;
  const labels: LabelObject[] = [];

  return {
    new(
      x: number,
      y: number,
      text: string,
      opts?: {
        xloc?: string;
        yloc?: string;
        color?: string;
        textcolor?: string;
        style?: string;
        size?: string;
        textalign?: string;
        tooltip?: string;
        text_font_family?: string;
        text_formatting?: string;
      }
    ): LabelObject {
      const label: LabelObject = {
        id: nextId++,
        x,
        y,
        text,
        xloc: opts?.xloc ?? 'bar_index',
        yloc: opts?.yloc ?? 'price',
        color: opts?.color ?? '#2962FF',
        textcolor: opts?.textcolor ?? '#FFFFFF',
        style: opts?.style ?? 'label_down',
        size: opts?.size ?? 'normal',
        textalign: opts?.textalign ?? 'center',
        tooltip: opts?.tooltip ?? '',
        text_font_family: opts?.text_font_family ?? 'default',
        text_formatting: opts?.text_formatting ?? '',
        _deleted: false,
      };
      labels.push(label);
      return label;
    },

    delete(label: LabelObject | null | undefined): void {
      if (!label || typeof label !== 'object') return;
      label._deleted = true;
    },

    set_x(label: LabelObject, val: number): void {
      label.x = val;
    },

    set_y(label: LabelObject, val: number): void {
      label.y = val;
    },

    set_xy(label: LabelObject, x: number, y: number): void {
      label.x = x;
      label.y = y;
    },

    set_point(label: LabelObject, point: unknown): void {
      const value = pointXY(point);
      if (!value) return;
      label.x = value.x;
      label.y = value.y;
    },

    set_text_font_family(label: LabelObject, val: string): void {
      label.text_font_family = val;
    },

    set_text_formatting(label: LabelObject, val: string): void {
      label.text_formatting = val;
    },

    set_xloc(label: LabelObject, val: string): void {
      label.xloc = val;
    },

    set_yloc(label: LabelObject, val: string): void {
      label.yloc = val;
    },

    set_text(label: LabelObject, val: string): void {
      if (!label || typeof label !== 'object') return;
      label.text = val;
    },

    set_tooltip(label: LabelObject, val: string): void {
      label.tooltip = val;
    },

    set_color(label: LabelObject, val: string): void {
      label.color = val;
    },

    set_textcolor(label: LabelObject, val: string): void {
      label.textcolor = val;
    },

    set_style(label: LabelObject, val: string): void {
      label.style = val;
    },

    set_size(label: LabelObject, val: string): void {
      label.size = val;
    },

    set_textalign(label: LabelObject, val: string): void {
      label.textalign = val;
    },

    get_x(label: LabelObject): number {
      return label.x;
    },

    get_y(label: LabelObject): number {
      return label.y;
    },

    get_text(label: LabelObject): string {
      return label.text;
    },

    copy(label: LabelObject): LabelObject {
      const copied: LabelObject = {
        id: nextId++,
        x: label.x,
        y: label.y,
        text: label.text,
        xloc: label.xloc,
        yloc: label.yloc,
        color: label.color,
        textcolor: label.textcolor,
        style: label.style,
        size: label.size,
        textalign: label.textalign,
        tooltip: label.tooltip,
        text_font_family: label.text_font_family,
        text_formatting: label.text_formatting,
        _deleted: false,
      };
      labels.push(copied);
      return copied;
    },

    get all(): LabelObject[] {
      return labels.filter((l) => !l._deleted);
    },
  };
}
