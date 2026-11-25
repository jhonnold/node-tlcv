import type BoardService from './board-service.js';
import type { BoardSummary, ColorCode } from '../shared/types.js';

/** One board's card for the Boards tab and the lobby. `score` is the caller's: the engine's or the kibitzer's. */
export function boardSummary(board: BoardService, score: number | null): BoardSummary {
  const { game } = board;
  return {
    board: board.id,
    white: game.white.name,
    black: game.black.name,
    whiteTime: game.white.clockTime,
    blackTime: game.black.clockTime,
    fen: game.instance.fen(),
    score,
    opening: game.opening,
    moveCount: game.moveMeta.length,
    viewerCount: board.browserCount,
  };
}

/**
 * A board's latest engine score in pawns, White's view. TLCS scores are from the side to move's view, so
 * they are flipped as `whiteScore` in `web/src/lib/format.ts` does (the server can't import web code).
 */
export function engineScore(board: BoardService): number | null {
  const { game } = board;
  if (game.liveData.depth > 0) return whiteView(game.liveData.score, game.liveData.color);

  const last = game.moveMeta.at(-1);
  return last?.score != null ? whiteView(last.score, last.color) : null;
}

function whiteView(score: number, color: ColorCode): number {
  return color === 'b' ? -score : score;
}
