---
source_url: https://github.com/jhonnold/node-tlcv/pull/166
ingested: 2026-05-24
source_type: plan
author: jhonnold / claude_code
synthesis: done
---

# Archive meta-fallback (PR #166)

Closes the **Known gap** left by the Previous Broadcasts archive (PR #165):
tournaments that predate the `tournament-results.json` roll-up but still have
per-game `.meta.json` sidecars are now visible and openable in the read-only
archive. Plan/branch: `feat/archive-meta-fallback`,
[PR #166](https://github.com/jhonnold/node-tlcv/pull/166).

## Problem

The Previous Broadcasts archive (PR #165) is gated entirely on the
`tournament-results.json` file added in PR #161:

- `listArchivedTournaments()` skips any `pgns/<slug>/` folder where
  `loadTournamentResults()` returns null → never listed on the homepage.
- The `/archive/:slug` middleware redirects to `/` when
  `loadTournamentResults()` is null → not openable even by direct URL.

So every tournament that finished **before #161 shipped** is invisible —
including folders that already carry per-game `.meta.json` replay sidecars
(those landed earlier, with the replay feature, commit `968a413`). On disk
this is e.g. `PZChessBot_4CPU_Gauntlet` and `Raphael_4CPU_Gauntlet` (one
meta + pgn each, no `tournament-results.json`).

There are in fact **two classes** of legacy folder, with different
file-naming eras:

- **Meta-bearing** — game-number-prefixed files (`491_white_vs_black.pgn`
  + `491_…meta.json`); the `FileCache` regex `/^(\d+)_…/` keys them correctly.
- **PGN-only / truly legacy** — date-prefixed files
  (`20250508_0549_white_vs_black.pgn`), **no** meta sidecars. The cache
  regex would mis-key the *date* as a game number (and collide across same-day
  games). These have no per-game JSON to reconstruct from.

## Decisions (from Jay)

- Result table → showing **"no information"** is acceptable (the CT crosstable
  was never persisted for legacy folders, so standings genuinely can't be
  rebuilt).
- The **games tab** is the must-have.
- **Reconstruct only from `.meta.json` files — do NOT parse `.pgn` files.**
- Replay only works where a meta sidecar exists.

Consequence of "don't parse PGN": the date-prefixed PGN-only folders **stay
hidden** by design. Only meta-bearing folders are surfaced.

## Approach — on-the-fly reconstruction, no migration

Synthesize an equivalent `StoredTournamentResults` from the meta sidecars at
request time when the roll-up file is absent. No disk writes, no backfill
script. Backend-only — **zero frontend changes**.

New/changed in `src/services/tournament-results.ts`:

- `reconstructArchiveFromMeta(slug)` — reads the meta-file map
  (`getMetaFiles(slug)` from `game-meta.ts`, the existing slug-keyed
  `FileCache`), reads each `.meta.json`, builds the `GameRecord[]` from each
  meta's `white.name` / `black.name` / `result`, takes `site` from the first
  meta and `updated` from the directory mtime. `parsedResults: null`. Returns
  `null` when no meta files exist (→ PGN-only folders stay hidden).
- `loadOrReconstructArchive(slug)` — prefers the real roll-up
  (`loadTournamentResults`), else falls back to `reconstructArchiveFromMeta`.
- A module-level **per-slug cache** for reconstructed archives, because the
  `/archive/:slug` middleware runs on every sub-request (page + games/json +
  each meta + result-table) and a large gauntlet would otherwise re-read every
  meta file several times per page load. `invalidateArchiveCache(slug)` is
  wired into the existing slug-change invalidation in `game-service.ts`
  (alongside the meta/pgn cache invalidation).
- `listArchivedTournaments()` — after the existing roll-up check fails, falls
  back to a **light** summary for meta-bearing folders (one meta read for the
  site name, `metaFiles.size` for the count, dir mtime for `updated`).

`src/routes/index.ts` — the `/archive/:slug` middleware swaps
`loadTournamentResults` → `loadOrReconstructArchive`. Everything downstream is
unchanged: `enrichGames()` adds the pgn/meta URLs, the `games/:n/meta` route
serves the sidecar, and `result-table/json` returns its existing 404 when
`parsedResults` is null.

`src/services/game-meta.ts` — exports `getMetaFiles` (the meta `FileCache`'s
`gameNumber → filename` map).

**No frontend changes needed**: the games tab already hides the replay button
when a row has no `metaUrl`, the results tab already renders "No results
available." on the `result-table/json` 404, and move navigation rebuilds board
positions from the SAN list in the meta sidecar.

## Verification

- `tsc` is clean for `src/`/`shared/` (no errors introduced).
- Ran the compiled server against real archive data and drove it with a
  browser: homepage **Previous Broadcasts** lists the two meta-only
  tournaments (previously hidden); PGN-only folders correctly stay hidden;
  `/archive/<slug>` opens; Games tab lists the game with working **View** /
  replay + PGN download; Results tab shows **"No results available."**; replay
  renders the move list from the meta sidecar.

## Caveat — dev-env toolchain (not a repo property)

In this checkout `npm run build` fails with ~181 `@types/ssh2` errors (a nested
duplicate `@types/node` under `node_modules/@types/ssh2`), and `ts-node/esm`
throws on Node 20.19 even for a trivial script. **Both are pre-existing and
unrelated to the change** (confirmed on the untouched base commit). Workaround
used for verification: `tsc -p tsconfig.backend.json --skipLibCheck` to compile
+ emit, then run the emitted JS with plain `node`; webpack builds the frontend
fine (it uses the frontend tsconfig, so the ssh2 types never load). A fresh
`npm install` / `npm dedupe` on the deploy host should clear the `@types`
conflict. This is a local `node_modules` state, not a property of the codebase.

## Related

- node-tlcv — the project
- PR #165 (Previous Broadcasts) — the archive feature this extends
- PR #161 (persist-tournament-results) — the `tournament-results.json` roll-up whose absence this handles
