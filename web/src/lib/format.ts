// Pure display formatters, shared by the components that render engine data.
// Kept DOM-free so components can import them without pulling in each other's
// rendering code.

import type { MoveMetaData } from '$shared/types';

export const MATE_SCORE_THRESHOLD = 100000;
export const DASH = '—';

/** Engine score in pawns, white-relative and signed. Mate scores read as +M / -M. */
export function formatScore(score: number | null | undefined): string {
  if (score == null) return DASH;
  if (score > MATE_SCORE_THRESHOLD) return '+M';
  if (score < -MATE_SCORE_THRESHOLD) return '-M';
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
