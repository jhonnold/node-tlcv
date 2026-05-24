// Theme component: applies a color palette by setting CSS custom properties on
// the document root, persists the choice, and drives the theme editor modal.
import $ from 'jquery';
import { emit } from '../../events/index';
import { PRESETS, TOKENS, DEFAULT_PRESET } from './presets';
import type { ThemeColors, ThemeName, PresetName, ThemeTokenKey } from './presets';
import { PIECE_SETS, DEFAULT_PIECE_SET, isPieceSetId } from './piece-sets';
import type { PieceSetId } from './piece-sets';

const THEME_KEY = 'theme';
const CUSTOM_KEY = 'tlcv.customTheme';
const BASE_KEY = 'tlcv.themeBase';
const PIECE_SET_KEY = 'tlcv.pieceSet';

let currentTheme: ThemeName = DEFAULT_PRESET;
let basePreset: PresetName = DEFAULT_PRESET;
let currentColors: ThemeColors = { ...PRESETS[DEFAULT_PRESET] };
let currentPieceSet: PieceSetId = DEFAULT_PIECE_SET;

const isPreset = (value: string | null): value is PresetName => value === 'light' || value === 'dark';
const isThemeName = (value: string | null): value is ThemeName => isPreset(value) || value === 'custom';

// ---- hex helpers -----------------------------------------------------------
// `<input type="color">` only understands `#rrggbb`. Normalize any token value
// for display, and preserve a token's existing alpha when writing a new RGB.

