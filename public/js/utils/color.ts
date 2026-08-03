// Hex color parsing/serialization shared by the theme editor (which derives hover
// states) and the board (which blends overlapping arrow colors). Handles the four
// hex forms CSS custom properties can legitimately hold: #rgb, #rgba, #rrggbb,
// #rrggbbaa.

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: string; // 2-digit hex alpha suffix, or '' for opaque
}

export function parseColor(value: string): RGBA | null {
  const v = value.trim();
  if (/^#[0-9a-fA-F]{3,4}$/.test(v)) {
    return {
      r: parseInt(v[1] + v[1], 16),
      g: parseInt(v[2] + v[2], 16),
      b: parseInt(v[3] + v[3], 16),
      a: v.length === 5 ? `${v[4]}${v[4]}`.toLowerCase() : '',
    };
  }
  if (/^#[0-9a-fA-F]{6,8}$/.test(v)) {
    return {
      r: parseInt(v.slice(1, 3), 16),
      g: parseInt(v.slice(3, 5), 16),
      b: parseInt(v.slice(5, 7), 16),
      a: v.length === 9 ? v.slice(7, 9).toLowerCase() : '',
    };
  }
  return null; // non-hex (e.g. var(...)) — not derivable
}

export const toHex2 = (n: number): string =>
  Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, '0');

export const rgbaToString = ({ r, g, b, a }: RGBA): string => `#${toHex2(r)}${toHex2(g)}${toHex2(b)}${a}`;

export const luminance = ({ r, g, b }: RGBA): number => (0.299 * r + 0.587 * g + 0.114 * b) / 255;

/** Component-wise average of the given colors, alpha included. Unparseable entries are ignored. */
export function blendColors(colors: string[]): string {
  const parsed = colors.map(parseColor).filter((c): c is RGBA => c !== null);
  if (!parsed.length) return colors[0] ?? '#000000';

  const n = parsed.length;
  const avg = (pick: (c: RGBA) => number) => parsed.reduce((sum, c) => sum + pick(c), 0) / n;

  return rgbaToString({
    r: avg((c) => c.r),
    g: avg((c) => c.g),
    b: avg((c) => c.b),
    a: toHex2(avg((c) => (c.a === '' ? 255 : parseInt(c.a, 16)))),
  });
}
