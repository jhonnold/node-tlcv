import { KEYS, readString, writeString, removeKey } from '$lib/storage';
import { DEFAULT_PALETTE, TOKEN_KEYS, isBoardPaletteId, isPresetName, isTokenKey, resolveColors } from './presets';
import type { BoardPaletteId, PresetName, ThemeColors, ThemeName, TokenKey } from './presets';
import { DEFAULT_PIECE_SET, isPieceSetId } from './piece-sets';
import type { PieceSetId } from './piece-sets';

class ThemeState {
  name = $state<ThemeName>('dark');
  base = $state<PresetName>('dark');
  palette = $state<BoardPaletteId>(DEFAULT_PALETTE);
  pieceSet = $state<PieceSetId>(DEFAULT_PIECE_SET);
  overrides = $state<Partial<ThemeColors>>({});
  colors = $derived(resolveColors(this.base, this.palette, this.overrides));
}
export const theme = new ThemeState();

// ---- private helpers --------------------------------------------------------

const prefersPreset = (): PresetName => (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

function isOverrides(v: unknown): v is Partial<ThemeColors> {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    Object.entries(v).every(([k, val]) => isTokenKey(k) && typeof val === 'string')
  );
}

// Old custom themes (e.g. `--primaryColor` keys) are dropped here, along with their base.
function loadOverrides(): Partial<ThemeColors> | null {
  const raw = readString(KEYS.customTheme);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isOverrides(parsed)) return parsed;
  } catch {
    // malformed JSON: dropped below
  }
  removeKey(KEYS.customTheme);
  removeKey(KEYS.themeBase);
  return null;
}

function applyColors() {
  const root = document.documentElement;
  const colors = theme.colors;
  for (const k of TOKEN_KEYS) root.style.setProperty(`--${k}`, colors[k]);
  root.style.colorScheme = theme.base;
}

function persist() {
  writeString(KEYS.theme, theme.name);
  writeString(KEYS.themeBase, theme.base);
  if (theme.name === 'custom') writeString(KEYS.customTheme, JSON.stringify($state.snapshot(theme.overrides)));
  else removeKey(KEYS.customTheme);
}

// Colour pickers fire continuously while dragging: apply immediately, but persist on a trailing timer.
let settleHandle: ReturnType<typeof setTimeout> | undefined;

function cancelSettle() {
  if (settleHandle !== undefined) clearTimeout(settleHandle);
  settleHandle = undefined;
}

function persistSoon() {
  cancelSettle();
  settleHandle = setTimeout(persist, 150);
}

// ---- exported API -----------------------------------------------------------

export function initTheme() {
  // Load first: loadOverrides() may clear themeBase.
  const overrides = loadOverrides();
  const stored = readString(KEYS.theme);
  const storedBase = readString(KEYS.themeBase);

  if (isPresetName(stored)) {
    theme.name = stored;
    theme.base = stored;
  } else if (stored === 'custom' && overrides) {
    theme.name = 'custom';
    theme.base = isPresetName(storedBase) ? storedBase : prefersPreset();
  } else {
    const preset = prefersPreset();
    theme.name = preset;
    theme.base = preset;
  }

  theme.overrides = theme.name === 'custom' && overrides ? overrides : {};

  const palette = readString(KEYS.boardPalette);
  theme.palette = isBoardPaletteId(palette) ? palette : DEFAULT_PALETTE;
  const pieceSet = readString(KEYS.pieceSet);
  theme.pieceSet = isPieceSetId(pieceSet) ? pieceSet : DEFAULT_PIECE_SET;

  // Not persisted: the default keeps following the OS until the user chooses.
  applyColors();
}

export function setPreset(name: ThemeName) {
  if (name === 'custom' && theme.name === 'custom') return;
  cancelSettle();
  if (name === 'custom') {
    theme.overrides = loadOverrides() ?? {};
  } else {
    theme.base = name;
    theme.overrides = {};
  }
  theme.name = name;
  applyColors();
  persist();
}

export function setColor(key: TokenKey, value: string) {
  theme.name = 'custom';
  theme.overrides[key] = value;
  applyColors();
  persistSoon();
}

export function resetToPreset() {
  setPreset(theme.base);
}

export function setBoardPalette(id: BoardPaletteId) {
  theme.palette = id;
  delete theme.overrides.boardLight;
  delete theme.overrides.boardDark;
  delete theme.overrides.boardHl;
  writeString(KEYS.boardPalette, id);
  applyColors();
  if (theme.name === 'custom') persist();
}

export function setPieceSet(id: PieceSetId) {
  theme.pieceSet = id;
  writeString(KEYS.pieceSet, id);
}
