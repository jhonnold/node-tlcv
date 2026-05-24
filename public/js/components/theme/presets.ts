// Theme presets and the canonical color-token model.
//
// Colors are applied at runtime by setting these CSS custom properties on
// `document.documentElement` (see ./index.ts). `_variables.scss` still holds the
// light values as the pre-JS fallback, so the two must stay in sync.

export type PresetName = 'light' | 'dark';
export type ThemeName = PresetName | 'custom';

export type ThemeTokenKey =
  | '--primaryColor'
  | '--primaryColorHover'
  | '--secondaryColor'
  | '--backgroundColor'
  | '--surfaceColor'
  | '--surfaceColorHover'
  | '--boardDark'
  | '--boardLight'
  | '--textColor'
  | '--cardTextColor'
  | '--pieceWhiteColor'
  | '--pieceBlackColor'
  | '--highlightColor'
  | '--kibitzerColor'
  | '--graphWhiteColor'
  | '--graphBlackColor'
  | '--evalBarWhite'
  | '--evalBarBlack'
  | '--whiteArrowColor'
  | '--blackArrowColor'
  | '--kibitzerArrowColor'
  // Non-color theme variable: chat/PV text weight (dark themes read lighter).
  | '--chatFontWeight';

export type ThemeColors = Record<ThemeTokenKey, string>;

// Tokens are organized along two orthogonal dimensions: which part of the UI
// they theme (`section`) and how prominent they are in the editor (`tier`). The
// editor renders one block per section with the advanced tier behind a collapse.
export type TokenSection = 'page' | 'board';
export type TokenTier = 'essential' | 'advanced';

export interface TokenMeta {
  key: ThemeTokenKey;
  label: string;
  section: TokenSection;
  tier: TokenTier;
}

// The curated subset of tokens exposed in the editor, grouped by section so the
// chess board's colors are fully separate from the rest of the page.
//
// Tokens omitted here are NOT user-editable, for two reasons:
//   - Derived (see deriveDependents in ./index.ts): for custom themes these are
//     auto-calculated from the page essentials so hover states always stay
//     coherent with the chosen accent/surface — `--primaryColorHover`,
//     `--surfaceColorHover`.
//   - Preset-only / niche: `--cardTextColor`, `--pieceWhiteColor`,
//     `--pieceBlackColor`, `--kibitzerColor`.
export const TOKENS: TokenMeta[] = [
  // Page
  { key: '--primaryColor', label: 'Accent', section: 'page', tier: 'essential' },
  { key: '--backgroundColor', label: 'Background', section: 'page', tier: 'essential' },
  { key: '--surfaceColor', label: 'Surface', section: 'page', tier: 'essential' },
  { key: '--textColor', label: 'Text', section: 'page', tier: 'essential' },
  { key: '--secondaryColor', label: 'Secondary accent', section: 'page', tier: 'advanced' },
  { key: '--graphWhiteColor', label: 'Graph — white', section: 'page', tier: 'advanced' },
  { key: '--graphBlackColor', label: 'Graph — black', section: 'page', tier: 'advanced' },
  { key: '--evalBarWhite', label: 'Eval bar — white', section: 'page', tier: 'advanced' },
  { key: '--evalBarBlack', label: 'Eval bar — black', section: 'page', tier: 'advanced' },
  // Board
  { key: '--boardLight', label: 'Light squares', section: 'board', tier: 'essential' },
  { key: '--boardDark', label: 'Dark squares', section: 'board', tier: 'essential' },
  { key: '--highlightColor', label: 'Last-move highlight', section: 'board', tier: 'essential' },
  { key: '--whiteArrowColor', label: 'White move arrow', section: 'board', tier: 'advanced' },
  { key: '--blackArrowColor', label: 'Black move arrow', section: 'board', tier: 'advanced' },
  { key: '--kibitzerArrowColor', label: 'Kibitzer arrow', section: 'board', tier: 'advanced' },
];

export const PRESETS: Record<PresetName, ThemeColors> = {
  light: {
    '--primaryColor': '#4b7399',
    '--primaryColorHover': '#003eaa',
    '--secondaryColor': '#003eaa',
    '--backgroundColor': '#e1e2ea',
    '--surfaceColor': '#ffffff8c',
    '--surfaceColorHover': '#cecece3d',
    '--boardDark': '#4b7399',
    '--boardLight': '#ffffff',
    '--textColor': '#342f3a',
    '--cardTextColor': '#342f3a',
    '--pieceWhiteColor': '#ffffff',
    '--pieceBlackColor': '#222222',
    '--highlightColor': '#52b1dc6b',
    '--kibitzerColor': 'var(--textColor)',
    '--graphWhiteColor': '#b0b0b0',
    '--graphBlackColor': '#342f3a',
    '--evalBarWhite': '#eeeeee',
    '--evalBarBlack': '#333333',
    '--whiteArrowColor': '#ddddddDD',
    '--blackArrowColor': '#222222DD',
    '--kibitzerArrowColor': '#114f8aDD',
    '--chatFontWeight': '500',
  },
  dark: {
    '--primaryColor': '#9fc0a2',
    '--primaryColorHover': '#68c07b',
    '--secondaryColor': '#f5c276',
    '--backgroundColor': '#272a2c',
    '--surfaceColor': '#333538',
    '--surfaceColorHover': '#404246',
    '--boardDark': '#71828f',
    '--boardLight': '#c7c7c7',
    '--textColor': '#aaaaaa',
    '--cardTextColor': '#f2f5f3',
    '--pieceWhiteColor': '#ffffff',
    '--pieceBlackColor': '#777777',
    '--highlightColor': '#99d69e66',
    '--kibitzerColor': 'var(--textColor)',
    '--graphWhiteColor': '#cecece',
    '--graphBlackColor': '#888888',
    '--evalBarWhite': '#cccccc',
    '--evalBarBlack': '#111111',
    '--whiteArrowColor': '#ddddddDD',
    '--blackArrowColor': '#222222DD',
    '--kibitzerArrowColor': '#68c07bDD',
    '--chatFontWeight': '300',
  },
};

export const DEFAULT_PRESET: PresetName = 'light';
