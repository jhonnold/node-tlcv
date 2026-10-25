import type { BroadcastDelta, SerializedBroadcast } from '$shared/types';

/** A broadcast minus chat: what the board, engine and clock components render. */
export type GameData = Omit<SerializedBroadcast, 'chat'>;

export function applyDelta(prev: GameData, delta: BroadcastDelta): GameData {
  let { game, spectators, menu } = prev;
  if (delta.spectators !== undefined) spectators = delta.spectators;
  if (delta.menu !== undefined) menu = delta.menu;
  if (delta.game) {
    const { resetMoves, newMoves, updatedMoves, ...fields } = delta.game;
    let moves = resetMoves ? [] : game.moves;
    if (newMoves?.length) moves = [...moves, ...newMoves];
    if (updatedMoves?.length) {
      // Retroactive PV fills for moves already sent; no match → dropped (next `state` reconciles).
      const patches = new Map(updatedMoves.map((u) => [`${u.number}${u.color}`, u]));
      moves = moves.map((m) => patches.get(`${m.number}${m.color}`) ?? m);
    }
    game = { ...game, ...fields, moves };
  }
  return { game, spectators, menu };
}
