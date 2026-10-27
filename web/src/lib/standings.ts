import { formatPermille } from './format';
import type { H2HCell, ParsedResults, StandingsRow } from '$shared/types';

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
/** Build tags can differ ("Caissa 1.25 AVX2" vs "CAISSA 1.25 64-BIT"), so the shorter name must be a prefix of the longer. */
export function sameEngine(a: string, b: string): boolean {
  const x = engineKey(a).split(' ');
  const y = engineKey(b).split(' ');
  const [s, l] = x.length <= y.length ? [x, y] : [y, x];
  return s.every((t, i) => t === l[i]);
}

/** 2.5 → "2½", 0.5 → "½". */
export function half(x: number): string {
  const w = Math.floor(x);
  const h = x - w >= 0.5;
  return `${w || !h ? w : ''}${h ? '½' : ''}`;
}

export type XCell = { text: string; kind: 'self' | 'none' | 'win' | 'even' | 'loss' };
export type XPairKind = 'w2' | 'w1' | 'even' | 'l1' | 'l2' | 'live';
export type XPair = { kind: XPairKind; label: string };
export type XRow = {
  rank: number;
  name: string;
  games: number;
  points: string;
  pct: string;
  w: number;
  d: number;
  l: number;
  playing: boolean;
  isHost: boolean;
  cells: XCell[];
  pairs: XPair[];
};

function cell(c: H2HCell, inProgress: boolean): XCell {
  if (c.results === '**') return { text: '', kind: 'self' };
  const g = c.wins + c.draws + c.losses;
  const star = inProgress ? '*' : '';
  if (!g) return { text: star || '·', kind: 'none' };
  const v = c.wins + c.draws / 2;
  return { text: half(v) + star, kind: v > g / 2 ? 'win' : v < g / 2 ? 'loss' : 'even' };
}

function totals(h2h: H2HCell[]): { w: number; d: number; l: number } {
  const t = { w: 0, d: 0, l: 0 };
  for (const c of h2h) {
    t.w += c.wins;
    t.d += c.draws;
    t.l += c.losses;
  }
  return t;
}

const played = (c: H2HCell): boolean => c.wins + c.draws + c.losses > 0;

/** A gauntlet: one row has played every other row, and every other row has played only that row. Null for a round robin. */
export function gauntletHost(rows: StandingsRow[]): number | null {
  if (rows.length < 3) return null;
  const host = rows.findIndex((r, i) => r.h2h.every((c, j) => i === j || played(c)));
  if (host === -1) return null;
  const isGauntlet = rows.every((r, k) => k === host || r.h2h.every((c, j) => j === k || j === host || !played(c)));
  return isGauntlet ? host : null;
}

const HALF_POINTS: Record<string, number> = { '1': 2, '=': 1, '0': 0 };
/** Pair outcomes from the row engine's side, best first (index = 4 − half points), then a pair still being played. Also the legend order. */
export const PAIR_KEYS: XPair[] = [
  { kind: 'w2', label: '2–0' },
  { kind: 'w1', label: '1½–½' },
  { kind: 'even', label: '1–1' },
  { kind: 'l1', label: '½–1½' },
  { kind: 'l2', label: '0–2' },
  { kind: 'live', label: 'in progress' },
];
const LIVE = PAIR_KEYS[5];

/** Gauntlet games come in pairs (one opening, both colours): each two consecutive characters of the CT string are one pair, scored from the row engine's side. A trailing game without its pair, or a game in progress, is a live pair. */
export function pairs(results: string, inProgress: boolean): XPair[] {
  const games = [...results.replace(/[^10=]/g, '')];
  const out: XPair[] = [];
  for (let i = 0; i < games.length; i += 2) {
    out.push(i + 1 < games.length ? PAIR_KEYS[4 - HALF_POINTS[games[i]] - HALF_POINTS[games[i + 1]]] : LIVE);
  }
  if (inProgress && games.length % 2 === 0) out.push(LIVE);
  return out;
}

/** h2h[j] is the score against the engine in standings row j (CT column j+1 = rank j+1). */
export function crosstable(results: ParsedResults, live: { white: string; black: string } | null): XRow[] {
  const rows = results.standings;
  const host = gauntletHost(rows);
  const playing = rows.map((r) => !!live && (sameEngine(r.name, live.white) || sameEngine(r.name, live.black)));
  return rows.map((r, i) => ({
    rank: r.rank,
    name: r.name,
    games: r.games,
    points: half(r.points),
    pct: r.games ? formatPermille((r.points / r.games) * 1000) : '—',
    ...totals(r.h2h),
    playing: playing[i],
    isHost: i === host,
    cells: r.h2h.map((c, j) => cell(c, j !== i && playing[i] && !!playing[j])),
    pairs: host !== null && i !== host ? pairs(r.h2h[host].results, playing[i] && playing[host]) : [],
  }));
}
