import type { H2HCell, ParsedResults } from '$shared/types';

/** CT names: "ZANGDAR 7.0 64-BIT". Live and record names: "Zangdar 7". Strip the suffixes (src/services/result-parser.ts:133-138) a leading "v" on versions and trailing ".0"s, case-insensitively. */
export function engineKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\d+cpu\b/g, '')
    .replace(/\s*(64|32)-bit\b/g, '')
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/^v(?=\d)/, '').replace(/(\.0+)+$/, '')) // "v2.0" → "2"
    .join(' ');
}
export const sameEngine = (a: string, b: string): boolean => engineKey(a) === engineKey(b);

/** 2.5 → "2½", 0.5 → "½" (PD:443). */
export function half(x: number): string {
  const w = Math.floor(x);
  const h = x - w >= 0.5;
  return `${w || !h ? w : ''}${h ? '½' : ''}`;
}

export type XCell = { text: string; kind: 'self' | 'none' | 'win' | 'even' | 'loss' };
export type XRow = { rank: number; name: string; games: number; points: string; playing: boolean; cells: XCell[] };

function cell(c: H2HCell, inProgress: boolean): XCell {
  if (c.results === '**') return { text: '', kind: 'self' };
  const g = c.wins + c.draws + c.losses;
  const star = inProgress ? '*' : '';
  if (!g) return { text: star || '·', kind: 'none' };
  const v = c.wins + c.draws / 2;
  return { text: half(v) + star, kind: v > g / 2 ? 'win' : v < g / 2 ? 'loss' : 'even' };
}

/** h2h[j] is the score against the engine in standings row j (CT column j+1 = rank j+1). */
export function crosstable(results: ParsedResults, live: { white: string; black: string } | null): XRow[] {
  const rows = results.standings;
  const playing = rows.map((r) => !!live && (sameEngine(r.name, live.white) || sameEngine(r.name, live.black)));
  return rows.map((r, i) => ({
    rank: r.rank,
    name: r.name,
    games: r.games,
    points: half(r.points),
    playing: playing[i],
    cells: r.h2h.map((c, j) => cell(c, j !== i && playing[i] && !!playing[j])),
  }));
}
