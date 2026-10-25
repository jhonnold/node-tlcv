import { msToString } from '$lib/format';
import type { LobbyBroadcast } from '$shared/types';

export const POLL_MS = 30_000;
export const MOBILE_MAX = 767; // matches the U3 breakpoint (<768)

/** Full-move number = FEN field 6 (L:108: fen "… w - - 0 12" → "Move 12"). Correct for custom start FENs; falls back to plies. */
export function moveNumber(b: LobbyBroadcast): number {
  const n = Number(b.fen.split(' ')[5]);
  return Number.isInteger(n) && n > 0 ? n : Math.floor(b.moveCount / 2) + 1;
}

export const whiteToMove = (b: LobbyBroadcast): boolean => b.fen.split(' ')[1] !== 'b';

/** Static clock (no ticking data in /broadcasts). 0 = no clock info yet. */
export const clock = (ms: number): string => (ms > 0 ? msToString(ms) : '--:--');

export const title = (b: LobbyBroadcast): string => b.site || `Broadcast ${b.port}`;

/** broadcasts.ejs cardLabel + design: "Site — White vs Black, move N". */
export const cardLabel = (b: LobbyBroadcast): string =>
  `${b.site ? `${b.site} — ` : ''}${b.white} vs ${b.black}, move ${moveNumber(b)}`;

export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/** broadcasts.ejs formatArchiveDate: "Oct 18, 2026"; '' if unparseable. */
export function formatArchiveDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function matchesQuery(site: string, slug: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  return !q || site.toLowerCase().includes(q) || slug.toLowerCase().includes(q);
}
