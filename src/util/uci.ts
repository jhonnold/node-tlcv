import { Chess } from 'chess.js';
import type { ColorCode } from '../../shared/types.js';

export type PvPlayout = { san: string[]; alg: string[]; fen: string };

// Replays a UCI principal-variation onto a copy-less live Chess instance, returning
// null when no move in the PV could be played (stale/invalid line). Used by both the
// game-service and the kibitzer manager to render PVs in SAN + coord/alg forms.
export function replayUci(chess: Chess, pv: string[]): PvPlayout | null {
  const san: string[] = [];
  const alg: string[] = [];

  for (const move of pv) {
    try {
      // PV entries are always coordinate notation, so hand chess.js the from/to form
      // directly: the string form runs the SAN parser first, which builds a SAN string
      // for every legal move before failing over to the permissive path.
      const result = chess.move({
        from: move.slice(0, 2),
        to: move.slice(2, 4),
        promotion: move.slice(4) || undefined,
      });
      san.push(result.san);
      alg.push(`${result.from}${result.to}`);
    } catch {
      break;
    }
  }

  return san.length ? { san, alg, fen: chess.fen() } : null;
}

/**
 * Replays a PV against a position given as a FEN, reporting the move number the
 * line starts from. Returns null for an unusable FEN or a line with no playable
 * move. The FEN always originates from chess.js itself, so validation is skipped.
 */
export function replayUciFromFen(fen: string, pv: string[]): (PvPlayout & { moveNumber: number }) | null {
  try {
    const chess = new Chess();
    chess.load(fen, { skipValidation: true });

    const moveNumber = chess.moveNumber();
    const replay = replayUci(chess, pv);

    return replay ? { ...replay, moveNumber } : null;
  } catch {
    return null;
  }
}

/** Side to move, read out of a FEN's second field. Defaults to white for a missing/short FEN. */
export function sideToMove(fen: string | null | undefined): ColorCode {
  return fen?.split(' ')[1] === 'b' ? 'b' : 'w';
}
