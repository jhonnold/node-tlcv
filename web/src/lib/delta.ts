import type { BroadcastDelta, SerializedBroadcast } from '$shared/types';

/** A broadcast minus chat: what the board, engine and clock components render. */
export type GameData = Omit<SerializedBroadcast, 'chat'>;

export function applyDelta(prev: GameData, delta: BroadcastDelta): GameData {
  let { game, spectators, menu, boards, summaries } = prev;
  if (delta.spectators !== undefined) spectators = delta.spectators;
  if (delta.menu !== undefined) menu = delta.menu;
  if (delta.boards !== undefined) boards = delta.boards;
  if (delta.summaries !== undefined) summaries = delta.summaries;
  if (delta.game) {
    const { resetMoves, newMoves, updatedMoves, ...fields } = delta.game;
    let moves = resetMoves ? [] : game.moves;
    if (newMoves?.length) {
      // A `state` sent while a batch waits on the opening lookup already holds that batch's moves; skip those.
      const have = new Set(moves.map((m) => `${m.number}${m.color}`));
      moves = [...moves, ...newMoves.filter((m) => !have.has(`${m.number}${m.color}`))];
    }
    if (updatedMoves?.length) {
      // Retroactive PV fills for moves already sent; no match → dropped (next `state` reconciles).
      const patches = new Map(updatedMoves.map((u) => [`${u.number}${u.color}`, u]));
      moves = moves.map((m) => patches.get(`${m.number}${m.color}`) ?? m);
    }
    game = { ...game, ...fields, moves };
  }
  // delta.board needs no check: a socket only gets its own board's game deltas.
  return { board: prev.board, boards, summaries, game, spectators, menu };
}
