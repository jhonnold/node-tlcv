---
source_url: ""
ingested: 2026-06-04
source_type: plan
author: Claude Agent (direction + approval by Jay Honnold)
synthesis: done
---

# node-tlcv — persist latest tournament results on game finish

> Internal plan, authored and executed interactively on 2026-05-24.
> **Outcome:** implemented, verified against 8 live broadcasts, and shipped
> as PR [#161](https://github.com/jhonnold/node-tlcv/pull/161) (squash-merged
> to `main` as `99f4a60`). One Copilot review comment addressed before merge.

## Context

In node-tlcv a broadcast's tournament **standings** (`parsedResults`) and
**games schedule** (`parsedGames`) live only in memory on the `Broadcast`,
served live via `/:port/result-table/json` and `/:port/games/json`. They are
lost when a broadcast closes, reconnects, or a port is reused for a new
tournament. Per-game `*.meta.json` / `*.pgn` snapshots under `pgns/{siteSlug}/`
survive (a finished game's moves persist), but the tournament-level table and
schedule do not.

Goal: whenever a game finishes, write the **latest** tournament results to a
single JSON file in the same `pgns/{siteSlug}/` directory as the other
snapshots, so a tournament's table and schedule can be reconstructed
retroactively from disk. Not point-in-time — a fixed filename overwritten with
the latest each time. **Scope: write-only** (no new route, no frontend wiring).

## Key design point — trigger on the CT dump, not on `onResult()`

The crucial subtlety is *when* the fresh data is available. `onResult()`
(`src/game-service.ts`) saves PGN/meta, dispatches the game-finished webhook,
then calls `broadcast.reloadResults()` which **requests** a fresh `RESULTTABLE`
from the TLCS server. At that instant `parsedResults` / `parsedGames` still
reflect the **pre-finish** state, so writing in `onResult()` would persist stale
standings that miss the just-finished game.

The fresh crosstable arrives asynchronously afterward: `onCTReset()` clears the
buffers; `onCT()` appends each `CT:` line, sets `parsedResults` when it sees the
`total games =` line, and a **100ms debounced `setTimeout`** runs `parseGames()`
and sets `parsedGames`. That debounce callback fires exactly **once per CT dump
completion** — at broadcast startup *and* after each finished game (because
`reloadResults()` triggers a new dump). Writing there captures fresh standings +
schedule including the finished game. It also writes once at startup, which is
fine and beneficial under "latest" semantics.

## Changes (3 files, +47 lines)

### `shared/types.ts` — persisted shape

Reuses `ParsedResults` and bare `GameRecord[]` (the `pgnUrl` / `metaUrl` fields
are added only at route time, so they stay absent on disk):

```ts
export type StoredTournamentResults = {
  site: string;
  port: number;
  updated: string;                 // ISO 8601 timestamp
  results: string;                 // raw accumulated CT text dump
  parsedResults: ParsedResults | null;
  parsedGames: GameRecord[];
};
```

The raw `results` text is stored as the source of truth (already in memory, free)
so a later reader can re-parse if the parser evolves.

### `src/services/tournament-results.ts` — new service

Mirrors the `game-meta.ts` pattern (`mkdirp` + `writeFile`, try/catch +
`logger.error`, `siteSlug` from the util barrel). Takes the whole `Broadcast`
(needs `site`, `port`, `results`, `parsedResults`, `parsedGames` — all public
getters); `Broadcast` is a **type-only** import to avoid a runtime circular
import. Writes `pgns/{siteSlug}/tournament-results.json`.

The fixed filename `tournament-results.json` deliberately matches **neither**
FileCache regex (`/^(\d+)_.+\.meta\.json$/i`, `/^(\d+)_.+\.pgn$/i` — both require
a leading digit group), so the meta/pgn caches' `readdir` scans ignore it and it
never appears as a phantom game in `/:port/games/json`. **No FileCache** for it —
it's one fixed name, never looked up by `gameNumber`.

### `src/game-service.ts` — one call in the `onCT` debounce

Inside the existing `if (games.length > 0)` guard, after `parsedGames` /
`currentGameNumber` are set, fire-and-forget (matching the webhook `dispatch`
pattern — no `await`):

```ts
this.broadcast.parsedGames = games;
this.broadcast.currentGameNumber = games[0].gameNumber + 1;
saveTournamentResults(this.broadcast);   // catches all errors internally
```

## Review fix — guard the whole body

Copilot's only review comment was valid (low severity): because the call is
fire-and-forget, a throw **before** the `try` (slug/path construction) would
reject the unawaited promise → an unhandled rejection, contradicting the call
site's "catches all errors internally" comment. (The mirrored `game-meta.ts` has
the same shape but is `await`ed inside `onResult`, so its rejection lands in a
handled context — which is exactly why the gap mattered here and not there.) Fix:
move the **entire** function body into one `try/catch`. The log message drops the
inline `filepath` (FS errors carry the path themselves). Shipped as a follow-up
commit on the PR branch before merge.

## Verification

- `tsc -p tsconfig.backend.json` clean; ESLint clean on all three files; Husky
  lint-staged passed on commit. (A pre-existing `@types/ssh2` nested-`@types/node`
  duplicate-definition conflict fails `npm run build` — identical on `main`,
  unrelated to this change.)
- Ran `dev-server` against 8 live gauntlet broadcasts (~7 min) using
  `TS_NODE_TRANSPILE_ONLY=true` to bypass the ssh2 type conflict:
  - **Startup:** 8 `tournament-results.json` files written with the correct
    shape (e.g. Winter Gauntlet: port 16073, 11 standings rows, totalGames 66,
    62 game records, raw `results` ~9.6 KB).
  - **On game finish:** confirmed rewrites on two independent tournaments —
    Winter Gauntlet (`parsedGames` 62→67) and Stash 4CPU Gauntlet (131→147),
    each with an advanced `updated` timestamp and the finished game included.
  - **0** `Unable to write tournament results` errors; **0** uncaught/fatal
    errors over the run.
