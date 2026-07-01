// Pure derivations for the Results crosstable — no DOM, no jQuery.
//
// Everything is computed from the `ParsedResults` the server already serves
// (live `/:port/result-table/json` and archive `/archive/:slug/result-table/json`
// share this shape), so there is no backend dependency.
import type { StandingsRow, H2HCell } from '../../../../shared/types';

// Pentanomial pair distribution, low→high pair-score buckets:
//   [0] −− (0.0)  [1] − (0.5)  [2] = (1.0)  [3] + (1.5)  [4] ++ (2.0)
export type Penta = [n0: number, n05: number, n1: number, n15: number, n2: number];

export type EngineRecord = {
  rank: number;
  name: string;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  points: number; // authoritative row.points (not recomputed)
  scorePct: number; // games === 0 ? 0 : points / games * 100
  penta: Penta; // aggregated over the row's h2h cells
};

export type GauntletOpponentRecord = {
  opponentRank: number;
  opponentName: string;
  wins: number;
  draws: number;
  losses: number;
  games: number;
  points: number;
  scorePct: number;
  penta: Penta;
};

export type GauntletGroup = {
  engine: EngineRecord;
  opponents: GauntletOpponentRecord[];
};

export type GauntletAnalysis = {
  isGauntlet: boolean;
  gauntletRanks: number[];
  groups: GauntletGroup[];
};

const SCORE: Record<string, number> = { '1': 1, '=': 0.5, '0': 0 };

function isPlayed(cell: H2HCell): boolean {
  return cell.results !== '**' && cell.results !== '.' && cell.wins + cell.draws + cell.losses > 0;
}

// Split a matchup's ordered result string into consecutive 2-game pairs and
// bucket each pair by its combined score. A trailing odd game (an in-progress
// pair) is excluded from the distribution — its W/L/D still count elsewhere.
export function cellPenta(cell: H2HCell): Penta {
  const penta: Penta = [0, 0, 0, 0, 0];
  const raw = cell.results;
  if (!raw || raw === '**' || raw === '.') return penta;

  const scores: number[] = [];
  for (const ch of raw) {
    if (ch in SCORE) scores.push(SCORE[ch]);
  }

  for (let i = 0; i + 1 < scores.length; i += 2) {
    const bucket = Math.round((scores[i] + scores[i + 1]) * 2); // 0..4
    penta[bucket]++;
  }
  return penta;
}

export function summarizeRow(row: StandingsRow): { wins: number; draws: number; losses: number } {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  for (const cell of row.h2h) {
    wins += cell.wins;
    draws += cell.draws;
    losses += cell.losses;
  }
  return { wins, draws, losses };
}

// EngineRecord[] aligned to standings order (index i ↔ standings[i]).
export function deriveRecords(standings: StandingsRow[]): EngineRecord[] {
  return standings.map((row) => {
    const { wins, draws, losses } = summarizeRow(row);
    const penta: Penta = [0, 0, 0, 0, 0];
    for (const cell of row.h2h) {
      const p = cellPenta(cell);
      for (let i = 0; i < 5; i++) penta[i] += p[i];
    }
    return {
      rank: row.rank,
      name: row.name,
      games: row.games,
      wins,
      draws,
      losses,
      points: row.points,
      scorePct: row.games === 0 ? 0 : (row.points / row.games) * 100,
      penta,
    };
  });
}

function playedCount(row: StandingsRow): number {
  let n = 0;
  for (const cell of row.h2h) {
    if (isPlayed(cell)) n++;
  }
  return n;
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// For one gauntlet engine, expand its h2h row into per-opponent records.
export function buildGauntletGroup(
  engineIndex: number,
  standings: StandingsRow[],
  records: EngineRecord[],
): GauntletGroup {
  const row = standings[engineIndex];
  const opponents: GauntletOpponentRecord[] = [];

  row.h2h.forEach((cell, j) => {
    if (j === engineIndex || !standings[j] || !isPlayed(cell)) return;
    const games = cell.wins + cell.draws + cell.losses;
    const points = cell.wins + 0.5 * cell.draws;
    opponents.push({
      opponentRank: standings[j].rank,
      opponentName: standings[j].name,
      wins: cell.wins,
      draws: cell.draws,
      losses: cell.losses,
      games,
      points,
      scorePct: games === 0 ? 0 : (points / games) * 100,
      penta: cellPenta(cell),
    });
  });

  opponents.sort((a, b) => a.opponentRank - b.opponentRank);
  return { engine: records[engineIndex], opponents };
}

// Conservative gauntlet detection: a few engines that played nearly everyone,
// while the rest played only the gauntlet engine(s). False negatives (showing
// the matrix) are harmless; false positives (hiding it) are not.
export function detectGauntlet(standings: StandingsRow[], records: EngineRecord[]): GauntletAnalysis {
  const empty: GauntletAnalysis = { isGauntlet: false, gauntletRanks: [], groups: [] };
  const N = standings.length;
  if (N < 3) return empty;

  const played = standings.map(playedCount);
  const threshold = Math.max(3, 2.5 * Math.max(1, median(played)));

  const runnerIdx: number[] = [];
  played.forEach((p, i) => {
    if (p >= threshold) runnerIdx.push(i);
  });

  const minorityCap = Math.max(1, Math.floor(N / 3));
  const ok = runnerIdx.length >= 1 && runnerIdx.length < N && runnerIdx.length <= minorityCap;
  if (!ok) return empty;

  return {
    isGauntlet: true,
    gauntletRanks: runnerIdx.map((i) => standings[i].rank),
    groups: runnerIdx.map((i) => buildGauntletGroup(i, standings, records)),
  };
}
