import { Chess } from 'chess.js';
import type { MoveMetaData } from '$shared/types';
import { START_FEN } from './fen';

export type LastMove = { from: string; to: string };
export type Positions = { startFen: string; fens: string[]; lastMoves: LastMove[] };

/** Replays the SAN moves from the start FEN. Stops at the first move that doesn't parse. */
export function buildPositions(startFen: string | null, sans: string[]): Positions {
  const start = startFen || START_FEN;
  const fens: string[] = [];
  const lastMoves: LastMove[] = [];
  let chess: Chess;
  try {
    chess = new Chess(start);
  } catch {
    return { startFen: start, fens, lastMoves };
  }
  for (const san of sans) {
    try {
      const move = chess.move(san);
      fens.push(chess.fen());
      lastMoves.push({ from: move.from, to: move.to });
    } catch {
      break;
    }
  }
  return { startFen: start, fens, lastMoves };
}

/** FEN shown at nav index `index` (0 = start, k = after the k-th half-move, past the end = live). */
export function fenAt(p: Positions, index: number, liveFen: string): string {
  if (index === 0) return p.startFen;
  if (index <= p.fens.length) return p.fens[index - 1];
  return liveFen;
}

export function lastMoveAt(p: Positions, index: number): LastMove | null {
  return index > 0 ? (p.lastMoves[index - 1] ?? null) : null;
}

/** `20. Qb6` / `20… Qb6`. */
export const moveLabel = (m: MoveMetaData): string => `${m.number}${m.color === 'w' ? '.' : '…'} ${m.move}`;

/** Move-list caption for the shown position, e.g. `Live · after 20… Qb6`. */
export function positionLabel(moves: MoveMetaData[], index: number, following: boolean): string {
  const m = moves[index - 1];
  if (!m) return 'Start position';
  return `${following ? 'Live · ' : ''}after ${moveLabel(m)}`;
}
