import type { Arrow } from '$lib/arrows';
import { parseColor, rgbaToString } from '$lib/color';
import type { LastMove } from '$lib/positions';
import { BOARD_PALETTES } from '$lib/theme/presets';
import type { BoardPaletteId, ThemeColors, ThemeName, TokenKey } from '$lib/theme/presets';
import { setColor, theme } from '$lib/theme/theme.svelte';

export type ColorRow = { key: TokenKey; label: string };

export const PRESET_ITEMS: { id: ThemeName; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'custom', label: 'Custom' },
];
export const PALETTE_IDS = Object.keys(BOARD_PALETTES) as BoardPaletteId[];

// Accent is invBg (the one emphasis fill); Secondary accent is link (links and focus rings).
export const BOARD_ROWS: ColorRow[] = [
  { key: 'boardLight', label: 'Light squares' },
  { key: 'boardDark', label: 'Dark squares' },
  { key: 'boardHl', label: 'Last-move highlight' },
];
export const ARROW_ROWS: ColorRow[] = [
  { key: 'arrowW', label: 'White engine arrow' },
  { key: 'arrowB', label: 'Black engine arrow' },
  { key: 'arrowK', label: 'Kibitzer arrow' },
];
export const PAGE_ROWS: ColorRow[] = [
  { key: 'invBg', label: 'Accent' },
  { key: 'bg', label: 'Background' },
  { key: 'surface', label: 'Surface' },
  { key: 'text', label: 'Text' },
];
export const ADV_ROWS: ColorRow[] = [
  { key: 'link', label: 'Secondary accent' },
  { key: 'graphW', label: 'Graph — white engine' },
  { key: 'graphB', label: 'Graph — black engine' },
  { key: 'graphK', label: 'Graph — kibitzer' },
  { key: 'engW', label: 'Engine accent — white' },
  { key: 'engB', label: 'Engine accent — black' },
  { key: 'engK', label: 'Engine accent — kibitzer' },
  { key: 'evalW', label: 'Eval bar — white' },
  { key: 'evalB', label: 'Eval bar — black' },
];

// Mid-game position for the preview board, so the highlight and arrows have something to mark.
export const SAMPLE_FEN = '2rr2k1/1p3ppp/1qp1pb2/p7/PnQP4/2N1PNP1/1P3PKP/2RR4 w - - 5 21';
export const SAMPLE_LAST_MOVE: LastMove = { from: 'c7', to: 'b6' };
export function sampleArrows(c: ThemeColors): Arrow[] {
  return [
    { uci: 'b2b3', color: c.arrowB, opacity: 0.9 },
    { uci: 'c4e2', color: c.arrowW, opacity: 0.9 },
    { uci: 'c3e4', color: c.arrowK, opacity: 0.85 },
  ];
}

/** `<input type="color">` only accepts #rrggbb. */
export function toInputHex(v: string): string {
  const c = parseColor(v);
  return c ? rgbaToString({ ...c, a: '' }) : '#000000';
}

function mixHex(a: string, b: string, w: number): string | null {
  const x = parseColor(a);
  const y = parseColor(b);
  if (!x || !y) return null;
  return rgbaToString({ r: x.r + (y.r - x.r) * w, g: x.g + (y.g - x.g) * w, b: x.b + (y.b - x.b) * w, a: '' });
}

/** WCAG 2 relative luminance of a hex colour (alpha ignored), or null if it is not hex. */
function luminance(hex: string): number | null {
  const c = parseColor(hex);
  if (!c) return null;
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

/** WCAG 2 contrast ratio (1–21), or null if either colour is not hex. */
function contrastRatio(a: string, b: string): number | null {
  const x = luminance(a);
  const y = luminance(b);
  if (x === null || y === null) return null;
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/**
 * setColor plus the derived tokens: hover and border shades follow the surface and text, and the ink on
 * the accent is chosen for contrast.
 */
export function editColor(key: TokenKey, value: string): void {
  setColor(key, value);
  if (key === 'invBg') {
    const { bg, text } = theme.colors;
    const cb = contrastRatio(value, bg) ?? 0;
    const ct = contrastRatio(value, text) ?? 0;
    setColor('invText', ct > cb ? text : bg);
    return;
  }
  if (key !== 'surface' && key !== 'text') return;
  const { surface, text } = theme.colors;
  const raised = mixHex(surface, text, 0.06);
  const border = mixHex(surface, text, 0.12);
  if (!raised || !border) return;
  setColor('surface2', raised);
  setColor('line2', raised);
  setColor('line', border);
}

const STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/** WAI-ARIA radio group keys: arrows wrap, Home/End jump; selection follows focus. */
export function rovingKeydown(e: KeyboardEvent, index: number, count: number, select: (i: number) => void): void {
  let next: number;
  if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = count - 1;
  else if (e.key in STEP) next = (index + STEP[e.key] + count) % count;
  else return;
  e.preventDefault();
  select(next);
  const group = (e.currentTarget as HTMLElement).closest('[role="radiogroup"]');
  group?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
}
