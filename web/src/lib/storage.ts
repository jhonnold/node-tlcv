export const KEYS = {
  theme: 'theme',
  themeBase: 'tlcv.themeBase',
  customTheme: 'tlcv.customTheme',
  pieceSet: 'tlcv.pieceSet',
  boardPalette: 'tlcv.boardPalette',
  sound: 'soundEnabled',
  username: 'tlcv.net-username',
  boardWidth: 'board-width',
} as const;

// None of these throw: storage can be disabled (private mode, blocked cookies) or full.

export function readString(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // storage disabled
    return null;
  }
}

export function writeString(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage disabled or full
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // storage disabled
  }
}

export function readBool(key: string, fallback = false): boolean {
  const v = readString(key);
  return v === null ? fallback : v === 'true';
}

export function writeBool(key: string, v: boolean): void {
  writeString(key, String(v));
}

export function readNumber(key: string): number | null {
  const v = readString(key);
  if (v === null) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export function writeNumber(key: string, n: number): void {
  writeString(key, String(n));
}
