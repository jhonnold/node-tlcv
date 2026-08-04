// Pure display formatters, shared by the components that render engine data.
// Kept DOM-free so components can import them without pulling in each other's
// rendering code.

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

export function msToString(ms: number): string {
  const s = Math.floor((ms / 1000) % 60);
  const m = Math.floor(ms / 1000 / 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
