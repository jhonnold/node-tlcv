// Pure display formatters, shared by the components that render engine data.
// Kept DOM-free so components can import them without pulling in each other's
// rendering code.

import type { ColorCode, MoveMetaData } from '$shared/types';

export const DASH = '—';

// Pawns. Kibitzer mate is ±1e6 cp = ±10000 (uci-parser.ts:9). TLCS mate is ±(100000 - moves) cp (uci-to-tlcs
// src/uci/info.ts), i.e. ±999.9x pawns, so a mate without a known distance still lands past this.
export const MATE_SCORE_THRESHOLD = 990;

/**
 * TLCS engine scores (WPV/BPV → MoveMetaData.score, liveData.score) are from the side to move's view
 * (src/game-service.ts:197-207). This is the one place that turns them into White's view. Kibitzer
 * scores are already White's (src/kibitzer/uci-parser.ts:57): never pass them through here.
 */
export function whiteScore(score: number, color: ColorCode): number {
  return color === 'b' ? -score : score;
}

/** A finished move's engine score in White's view, or null when it has none. */
export const moveScore = (m: MoveMetaData): number | null => (m.score == null ? null : whiteScore(m.score, m.color));

/** A WDL triple (permille) in White's view. */
export const whiteWdl = (wdl: [number, number, number], color: ColorCode): [number, number, number] =>
  color === 'b' ? [wdl[2], wdl[1], wdl[0]] : wdl;

/**
 * Engine score in pawns, white-relative and signed. A mate score reads as +M / -M, plus the distance when `mate` is
 * known (+M7; only its magnitude is used, the sign comes from the score). A `mate` beside a non-mate score is
 * ignored: liveData's comes from the last WINFO, so it can briefly lag a newer WPV score.
 */
export function formatScore(score: number | null | undefined, mate: number | null = null): string {
  if (score == null) return DASH;
  const dist = mate == null ? '' : String(Math.abs(mate));
  if (score >= MATE_SCORE_THRESHOLD) return `+M${dist}`;
  if (score <= -MATE_SCORE_THRESHOLD) return `-M${dist}`;
  return `${score >= 0 ? '+' : ''}${score.toFixed(2)}`;
}

const UNITS: [number, string][] = [
  [1e9, 'G'],
  [1e6, 'M'],
  [1e3, 'K'],
];

/** Three significant digits with a K/M/G unit. Rounds first, so 999,500 reads 1.00M, not 1000K. */
export function formatCount(n: number): string {
  const r = Number(n.toPrecision(3));
  for (const [div, unit] of UNITS) if (r >= div) return `${(r / div).toPrecision(3)}${unit}`;
  return String(Math.round(n));
}

export function formatNodes(nodes: number | null): string {
  return nodes == null ? DASH : formatCount(nodes);
}

/** Nodes per second. `seconds` of 0/null renders as unknown. */
export function formatNps(nodes: number | null, seconds: number | null): string {
  if (nodes == null || !seconds) return DASH;
  return formatCount(nodes / seconds);
}

/**
 * Seconds to divide a move's nodes by for its NPS. Prefers the engine-reported time
 * from the same PV line as the node count; the server's wall-clock move time only
 * stands in for moves recorded before that was kept (archived games).
 */
export function npsSeconds(meta: MoveMetaData): number | null {
  return meta.usedTime != null ? meta.usedTime / 1000 : meta.time;
}

/** Clock display, `mm:ss`. */
export function msToString(ms: number): string {
  ms = Math.max(0, ms);
  const s = Math.floor((ms / 1000) % 60);
  const m = Math.floor(ms / 1000 / 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Elapsed time, `m:ss`. */
export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
