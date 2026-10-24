import type { ColorCode } from '$shared/types';

export type PvParts = { pre: string; first: string; rest: string };
export const EMPTY_PV: PvParts = { pre: '', first: '', rest: '' };

/**
 * Split a SAN PV for display (Engine.dc.html:45). The first `skip` moves are already on the board
 * (the mover's own move) → `pre`; the next move → `first` (bold, engine colour); the rest → `rest`.
 * Numbering: `21. Qe2 c5 22. dxc5`; a black move that opens a part reads `20… Qb6` (U+2026).
 */
export function pvParts(pv: string[] | null, moveNumber: number, firstColor: ColorCode, skip: 0 | 1 = 0): PvParts {
  if (!pv?.length) return EMPTY_PV;
  const offset = firstColor === 'b' ? 1 : 0;
  const tokens = pv.map((san, i) => {
    const ply = i + offset;
    const n = moveNumber + Math.floor(ply / 2);
    if (ply % 2 === 0) return `${n}. ${san}`;
    return i === 0 || i === skip ? `${n}… ${san}` : san;
  });
  return { pre: tokens.slice(0, skip).join(' '), first: tokens[skip] ?? '', rest: tokens.slice(skip + 1).join(' ') };
}
