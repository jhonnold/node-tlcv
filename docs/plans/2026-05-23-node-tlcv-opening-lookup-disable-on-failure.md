---
ingested: 2026-06-04
source_type: plan
author: Claude Agent (direction + approval by Jay Honnold)
synthesis: done
---

# node-tlcv — stop retrying Lichess opening lookups once they fail per game

> Internal plan, authored and executed interactively on 2026-05-23.
> **Outcome:** implemented and shipped as PR
> [#147](https://github.com/jhonnold/node-tlcv/pull/147) on branch
> `fix/disable-opening-lookup-on-failure`; `npm run build` + `npm run lint`
> both pass. See [[node-tlcv]].

## Context

[[node-tlcv]] enriches each move with a Lichess **masters opening** name and a
**tablebase** result, fetched in parallel from `onMove()` in
`src/game-service.ts` (`fetchOpening` / `fetchTablebase` in
`src/services/lichess.ts`).

For games that **don't begin from the standard starting position** — those
loaded mid-position via `ChessGame.resetFromFen()`, which sets `startFen` — the
masters explorer is queried with a `play=` move list that doesn't make sense
from startpos (e.g. `play=g8f8,d6d8,b6g6,g2g4,f7f5,e2g3`). The explorer responds
with a **plaintext `bad request` body**, so `await response.json()` throws and
the catch block logs a WARN + ERROR pair **on every move** of that game:

```
[ WARN] [P16061] Error requesting opening for game 16061 @ https://explorer.lichess.org/masters?play=...
[ERROR] Unexpected token 'b', "bad reques"... is not valid JSON
```

Goal: minimize this recurring log noise — once an opening lookup fails for a
game, never request the opening again for that game, while the **tablebase**
lookup (which uses the FEN directly and works regardless of start position)
keeps running normally.

## Key design point — failure vs. no-match

`fetchOpening` previously returned `string | null`, where `null` conflated **two
distinct outcomes**:

1. **No opening found (out of book)** — a *successful* request. The masters
   explorer returns `{ opening: null }` for any position past the classified
   opening, which happens on essentially every move after the first ~8–20 plies
   of a normal game and produces **zero log output**.
2. **A real failure** — the catch block (HTTP/parse error). This is the *only*
   source of the noise.

So the kill switch must fire **only** on case 2. Disabling on *any* `null` would
(a) permanently disable lookups extremely early on essentially every game — a
behavior change to the working path that buys nothing, since out-of-book nulls
log nothing — and (b) lose legitimate late opening refinements (the name grows
more specific as book continues; transpositions can re-enter a named line).
The fix therefore changes the return contract so the caller can tell the two
apart.

## Scope chosen — reactive + proactive

- **Reactive:** after the first actual failure, set a per-game flag and never
  request the opening again for that game.
- **Proactive:** also skip the opening lookup entirely when the game started
  from a non-standard FEN (`startFen !== null`), since the masters explorer can
  only succeed from the standard start — eliminating even the single
  first-failure log for those games.

## Changes (3 files)

### `src/services/lichess.ts` — distinguish failure from no-match

`fetchOpening` now returns an exported result type instead of `string | null`,
returning it in all three branches; the WARN/ERROR logging stays in the catch
block. `fetchTablebase` is unchanged.

```ts
export type OpeningResult = { failed: boolean; opening: string | null };

export async function fetchOpening(name: string, instance: Chess): Promise<OpeningResult> {
  // no history → { failed: false, opening: null }
  try {
    // ...fetch + parse...
    if (opening) return { failed: false, opening: `${eco} ${openingName}` };
    return { failed: false, opening: null }; // out of book — not a failure
  } catch (error) {
    logger.warn(`Error requesting opening for game ${name} @ ${url}`, { port: name });
    logger.error(error);
    return { failed: true, opening: null };
  }
}
```

### `src/chess-game.ts` — per-game disable flag

Add `openingLookupDisabled: boolean`, declared next to `opening`/`tablebase`,
initialized `false` in the constructor, and cleared in `reset()` (the startpos
new-game path, so a fresh game re-attempts lookups). Deliberately **not**
touched in `resetFromFen()` — those custom-FEN games are exactly the ones that
should stay suppressed, and the proactive `startFen` guard covers them anyway.
The flag is internal-only; `toJSON()` / `SerializedGame` are unchanged.

### `src/game-service.ts` — guard the opening lookup in `onMove()`

```ts
const skipOpening = this.game.openingLookupDisabled || this.game.startFen !== null;

const [openingResult, tablebase] = await Promise.all([
  skipOpening
    ? Promise.resolve<OpeningResult>({ failed: false, opening: null })
    : fetchOpening(this.game.name, this.game.instance),
  fetchTablebase(this.game.name, this.game.fen, this.game.instance.turn()),
]);

if (openingResult.failed) {
  this.game.openingLookupDisabled = true;
} else if (openingResult.opening) {
  this.game.opening = openingResult.opening;
}
this.game.tablebase = tablebase;
```

## Net effect

- **Custom-FEN games** (`startFen` set): opening lookup never runs → zero
  opening WARN/ERROR logs and zero `Requesting opening...` INFO lines.
- **Startpos games** hitting a transient Lichess failure: log once, set the
  flag, never retry for that game; auto-re-enabled on the next new game
  (`reset()`).
- Tablebase lookups continue unchanged in all cases.

## Verification

- `npm run build` (tsc + webpack) and `npm run lint` both pass. The changed
  return type propagates cleanly through the single call site.
- Manual log check (not yet run live): against a broadcast that loads a
  mid-game position, confirm the `Error requesting opening ...` /
  `is not valid JSON` pair no longer repeats each move while tablebase lines
  still appear; for a normal startpos game, confirm opening names still resolve.

## Implementation notes

- The project's pinned Prettier version (pre-commit via Husky/lint-staged) does
  **not** parse the inline `import { ..., type Foo }` modifier, even though
  `tsc` accepts it. Use a separate `import type { OpeningResult } from ...`
  line instead. (General [[node-tlcv]] pre-commit gotcha.)

## Related

- [[node-tlcv]] — the service; Lichess integration in `src/services/lichess.ts`,
  called from `game-service.ts` `onMove()`
