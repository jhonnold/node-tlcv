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
  | '--kibitzerArrowColor';

export type ThemeColors = Record<ThemeTokenKey, string>;

export type TokenGroup = 'essential' | 'advanced';

export interface TokenMeta {
  key: ThemeTokenKey;
  label: string;
  group: TokenGroup;
}

// The curated subset of tokens exposed in the editor.
//
// Tokens omitted here are NOT user-editable, for two reasons:
//   - Derived (see DERIVED_TOKENS / deriveDependents in ./index.ts): for custom
//     themes these are auto-calculated from the essentials so hover/highlight
//     always stay coherent with the chosen accent/surface — `--primaryColorHover`,
//     `--surfaceColorHover`, `--highlightColor`.
//   - Preset-only / niche: `--cardTextColor`, `--pieceWhiteColor`,
//     `--pieceBlackColor`, `--kibitzerColor`.
export const TOKENS: TokenMeta[] = [
  { key: '--primaryColor', label: 'Accent', group: 'essential' },
  { key: '--backgroundColor', label: 'Background', group: 'essential' },
  { key: '--surfaceColor', label: 'Surface', group: 'essential' },
  { key: '--textColor', label: 'Text', group: 'essential' },
  { key: '--boardLight', label: 'Board — light squares', group: 'essential' },
  { key: '--boardDark', label: 'Board — dark squares', group: 'essential' },
  { key: '--secondaryColor', label: 'Secondary accent', group: 'advanced' },
  { key: '--graphWhiteColor', label: 'Graph — white', group: 'advanced' },
  { key: '--graphBlackColor', label: 'Graph — black', group: 'advanced' },
  { key: '--evalBarWhite', label: 'Eval bar — white', group: 'advanced' },
  { key: '--evalBarBlack', label: 'Eval bar — black', group: 'advanced' },
  { key: '--whiteArrowColor', label: 'White move arrow', group: 'advanced' },
  { key: '--blackArrowColor', label: 'Black move arrow', group: 'advanced' },
  { key: '--kibitzerArrowColor', label: 'Kibitzer arrow', group: 'advanced' },
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
  },
};

export const DEFAULT_PRESET: PresetName = 'light';
