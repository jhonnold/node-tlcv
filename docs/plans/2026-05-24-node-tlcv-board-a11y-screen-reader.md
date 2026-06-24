---
ingested: 2026-06-04
source_type: plan
author: Claude Agent (direction + approval by Jay Honnold)
synthesis: done
---

# node-tlcv — clean accessible names for broadcast cards, hide decorative boards

> Internal plan, authored and executed on 2026-05-24.
> **Outcome:** implemented and shipped as PR
> [#158](https://github.com/jhonnold/node-tlcv/pull/158) on branch
> `fix/board-a11y-screen-reader` (squash-merge commit `b6517aa`). Verified
> against live broadcast `16071` (curl of server-rendered HTML + chessboardjs
> source analysis + a Playwright DOM check). Template-only change, three `.ejs`
> files. See [[node-tlcv]].

## Context

A reported accessibility issue (from another agent's review): on the home /
broadcasts listing (`/`, rendered by `views/pages/broadcasts.ejs`), each card's
mini board renders ~32 individual `<img>` piece elements with single-letter
`alt` text (`"b"`, `"r"`, `"p"`, `"N"`…). Because that board sits **inside the
card's `<a>` link**, the link's accessible name is computed from those alts
first — so a screen-reader user hears a meaningless stream of ~32 junk letters
before any real info, on every card.

Goal: make each card announce a clean, useful name (e.g.
*"Catalyst Gauntlet — Catalyst v3.0.0 vs Stockfish 6 64 POPCNT, move 2"*) and
make the decorative board silent to assistive tech. Same "board is decorative"
treatment applied to the in-game view.

## Key findings that shaped the fix

- **The home cards are the real offender, not the in-game board.** The home
  card boards are **static server-rendered HTML** (`broadcasts.ejs`), not
  chessboardjs — `public/js/broadcasts.ts` only inits the theme. Each piece was
  `<img … alt="<%= ch %>" />` (single letters), all wrapped by
  `<a href="/:port" class="broadcast-card">`.
- **The in-game board does *not* spew letters.** It's a chessboardjs board in
  `<div id="board">`; chessboardjs already hardcodes `alt=""` on pieces
  (`buildPiece()`, `node_modules/chessboardjs/www/js/chessboard.js:655`). It is
  also not inside an `<a>`, so the link-name pollution never applied there. The
  only noise it adds is `showNotation` labels, so the "same treatment" there is
  just marking the decorative region `aria-hidden`.
- **A static `aria-hidden` survives chessboardjs re-renders.** chessboardjs sets
  the container's innerHTML once (`containerEl.html(...)`, chessboard.js:1663)
  then on every position update only swaps the *inner* board element's contents
  (`boardEl.html(...)`, chessboard.js:979). Attributes on the `#board` /
  `#*-pv-board` **container** elements are never touched — so a template-level
  `aria-hidden="true"` is robust and needs no JS.
- **All label data is already in the EJS context.** The `/` route
  (`src/routes/index.ts`) already passes `site`, `white`, `black`, `moveCount`
  per broadcast. The `aria-label` is built inline in the template; no new data
  plumbing.

## Change (3 files, template-only)

No TypeScript or build-config changes.

- **`views/pages/broadcasts.ejs`** (primary): a small `cardLabel()` helper in
  the existing `<% %>` block builds `"<site> — <white> vs <black>, move <n>"`
  (drops the dash when `site` is empty); the card `<a>` gets
  `aria-label="<%= cardLabel(broadcast) %>"` (EJS `<%=` auto-escapes, so player
  names with quotes are safe); the decorative `.mini-board` gets
  `aria-hidden="true"`; the piece `<img>` `alt` set to `""`.
- **`views/pages/index.ejs`**: `aria-hidden="true"` on the in-game `#board` and
  the `#arrow-board` canvas.
- **`views/partials/info-card.ejs`**: `aria-hidden="true"` on the decorative PV
  boards (`#*-pv-board`, two per page).

The boards here are decorative — game state stays available to assistive tech
via the move list and the text-based player info cards — so hiding them is
simpler and correct. No per-square ARIA / role grid was added (out of scope;
revisit only if a fully navigable accessible board is later wanted).

## Verification (live broadcast `16071`)

The conclusion was reachable **without a browser**, which is worth noting:

- **Home page** is 100% server-rendered, so `curl http://localhost:8082/`
  returns exactly what clients get. Confirmed the card
  `<a aria-label="Catalyst Gauntlet — Catalyst v3.0.0 vs Stockfish 6 64 POPCNT,
  move 2">`, `.mini-board aria-hidden="true"`, and `25 alt=""` with zero
  non-empty alts.
- **Game page** via curl showed `#arrow-board`, `#board`, and both `#*-pv-board`
  carrying `aria-hidden="true"`.
- The only thing curl can't see — the in-game board *after* chessboardjs
  populates it — was settled by **reading the library source** (innerHTML-only
  re-render ⇒ container attribute persists). A **Playwright** pass then
  empirically confirmed it: after 25 pieces rendered, `#board` still had
  `aria-hidden="true"` and all piece alts were empty — matching the prediction.
- The card `<a>`'s `aria-label` definitively sets its accessible name per ARIA
  (aria-label overrides child content), so the 32-letter stream is gone.
- `npm run build` (webpack + tsc) passes. (EJS is rendered at runtime, not part
  of the build, so the build only catches TS/webpack breakage.)

Verification ran from a git worktree per `CLAUDE.local.md`: backend `PORT=8082`
(8081 was already bound by another instance — picked another, per the
worktree-collision rule) against a distinct live broadcast (`16071`, since the
main checkout watches `16061`).

## Related

- [[node-tlcv]] — the service; home cards live in
  `views/pages/broadcasts.ejs` (+ `public/css/_broadcasts.scss`)
- [[2026-05-24-node-tlcv-mobile-card-overflow-fix]] — sibling fix to the same
  home-card markup (the responsive/overflow side); this one is the a11y side
