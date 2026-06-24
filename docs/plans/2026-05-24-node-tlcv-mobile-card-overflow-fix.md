---
ingested: 2026-05-24
source_type: plan
author: Claude Agent (direction + approval by Jay Honnold)
synthesis: done
migrated_from: library/imports/plans/2026-05-24-node-tlcv-mobile-card-overflow-fix.md
---

# node-tlcv — stop home cards overflowing the viewport on mobile

> Internal plan, authored and executed on 2026-05-24.
> **Outcome:** implemented and shipped as PR
> [#156](https://github.com/jhonnold/node-tlcv/pull/156) on branch
> `fix/mobile-card-overflow` (merge commit `ddd411a`), closing issue
> [#154](https://github.com/jhonnold/node-tlcv/issues/154). Verified live with
> Playwright (Chromium) against broadcast `16061`, then deployed to
> [ccrl.live](https://ccrl.live/) via the UI-only path and confirmed in the
> served bundle. See [[node-tlcv]].

## Context

GitHub issue [#154](https://github.com/jhonnold/node-tlcv/issues/154) (bug,
filed 2026-05-23): on narrow/mobile viewports the home page (`/`, rendered by
`views/pages/broadcasts.ejs`) broadcast cards do not shrink to fit. At a 390px
viewport the document rendered ~531px wide, producing horizontal page scroll;
clocks, eval bars, and opening names were clipped off the right edge. The
in-game board page reflowed fine — the bug was isolated to the home cards.

## Why the obvious fixes were already present

The issue's own suggested fixes were **already in `main`**, which is what made
this subtle:

- `.card-info { min-width: 0 }` and `text-overflow: ellipsis` on
  `.player-name` / `.tournament-title` / `.opening` — since commit `e2d6efe`
  (2026-03-18).
- Grid track `minmax(min(420px, 100%), 1fr)` + a mobile `1fr` override and the
  80px mobile thumbnail — since commit `c30098e` (2026-03-19,
  "fix(broadcasts): prevent card overflow").

So adding `min-width: 0` to `.card-info` or truncating names would have been a
no-op. The earlier `c30098e` fixed the *grid track* sizing but missed the
*grid item's* automatic minimum.

## Root cause

`.broadcast-card` is a **CSS Grid item** (direct child of `.broadcasts-grid`,
`display: grid`) that still carried the default `min-width: auto`. A grid item
with `min-width: auto` refuses to shrink below its **min-content** size, so it
overrides the `1fr` track and stretches the track to the card's min-content. The
card's min-content is large because `.card-inner` is a flex row of a fixed 80px
`.mini-board` (`flex-shrink: 0`) beside `.card-info`, whose `white-space: nowrap`
player/opening text has a large min-content when names are long.

`min-width: 0` on the inner flex child (`.card-info`) cannot help while the
outer grid item is still allowed to grow. The issue's own measurements confirm
the mechanism: the track stretched to 515px and `.card-info` received a 407px
*share* of that stretched track — it shrank relative to its content, but the
whole card was sized by min-content, not the viewport.

## Change (1 file, 1 line)

`public/css/_broadcasts.scss` — add `min-width: 0` to the `.broadcast-card`
base rule:

```scss
.broadcast-card {
  display: block;
  min-width: 0; // allow the grid item to shrink below its min-content (fixes #154)
  ...
}
```

Placed in the base rule (not `_responsive.scss`): it is correct at all widths
and inert on desktop, where tracks are always ≥420px so the card never needs to
shrink. Kept the existing horizontal board+info layout — at 390px the card is
80px board + ~268px info (usable; stacking vertically would waste the
thumbnail). No template, JS, or other CSS changes were required.

## Verification (Playwright / Chromium, live broadcast `16061`)

Measured `document.documentElement.scrollWidth` vs `window.innerWidth`:

- **Direct before/after proof at 390px with long names injected** (recreating
  the issue's long-name pressure): grid item at `min-width: auto` → document
  **763px wide, overflow TRUE**, card 748px; at `min-width: 0` → document
  **390px, no overflow**, card 358px, name truncated to 185px. This empirically
  pins the root cause to the grid item's automatic minimum.
- No horizontal overflow at **320px** (card 288px), **390px** (358px), or the
  **767px** breakpoint edge (735px) — all stress-tested with long names.
- **1280px desktop unchanged** — two-column grid (`592px 592px`), no overflow;
  the fix is inert above 420px tracks.
- `npm run prebuild` (webpack) + backend `tsc` compile clean; `min-width:0`
  confirmed in the emitted `build/public/broadcasts.css`.

Note: with the *real* (short) player names the single-card runtime toggle did
**not** reproduce the overflow — the min-content was already small enough. The
bug only manifests under long engine/opening names, which is why long-name
injection was needed to demonstrate it.

## Deployment

Frontend-asset-only change → UI-only path, no service restart (per
`CLAUDE.local.md`):

```bash
ssh ccrl 'cd /var/www/node-tlcv && git stash push -- config/config.json && git pull && git stash pop && npm run prebuild'
```

The live `config/config.json` was stashed across the pull and restored, prod
HEAD advanced to `ddd411a`, and `min-width:0` was confirmed in the
publicly-served `https://ccrl.live/broadcasts.css`. GitHub auto-closed #154 on
merge (PR body carried `Closes #154`).

## Related

- [[node-tlcv]] — the service; home cards live in `public/css/_broadcasts.scss`
  and `views/pages/broadcasts.ejs`
- [[2026-05-22-node-tlcv-admin-page-cleanup-plan]] — the adjacent mobile/SCSS
  responsive work in `_responsive.scss`
- [[2026-05-24-node-tlcv-board-a11y-screen-reader]] — sibling fix to the same
  home-card markup (`broadcasts.ejs`); that one is the screen-reader/accessibility
  side, this one the responsive/overflow side
