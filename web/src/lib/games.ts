import type { GameRecord } from '$shared/types';

// Ported from public/js/components/games/index.ts:17-47.
function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Fuzzy match: case-insensitive, tolerant of gaps/typos (subsequence) and of
// out-of-order query characters (all query chars present in the name). `q` is
// already normalized — it is loop-invariant across the whole games list.
export function fuzzyMatches(q: string, name: string): boolean {
  const n = normalizeForMatch(name);
  if (!q) return true;
  if (n.length < q.length) return false;

  let qi = 0;
  for (let ni = 0; ni < n.length && qi < q.length; ni++) {
    if (n.charCodeAt(ni) === q.charCodeAt(qi)) qi++;
  }
  if (qi === q.length) return true;

  const remaining = new Map<string, number>();
  for (const c of n) remaining.set(c, (remaining.get(c) ?? 0) + 1);
  for (const c of q) {
    const left = (remaining.get(c) ?? 0) - 1;
    if (left < 0) return false;
    remaining.set(c, left);
  }
  return true;
}

export const isDecisive = (result: string): boolean => result === '1-0' || result === '0-1';

export type GameRow = {
  key: string;
  num: number | null;
  white: string;
  black: string;
  result: string;
  live: boolean;
  metaUrl?: string;
  pgnUrl?: string;
};
/** filteredGames (games/index.ts:49-58) plus the live row on top. Records are newest-first (result-parser.ts:177-185). */
export function gameRows(
  games: GameRecord[] | null,
  live: { number: number | null; white: string; black: string } | null,
  query: string,
  decisiveOnly: boolean,
): GameRow[] {
  const q = normalizeForMatch(query);
  const keep = (w: string, b: string, r: string) =>
    (!q || fuzzyMatches(q, w) || fuzzyMatches(q, b)) && (!decisiveOnly || isDecisive(r));
  const rows: GameRow[] = [];
  if (live && keep(live.white, live.black, '*'))
    rows.push({ key: 'live', num: live.number, white: live.white, black: live.black, result: '*', live: true });
  for (const g of games ?? []) {
    if (live && g.result === '*') continue; // the CT may list the game in progress
    if (keep(g.white, g.black, g.result))
      rows.push({
        key: `g${g.gameNumber}`,
        num: g.gameNumber,
        white: g.white,
        black: g.black,
        result: g.result,
        live: false,
        metaUrl: g.metaUrl,
        pgnUrl: g.pgnUrl,
      });
  }
  return rows;
}
