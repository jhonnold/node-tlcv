---
source_url: https://github.com/jhonnold/node-tlcv/pull/172
ingested: 2026-05-30
source_type: plan
author: claude_code (drafted) + Jay Honnold (direction + approval)
synthesis: done
---

# Reintroduce "Previous Broadcasts" on the homepage — with caching

Plan + implementation for node-tlcv PR #172 (`dec71ec`, merged 2026-05-30):
re-enable the homepage archive listing that was hot-fix-removed during the
2026-05-25 CPU-credit incident, this time behind an in-memory cache.

## Context

The homepage `/` once listed finished tournaments ("Previous Broadcasts", PR #165).
It was **removed** 2026-05-25 (`9b3c5fb` + hot-fix `c5e168c`) after
`listArchivedTournaments()` drained the host's CPU credits: an uncached
`readdir('pgns')` + synchronous `JSON.parse` of every `pgns/*/tournament-results.json`
(~12 files, ~736 KB) **on every `/` request** — the busiest route, on a burstable
AWS T-class instance near its ~0.2 vCPU credit-earning baseline. `broadcasts.ejs`
also carries `<meta http-equiv="refresh" content="30" />`, so each open tab re-hits
`/` twice a minute, turning the per-request scan into a sustained drain (the
auto-refresh amplifier).

Tournaments finish **at most once a day**, so the listing is highly cacheable. Goal:
cache the disk scan so `GET /` does **zero disk I/O / `JSON.parse` when warm**.

**Backend-only change** — the template (`broadcasts.ejs` `archive-grid`/`archive-card`),
SCSS (`_broadcasts.scss`), `/archive/:slug` routes, and frontend archive mode were
all still in place; only the route's *call* to `listArchivedTournaments()` had been
removed.

## Design

- Cache the **full disk-scan result** (`ArchiveSummary[]`) at module level in
  `src/services/tournament-results.ts`, mirroring the existing `archiveCache` style
  (Map-based, event-driven, **no TTL** — the codebase has no TTL/`setInterval` caches).
- Coalesce concurrent cold-cache scans with a **shared in-flight Promise**
  (`listingInflight`) — the 30s auto-refresh stampede must share one scan.
- Apply the cheap **`liveSlugs` exclusion filter per-request** in `GET /` against the
  cached array (in-memory Set over the `broadcasts` map). Only the disk scan is
  cached; the live set changes independently of disk, so the filter stays live.

## Cache invalidation strategy (the crux — corrected mid-plan by Jay)

The first draft proposed invalidating on the `saveTournamentResults()` write. **Jay
flagged this as wrong**, and the correction reshaped the plan:

- `tournament-results.json` is written on **every game finish** (via the `onCT`
  debounce) — but only for **live** tournaments, which are **filtered out** of the
  listing by `liveSlugs`. Hooking the write would be both **too frequent** (a full
  re-scan per game finish × ~12 broadcasts — re-incurring the cost we're caching
  away) and **unnecessary** (those entries aren't displayed).
- Key insight: **`tournament-results.json` only changes while a tournament is live,
  and a live tournament is never displayed.** By the time an entry enters the
  listing, its file is **frozen**. So the displayed data is static, and the only
  event that matters is the **live→archived transition**.

Invalidate at exactly the two transition points (a handful of times a day, not per
game):

1. **`closeConnection()`** (`src/broadcast-manager.ts`) — broadcast removed → its
   tournament drops out of `liveSlugs` and should appear with final stats.
2. **`onSite()`** (`src/game-service.ts`) — broadcast repoints to a new site → old
   slug leaves the live set, new `pgns/<slug>/` folder may appear. Already the home
   of the `archiveCache`/`pgn`/`meta` invalidations.

New-broadcast opens are covered transitively (the broadcast receives `SITE` shortly
after connecting → `onSite()`). A **startup preload** warms the cache. A long lazy
TTL was considered as a backstop and deliberately **not** shipped (the
transition-based triggers leave no staleness window).

## Implementation (5 files)

1. **`tournament-results.ts`** — `listingCache` + `listingInflight` module state;
   `invalidateListingCache()` (clears both); split `listArchivedTournaments()` into a
   private `scanArchivedTournaments()` (body verbatim) + a cached public wrapper that
   populates only on success and resolves to `[]` on error **without poisoning the
   cache** (next call retries).
2. **`routes/index.ts`** — restore the live-filtered listing in `GET /`; `archived`
   shape unchanged so no EJS/SCSS edits.
3. **`broadcast-manager.ts`** — `invalidateListingCache()` in `closeConnection()`
   after `broadcasts.delete()`.
4. **`game-service.ts`** — `invalidateListingCache()` in `onSite()`, unconditionally
   near the end (the first site assignment also changes the live set).
5. **`main.ts`** — warm the cache at startup in the existing `Promise.all` preload.

## Verification

- `npm run build` (tsc + webpack) and `npm run lint` — clean.
- Live test against the `16061` feed: `GET /` → **200**; listing renders correctly;
  warm-cache proof: 8 rapid `/` hits triggered **zero** extra scans.

## Outcome

Merged as **PR #172 (`dec71ec`)** on 2026-05-30. Backend change → full deploy path
(build + `systemctl restart tlcv`, preserving live `config/config.json`).

## Key insight (why this works)

`tournament-results.json` is written on every game finish — but only while a
tournament is live. Live tournaments are always filtered out of the listing. By the
time a slug enters the listing, its results file is **frozen**. The listing's data
is static; only live→archived transitions matter for invalidation.