function toInputHex(value: string): string {
  const v = value.trim();
  if (/^#[0-9a-fA-F]{3,4}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  if (/^#[0-9a-fA-F]{8}$/.test(v)) return v.slice(0, 7).toLowerCase();
  return '#000000';
}

function alphaSuffix(value: string): string {
  const v = value.trim();
  if (/^#[0-9a-fA-F]{8}$/.test(v)) return v.slice(7).toLowerCase();
  if (/^#[0-9a-fA-F]{4}$/.test(v)) return `${v[4]}${v[4]}`.toLowerCase();
  return '';
}

// ---- derived colors --------------------------------------------------------
// Hover colors are auto-calculated from the page essentials so a custom palette
// stays coherent without the user hand-tuning them. Board colors (including the
// move highlight) are independent and never derived.

interface RGBA {
  r: number;
  g: number;
  b: number;
  a: string; // 2-digit hex alpha suffix, or '' for opaque
}

function parseColor(value: string): RGBA | null {
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

const toHex2 = (n: number): string =>
  Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, '0');

const rgbaToString = ({ r, g, b, a }: RGBA): string => `#${toHex2(r)}${toHex2(g)}${toHex2(b)}${a}`;

const luminance = ({ r, g, b }: RGBA): number => (0.299 * r + 0.587 * g + 0.114 * b) / 255;

// Shift a color toward white (on a dark background) or black (on a light one) so
// hover states gain contrast against the page in either direction.
function shadeForContrast(color: RGBA, bg: RGBA, amount = 0.2): RGBA {
  const target = luminance(bg) < 0.5 ? 255 : 0;
  return {
    r: color.r + (target - color.r) * amount,
    g: color.g + (target - color.g) * amount,
    b: color.b + (target - color.b) * amount,
    a: color.a,
  };
}

// Returns a new map with the page hover tokens recomputed from the essentials.
function deriveDependents(colors: ThemeColors): ThemeColors {
  const bg = parseColor(colors['--backgroundColor']);
  const primary = parseColor(colors['--primaryColor']);
  const surface = parseColor(colors['--surfaceColor']);
  const next = { ...colors };
  if (primary && bg) next['--primaryColorHover'] = rgbaToString(shadeForContrast(primary, bg));
  if (surface && bg) {
    // Surface-hover doubles as borders/row-hover. Don't inherit the surface's
    // own alpha (which is high on light themes and would make hovers heavy);
    // instead use a subtle wash on light backgrounds and a solid lift on dark.
    const hover = shadeForContrast(surface, bg);
    hover.a = luminance(bg) < 0.5 ? '' : '40';
    next['--surfaceColorHover'] = rgbaToString(hover);
  }
  return next;
}

// ---- persistence -----------------------------------------------------------

function loadCustomColors(base: PresetName): ThemeColors {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (raw) return { ...PRESETS[base], ...(JSON.parse(raw) as Partial<ThemeColors>) };
  } catch {
    // fall through to base preset on malformed JSON
  }
  return { ...PRESETS[base] };
}

function resolveColors(theme: ThemeName): ThemeColors {
  // Presets keep their hand-authored hover values; custom palettes derive them
  // from the page essentials so they always stay coherent.
  return theme === 'custom' ? deriveDependents(loadCustomColors(basePreset)) : { ...PRESETS[theme] };
}

function persist() {
  localStorage.setItem(THEME_KEY, currentTheme);
  localStorage.setItem(BASE_KEY, basePreset);
  // Clear the saved palette when on a preset so re-selecting "Custom" starts
  // from the current preset rather than resurrecting a discarded palette.
  if (currentTheme === 'custom') localStorage.setItem(CUSTOM_KEY, JSON.stringify(currentColors));
  else localStorage.removeItem(CUSTOM_KEY);
}

function getPreferredTheme(): ThemeName {
  const stored = localStorage.getItem(THEME_KEY);
  if (isThemeName(stored)) return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// ---- application -----------------------------------------------------------

function applyColors(colors: ThemeColors) {
  const root = document.documentElement;
  (Object.keys(colors) as ThemeTokenKey[]).forEach((key) => root.style.setProperty(key, colors[key]));
}

const emitChange = () => emit('theme:change', { theme: currentTheme });

let debounceHandle: ReturnType<typeof setTimeout> | undefined;
function emitChangeDebounced() {
  if (debounceHandle) clearTimeout(debounceHandle);
  debounceHandle = setTimeout(emitChange, 150);
}

/** Switch to a preset or to the saved custom palette. */
export function setTheme(theme: ThemeName) {
  currentTheme = theme;
  if (isPreset(theme)) basePreset = theme;
  currentColors = resolveColors(theme);
  applyColors(currentColors);
  persist();
  syncControls();
  emitChange();
}

/** Edit a single token; this always puts the theme into "custom" mode. */
function setColor(token: ThemeTokenKey, inputHex: string) {
  if (currentTheme !== 'custom') {
    // Seed the custom palette from whatever is currently showing.
    currentColors = { ...currentColors };
    currentTheme = 'custom';
  }
  currentColors[token] = inputHex + alphaSuffix(currentColors[token]);
  // Recompute page hover states from the (possibly just-changed) essentials.
  currentColors = deriveDependents(currentColors);
  applyColors(currentColors);
  persist();
  syncControls();
  emitChangeDebounced();
}

export function getTheme(): ThemeName {
  return currentTheme;
}

// ---- piece set -------------------------------------------------------------
// Independent of the color palette above: its own key/event, and it never
// touches applyColors/persist.

function loadPieceSet(): PieceSetId {
  const stored = localStorage.getItem(PIECE_SET_KEY);
  return isPieceSetId(stored) ? stored : DEFAULT_PIECE_SET;
}

export function getPieceSet(): PieceSetId {
  return currentPieceSet;
}

/** Switch the active piece set; boards react via the `pieces:change` event. */
function setPieceSet(id: PieceSetId) {
  currentPieceSet = id;
  localStorage.setItem(PIECE_SET_KEY, id);
  $('#theme-piece-set').val(id);
  emit('pieces:change', { set: id });
}

// ---- editor UI -------------------------------------------------------------

function buildRows() {
  // One container per (section, tier); ids match the markup in theme-modal.ejs.
  const containers = new Map<string, JQuery<HTMLElement>>();
  let anyFound = false;
  TOKENS.forEach(({ section, tier }) => {
    const id = `${section}-${tier}`;
    if (containers.has(id)) return;
    const el = $(`#theme-${id}`);
    if (el.length) anyFound = true;
    containers.set(id, el.empty());
  });
  if (!anyFound) return;

  TOKENS.forEach(({ key, label, section, tier }) => {
    const inputId = `theme-input-${key}`;
    const row = $(`
      <div class="theme-row">
        <label class="theme-row-label" for="${inputId}">${label}</label>
        <span class="theme-hex" data-hex="${key}"></span>
        <input type="color" id="${inputId}" class="theme-color-input" data-token="${key}" />
      </div>
    `);
    containers.get(`${section}-${tier}`)?.append(row);
  });

  $('.theme-color-input').on('input', function () {
    const token = $(this).data('token') as ThemeTokenKey;
    setColor(token, String($(this).val()));
  });
}

/** Push current state into the modal controls (inputs, hex labels, radios). */
function syncControls() {
  TOKENS.forEach(({ key }) => {
    const value = currentColors[key];
    $(`#theme-input-${key}`).val(toInputHex(value));
    $(`[data-hex="${key}"]`).text(value);
  });
  $(`input[name="theme-preset"][value="${currentTheme}"]`).prop('checked', true);
}

function openModal() {
  $('#theme-modal-overlay').removeClass('hidden').attr('aria-hidden', 'false');
}

function closeModal() {
  const overlay = $('#theme-modal-overlay');
  if (overlay.hasClass('hidden')) return; // already closed — don't steal focus
  // Return focus to the trigger before hiding so we never set aria-hidden on an
  // ancestor of the focused element.
  $('#theme-toggle').trigger('focus');
  overlay.addClass('hidden').attr('aria-hidden', 'true');
}

export function init() {
  currentTheme = getPreferredTheme();
  const storedBase = localStorage.getItem(BASE_KEY);
  basePreset = isPreset(storedBase) ? storedBase : isPreset(currentTheme) ? currentTheme : DEFAULT_PRESET;
  currentColors = resolveColors(currentTheme);
  applyColors(currentColors);

  // Piece set: load and reflect in the dropdown. Boards read getPieceSet() when
  // they build their pieceTheme, so no emit is needed (or wanted) here.
  currentPieceSet = loadPieceSet();
  const pieceSelect = $('#theme-piece-set');
  pieceSelect.empty();
  PIECE_SETS.forEach(({ id, label }) => pieceSelect.append(`<option value="${id}">${label}</option>`));
  pieceSelect.val(currentPieceSet);
  pieceSelect.on('change', function () {
    const value = $(this).val();
    if (isPieceSetId(String(value))) setPieceSet(String(value) as PieceSetId);
  });

  buildRows();
  syncControls();

  $('#theme-toggle').on('click', openModal);
  $('#theme-modal-close').on('click', closeModal);
  $('#theme-modal-overlay').on('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  $(document).on('keydown.theme', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  $('input[name="theme-preset"]').on('change', function () {
    const value = $(this).val();
    if (isThemeName(String(value))) setTheme(String(value) as ThemeName);
  });

  $('#theme-reset').on('click', () => setTheme(basePreset));
}

export function destroy() {
  if (debounceHandle) clearTimeout(debounceHandle);
  $('#theme-toggle').off('click');
  $('#theme-modal-close').off('click');
  $('#theme-modal-overlay').off('click');
  $('#theme-reset').off('click');
  $('.theme-color-input').off('input');
  $('input[name="theme-preset"]').off('change');
  $('#theme-piece-set').off('change');
  $(document).off('keydown.theme');
}
