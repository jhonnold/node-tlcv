import type { ColorCode, MoveMetaData, SerializedGame } from '$shared/types';
import type { ColorName } from '$shared/colors';

export type ClockState = { remainingMs: number; thinkMs: number | null };

// The server stamps clocks as they tick (src/game-service.ts:314-324, :397): the side to move's
// startTime is set when the opponent moves, and the waiting side has already used up its whole last think.
export function liveClocks(game: SerializedGame, now: number): Record<ColorName, ClockState> {
  const stm: ColorName = game.stm === 'w' ? 'white' : 'black';
  const other: ColorName = stm === 'white' ? 'black' : 'white';
  const mover = game[stm];
  const waiter = game[other];
  const thinkMs = mover.startTime > 0 ? Math.max(0, now - mover.startTime) : null;
  // The waiter's think ended when the mover's began.
  const waiterUsed =
    waiter.startTime > 0 && mover.startTime >= waiter.startTime ? mover.startTime - waiter.startTime : 0;
  const out = {} as Record<ColorName, ClockState>;
  out[stm] = { remainingMs: Math.max(0, mover.clockTime - (thinkMs ?? 0)), thinkMs };
  out[other] = { remainingMs: Math.max(0, waiter.clockTime - waiterUsed), thinkMs: null };
  return out;
}

/** Milliseconds the given colour spent on its last move at or before `index`, or null if unknown. */
export function lastMoveMs(moves: MoveMetaData[], index: number, color: ColorCode): number | null {
  for (let i = Math.min(index, moves.length) - 1; i >= 0; i -= 1) {
    if (moves[i].color !== color) continue;
    const time = moves[i].time;
    return time == null ? null : time * 1000;
  }
  return null;
}
