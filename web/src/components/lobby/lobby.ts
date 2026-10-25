import { msToString } from '$lib/format';
import type { LobbyBroadcast } from '$shared/types';

export const POLL_MS = 30_000;

/** Full-move number = FEN field 6 ("… w - - 0 12" → 12). Correct for custom start FENs; falls back to plies. */
export function moveNumber(b: LobbyBroadcast): number {
  const n = Number(b.fen.split(' ')[5]);
  return Number.isInteger(n) && n > 0 ? n : Math.floor(b.moveCount / 2) + 1;
}

/** Static clock (no ticking data in /broadcasts). 0 = no clock info yet. */
export const clock = (ms: number): string => (ms > 0 ? msToString(ms) : '--:--');

export const title = (b: LobbyBroadcast): string => b.site || `Broadcast ${b.port}`;

/** "Site — White vs Black, move N". */
export const cardLabel = (b: LobbyBroadcast): string =>
  `${b.site ? `${b.site} — ` : ''}${b.white} vs ${b.black}, move ${moveNumber(b)}`;

export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

const archiveDate = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

/** "Oct 18, 2026"; '' if unparseable. */
export function formatArchiveDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : archiveDate.format(d);
}

/** `q` is already trimmed and lower-cased. */
export const matchesQuery = (site: string, slug: string, q: string): boolean =>
  !q || site.toLowerCase().includes(q) || slug.toLowerCase().includes(q);
