export type PresetName = 'dark' | 'light';
export type ThemeName = PresetName | 'custom';

export const TOKEN_KEYS = [
  'bg',
  'surface',
  'surface2',
  'line',
  'line2',
  'text',
  'muted',
  'faint',
  'invBg',
  'invText',
  'liveBg',
  'liveText',
  'engW',
  'engB',
  'engK',
  'graphW',
  'graphB',
  'graphK',
  'evalW',
  'evalB',
  'link',
  'sel',
  'tabSel',
  'posBg',
  'hostBg',
  'win',
  'win2',
  'loss',
  'loss2',
  'even',
  'boardLight',
  'boardDark',
  'boardHl',
  'arrowW',
  'arrowB',
  'arrowK',
] as const;
export type TokenKey = (typeof TOKEN_KEYS)[number];
export type ThemeColors = Record<TokenKey, string>;
export type BoardTokenKey = 'boardLight' | 'boardDark' | 'boardHl';
export type BoardColors = Pick<ThemeColors, BoardTokenKey>;
export type PresetColors = Omit<ThemeColors, BoardTokenKey>;
export type BoardPaletteId = 'nord' | 'steel' | 'walnut' | 'green';

// Keep in sync with the dark :root block in styles/tokens.css.
export const PRESETS: Record<PresetName, PresetColors> = {
  dark: {
    bg: '#2e3440',
    surface: '#3b4252',
    surface2: '#434c5e',
    line: '#4c566a',
    line2: '#434c5e',
    text: '#eceff4',
    muted: '#b4bccb',
    faint: '#aab3c4',
    invBg: '#88c0d0',
    invText: '#2e3440',
    liveBg: '#bf616a',
    liveText: '#e5a3a9',
    engW: '#ebcb8b',
    engB: '#88c0d0',
    engK: '#c8a9c2',
    graphW: '#eceff4',
    graphB: '#161a21',
    graphK: '#88c0d0',
    evalW: '#eceff4',
    evalB: '#4c566a',
    link: '#88c0d0',
    sel: '#4c566a',
    tabSel: '#4c566a',
    posBg: 'rgba(136, 192, 208, 0.14)',
    hostBg: 'rgba(235, 203, 139, 0.1)',
    win: '#a3be8c',
    win2: '#7f9871',
    loss: '#bf616a',
    loss2: '#8f4f57',
    even: '#616e88',
    arrowW: '#eceff4',
    arrowB: '#2e3440',
    arrowK: '#88c0d0',
  },
  light: {
    bg: '#F3F4F6',
    surface: '#FFFFFF',
    surface2: '#EEF0F3',
    line: '#DDE1E7',
    line2: '#EEF0F3',
    text: '#14171D',
    muted: '#566070',
    faint: '#5F6878',
    invBg: '#14171D',
    invText: '#FFFFFF',
    liveBg: '#B42318',
    liveText: '#B42318',
    engW: '#A86400',
    engB: '#1F66D1',
    engK: '#7A3FE0',
    graphW: '#A8B0BD',
    graphB: '#2E3440',
    graphK: '#1F66D1',
    evalW: '#FFFFFF',
    evalB: '#3A404B',
    link: '#1F66D1',
    sel: '#E1E8F3',
    tabSel: '#EBEEF2',
    posBg: 'rgba(31,102,209,0.07)',
    hostBg: 'rgba(168,100,0,0.08)',
    win: '#5C9A60',
    win2: '#2E7D32',
    loss: '#D9534F',
    loss2: '#8E1B13',
    even: '#98A1AE',
    arrowW: '#A8B0BD',
    arrowB: '#2E3440',
    arrowK: '#1F66D1',
  },
};

export const BOARD_PALETTES: Record<BoardPaletteId, { label: string; colors: BoardColors }> = {
  nord: { label: 'Nord', colors: { boardLight: '#D8DEE9', boardDark: '#81A1C1', boardHl: '#EBCB8B' } },
  steel: { label: 'Steel', colors: { boardLight: '#DEE3EA', boardDark: '#8798AE', boardHl: '#E8C766' } },
  walnut: { label: 'Walnut', colors: { boardLight: '#F0D9B5', boardDark: '#B58863', boardHl: '#E8C24A' } },
  green: { label: 'Green', colors: { boardLight: '#EEEED2', boardDark: '#769656', boardHl: '#E9D64A' } },
};

export const DEFAULT_PALETTE: BoardPaletteId = 'nord';

export function isPresetName(v: string | null): v is PresetName {
  return v === 'dark' || v === 'light';
}

export function isTokenKey(v: string): v is TokenKey {
  return (TOKEN_KEYS as readonly string[]).includes(v);
}

export function isBoardPaletteId(v: string | null): v is BoardPaletteId {
  return v !== null && Object.hasOwn(BOARD_PALETTES, v);
}

export function resolveColors(base: PresetName, palette: BoardPaletteId, overrides: Partial<ThemeColors>): ThemeColors {
  return { ...PRESETS[base], ...BOARD_PALETTES[palette].colors, ...overrides };
}
