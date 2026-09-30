// Pure display formatters, shared by the components that render engine data.
// Kept DOM-free so components can import them without pulling in each other's
// rendering code.

import type { MoveMetaData } from '../../../shared/types';

export const MATE_SCORE_THRESHOLD = 100000;

/** Engine score in pawns, from `color`'s point of view. Scores arrive white-relative. */
export function formatScore(score: number, color: string): string {
  const s = color === 'black' ? score * -1 : score;

  if (s > MATE_SCORE_THRESHOLD) return 'M';
  if (s < -MATE_SCORE_THRESHOLD) return '-M';
  return s.toFixed(2);
}

/** Same as `formatScore`, but always white-relative and always explicitly signed. */
export function formatSignedScore(score: number): string {
  const text = formatScore(score, 'white');
  return score >= 0 && text !== 'M' ? `+${text}` : text;
}

export function formatNodes(nodes: number): string {
  return `${(nodes / 1000000).toFixed(2)}M`;
}

/** Nodes per second, in millions. `seconds` of 0/null renders as unknown. */
export function formatNps(nodes: number, seconds: number | null): string {
  if (!seconds) return '--';
  return `${(nodes / seconds / 1000000).toFixed(2)}M`;
}

/**
 * Seconds to divide a move's nodes by for its NPS. Prefers the engine-reported time
 * from the same PV line as the node count; the server's wall-clock move time only
 * stands in for moves recorded before that was kept (archived games).
 */
export function npsSeconds(meta: MoveMetaData): number | null {
  if (meta.usedTime != null && meta.usedTime > 0) return meta.usedTime / 1000;
  return meta.time;
}

export function msToString(ms: number): string {
  const s = Math.floor((ms / 1000) % 60);
  const m = Math.floor(ms / 1000 / 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
