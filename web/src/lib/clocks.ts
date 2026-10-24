import type { ColorCode, MoveMetaData, SerializedGame } from '$shared/types';
import { colorName, otherColor } from '$shared/colors';
import type { ColorName } from '$shared/colors';

export type ClockState = { remainingMs: number; thinkMs: number | null };
/** What a side had left when its turn ended, and the clockTime it carried then (see liveClocks). */
export type TurnEnd = { clockTime: number; remainingMs: number };

// The server stamps clocks as they tick (src/game-service.ts:314-324, :397): the side to move's
// startTime is set when the opponent moves, and the waiting side has already used up its whole last think.
export function liveClocks(
  game: SerializedGame,
  now: number,
  turnEnd: Partial<Record<ColorCode, TurnEnd>> = {},
): Record<ColorName, ClockState> {
  const stm = colorName(game.stm);
  const other = colorName(otherColor(game.stm));
  const mover = game[stm];
  const waiter = game[other];
  const thinkMs = mover.startTime > 0 ? Math.max(0, now - mover.startTime) : null;
  // The waiter's think ended when the mover's began.
  const waiterUsed =
    waiter.startTime > 0 && mover.startTime >= waiter.startTime ? mover.startTime - waiter.startTime : 0;
  let remainingMs = Math.max(0, mover.clockTime - (thinkMs ?? 0));
  // XTIME for this turn lands 0.3-3 s after the move, and until then clockTime is still the value from the
  // mover's previous think, which reads too high. Bound it by what the mover had left when that turn ended.
  const ended = turnEnd[game.stm];
  if (ended?.clockTime === mover.clockTime) {
    remainingMs = Math.min(remainingMs, Math.max(0, ended.remainingMs - (thinkMs ?? 0)));
  }
  const out = {} as Record<ColorName, ClockState>;
  out[stm] = { remainingMs, thinkMs };
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
