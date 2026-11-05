export const colorConstants: Record<string, string> = {
  red: '#FF5252',
  green: '#4CAF50',
  blue: '#2962FF',
  orange: '#FF9800',
  purple: '#9C27B0',
  yellow: '#FFEB3B',
  white: '#FFFFFF',
  black: '#000000',
  gray: '#787B86',
  silver: '#B2B5BE',
  maroon: '#880E4F',
  olive: '#808000',
  lime: '#00E676',
  teal: '#00897B',
  navy: '#311B92',
  fuchsia: '#E040FB',
  aqua: '#00BCD4',
};

export function colorNew(baseColor: string, transparency: number): string {
  const alpha = Math.max(0, Math.min(100, transparency));
  const alphaHex = Math.round((1 - alpha / 100) * 255).toString(16).padStart(2, '0');
  const hex = colorConstants[baseColor] ?? baseColor;
  return hex + alphaHex;
}

export function rgb(r: number, g: number, b: number, transparency: number = 0): string {
  const alpha = Math.max(0, Math.min(1, 1 - transparency / 100));
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${alpha})`;
}

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

function parseRgba(value: string): Rgba | null {
  const text = colorConstants[value] ?? value;
  if (/^#[0-9a-f]{6}$/i.test(text)) {
    return {
      r: parseInt(text.slice(1, 3), 16),
      g: parseInt(text.slice(3, 5), 16),
      b: parseInt(text.slice(5, 7), 16),
      a: 255,
    };
  }
  if (/^#[0-9a-f]{8}$/i.test(text)) {
    return {
      r: parseInt(text.slice(1, 3), 16),
      g: parseInt(text.slice(3, 5), 16),
      b: parseInt(text.slice(5, 7), 16),
      a: parseInt(text.slice(7, 9), 16),
    };
  }
  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(text);
  if (!rgba) return null;
  return {
    r: Number(rgba[1]),
    g: Number(rgba[2]),
    b: Number(rgba[3]),
    a: rgba[4] === undefined ? 255 : Math.round(Number(rgba[4]) * 255),
  };
}

/** Pine `color.from_gradient(value, bottom, top, bottom_color, top_color)`. */
export function colorFromGradient(
  value: number,
  bottom: number,
  top: number,
  bottomColor: string,
  topColor: string,
): string {
  const from = parseRgba(bottomColor);
  const to = parseRgba(topColor);
  if (!from || !to) return bottomColor;
  const ratio = top === bottom ? 0 : Math.max(0, Math.min(1, (value - bottom) / (top - bottom)));
  if (!Number.isFinite(ratio)) return bottomColor;
  const mix = (a: number, b: number) => Math.round(a + (b - a) * ratio);
  const hex = (channel: number) => channel.toString(16).padStart(2, '0').toUpperCase();
  return `#${hex(mix(from.r, to.r))}${hex(mix(from.g, to.g))}${hex(mix(from.b, to.b))}${hex(mix(from.a, to.a))}`;
}

export const color = new Proxy(
  {
    ...colorConstants,
    new: colorNew,
    colorNew,
    rgb,
    fromGradient: colorFromGradient,
    from_gradient: colorFromGradient,
  } as Record<string, unknown>,
  {
    get(target, prop: string) {
      return target[prop];
    },
  }
);
