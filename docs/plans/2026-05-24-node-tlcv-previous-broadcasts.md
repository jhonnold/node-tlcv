---
source_url: https://github.com/jhonnold/node-tlcv/pull/165
ingested: 2026-06-04
source_type: plan
author: jhonnold / claude_code
synthesis: done
migrated_from: library/imports/plans/2026-05-24-node-tlcv-previous-broadcasts.md
---

# node-tlcv — Previous Broadcasts (tournament archive)

Shipped as **PR #165** (`feat: previous broadcasts (tournament archive)`,
branch `feat/previous-broadcasts`, **merged** 2026-05-24), base `main`.
Builds directly on [[2026-05-24-node-tlcv-persist-tournament-results]].

## Problem / motivation

PR #161 began writing `pgns/{siteSlug}/tournament-results.json` on every CT
dump, and finished games already wrote `{n}_white_vs_black.pgn` +
`.meta.json` sidecars (full move history + per-move kibitzer snapshots). All
of that sat on disk with **no frontend wiring**. This change surfaces it: a
read-only **archive** of past tournaments.

## Behaviour

- The homepage (`/`) gains a **"Previous Broadcasts"** section listing
  archived tournaments — site name, last-updated date, game count, newest
  first. Currently-live tournaments are **excluded** (they're already in the
  live grid above).
- Clicking a card opens the normal broadcast page in **archive mode** at
  `/archive/:slug`, populated from the saved `pgns/{slug}/` directory. The
  user browses the Games list, views standings, and **replays any game**.
- The **Chat tab is removed** in archive mode (no live feed). So is the
  replay "Back to Live" banner (see below).

### Confirmed product decisions (asked up front)

1. Previous Broadcasts **excludes currently-live** tournaments.
2. Archive pages **auto-load the most recent game** onto the board on open.
3. Archive cards show **site + last-updated date + game count**, newest first.

## Implementation

### Backend

- `src/services/tournament-results.ts` (previously write-only) gained two
  read helpers: `loadTournamentResults(slug)` (reads + parses the JSON, `null`
  on miss) and `listArchivedTournaments()` (scans `pgns/*`, returns
  `{ slug, site, updated, gameCount }[]` sorted by `updated` desc). New
  `ArchiveSummary` type in `shared/types.ts`.
- `src/routes/index.ts`:
  - `GET /` made async; computes live slugs via `siteSlug(b.game.site)` and
    filters them out of the archive list.
  - Extracted a shared `enrichGames(slug, parsedGames)` helper (adds
    `pgnUrl`/`metaUrl` from the slug-keyed `pgn-cache` / `game-meta` services)
    used by both the live `/:port/games/json` and the archive route.
  - New slug-validated `/archive/:slug` block mirroring the live `/:port`
    routes: page render, `games/json`, `games/:n/meta`, `result-table/json`.
    Slug is validated against `/^[a-z0-9_]+$/i` to keep it out of the
    `pgns/{slug}/...` path (traversal guard); missing/invalid → `302 /`.
- The slug-keyed, disk-backed services (`getMetaFile`, `getMetaFileUrl`,
  `getFiles`) already worked for archives with **zero changes** — they key on
  slug, not on a live broadcast/port.

### Frontend

- `public/js/utils/url.ts`: pathname-derived `isArchive()`, `archiveSlug()`,
  `apiBase()` — so the data layer needs **no server-injected globals**.
  `apiBase()` returns `/archive/<slug>` in archive mode, `/<port>` otherwise.
- `results` and `games` components fetch via `apiBase()` instead of
  `getPort()`.
- `public/js/index.ts`: in archive mode, **skips the Socket.IO connect + chat
  init**; everything else (board, navigation, results, games, replay, graphs)
  is socket-agnostic and runs unchanged.
- `games` component **auto-loads the most recent game** (highest `gameNumber`
  with a `metaUrl`) on init via the existing `loadReplay()`.
- `tabs` component seeds its default tab from the server-rendered
  `data-active-tab` (so archive defaults to **Games**, live to Chat).
- EJS: `chat.ejs` drops the Chat tab/panel and the live-only PGN links when
  `archive`; `index.ejs` renders an archive title/header; `broadcasts.ejs` +
  `_broadcasts.scss` add the archive card grid.

### The "Back to Live" banner — and why it's gone in archive mode

The replay banner's button was the **"return to the live game"** affordance.
A first pass relabelled it "Back to Games" and had it `emit('tab:change',
{ tab: 'games' })`. That exposed a latent quirk: **`tab:change` is a
notification event, not the visual switch**. The only thing that changes the
visible tab is `data-active-tab`, set exclusively in `tabs.switchTab()`, which
is called **only from the real tab-button click handler**. `tab:change`
listeners (games, results, navigation, graphs) just lazily re-render their own
panel. So the relabelled button exited replay + re-rendered the games list but
**didn't actually navigate** to the Games tab. (Same reason `games.loadReplay()`
emitting `tab:change → moves` doesn't visually jump to Moves on the live page
either — inherited behaviour.) Resolution: **don't render the banner at all in
archive mode** — archive pages are always replaying a saved game and have no
live game to return to; switching games happens via the Games list. `injectBanner()`
early-returns when `isArchive()`; `exitReplay()` reverted to its live-only form.

## Replay reuse (the key insight)

The existing **replay component** (`components/replay/`) already reconstructs a
full game purely from a `.meta.json` sidecar via a `game:replay` event with
**no socket** — that's the entire archive playback path. Navigation rebuilds the
board from the SAN `moves[].move` + `startFen` via chess.js, so per-move analysis
fields are optional for the board to work.

## Verification

- `npm run prebuild` (full frontend type-check via ts-loader) passes; ESLint
  clean; backend `tsc` shows only the **pre-existing `@types/ssh2` conflict**
  (unrelated; the team runs the backend transpile-only to sidestep it).
- Exercised the disk-read service chain against synthetic archive data.
- **End-to-end in a real browser** (server + dev-public on `:8081`, isolated
  empty-`connections` config via `CONFIG_DIR` so the synthetic archive isn't
  excluded as live, two-game synthetic archive built with chess.js): homepage
  archive card; archive page with no Chat tab; auto-loaded latest game;
  move-list navigation (board FEN matched the game's final position); Results
  standings; replaying a different game; malformed/nonexistent slugs → `302 /`.

## Known gap / deferred follow-up

**Legacy `pgns/` folders without `tournament-results.json` are invisible in the
archive.** The file only started being written in #161, so the large
back-catalog (tournaments that finished before deploy) is skipped:
`listArchivedTournaments()` does `if (!stored) continue`, and direct
`/archive/<legacy-slug>` redirects to `/`. Those folders remain reachable only
via the raw `/pgns` directory index, as before. The archive list starts nearly
empty and grows as the server connects to tournaments post-deploy.

Deferred to a later PR (Jay's call): **fall back to building the archive from
the PGN/meta files** the `FileCache` already indexes when `results.json` is
absent — games list + replay would work for any folder with sidecars. The hard
limit either way: **standings can't be reconstructed** for legacy tournaments
because the CT crosstable was never persisted, so their Results tab would show
"no results available." This gap was closed by PR #166 (meta-fallback) and the
listing caching issue by PR #172.
