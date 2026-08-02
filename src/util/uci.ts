import type { Chess } from 'chess.js';

// Replays a UCI principal-variation onto a copy-less live Chess instance, returning
// null when no move in the PV could be played (stale/invalid line). Used by both the
// game-service and the kibitzer manager to render PVs in SAN + coord/alg forms.
export function replayUci(chess: Chess, pv: string[]): { san: string[]; alg: string[]; fen: string } | null {
  const san: string[] = [];
  const alg: string[] = [];

  for (const move of pv) {
    try {
      const result = chess.move(move, { strict: false });
      san.push(result.san);
      alg.push(`${result.from}${result.to}`);
    } catch {
      break;
    }
  }

  return san.length ? { san, alg, fen: chess.fen() } : null;
}
