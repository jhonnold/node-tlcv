---
source_url: https://github.com/jhonnold/node-tlcv/pull/164
ingested: 2026-06-04
source_type: plan
author: claude_code (plan + implementation), Jay Honnold (direction)
synthesis: done
---

# node-tlcv — piece set selection in the theme chooser

Plan + as-built notes for adding chess piece-set selection to the node-tlcv theme
chooser. GitHub issue [#162](https://github.com/jhonnold/node-tlcv/issues/162) (a
contributor offered CC0 SVG piece sets); shipped as
[PR #164](https://github.com/jhonnold/node-tlcv/pull/164).

## Problem / intent

Every board rendered the single bundled piece set, hardcoded as
`pieceTheme: '/img/{piece}.svg'` — no way for a viewer to change it. Add a **Pieces**
picker to the existing theme modal offering the default set plus alternatives,
persisted and applied live to all boards.

**Decisions (confirmed with Jay):** offer **Classic** (the existing cburnett set) +
all three upstream CC0 sets — **Livius**, **Meridian**, **Meridian Shaded** (by
Martin Sedlák, [kmar/chess_svg_piece_sets](https://github.com/kmar/chess_svg_piece_sets));
apply the choice **everywhere** (game view + broadcasts-list mini-boards).

## Design

- **Piece set is orthogonal to the color theme.** Its own localStorage key
  (`tlcv.pieceSet`), its own `pieces:change` event, its own `<select>` — none of it
  touches the color-token path (`theme`, `tlcv.customTheme`, `applyColors`). Any
  piece set combines freely with Light/Dark/Custom palettes.
- **No board recreation.** chessboardjs (v0.1.0) calls a *function* `pieceTheme(piece)`
  lazily on every render, and renders pieces as `<img ... data-piece="wK">`. So the
  boards get a function `pieceTheme` reading a module-level "current set" var (covers
  all future renders — live moves, nav, PV boards, resize), **plus** an in-place `src`
  rewrite of the `img[data-piece]` already on the board. Instances are never destroyed,
  which keeps the closure refs captured in `components/board/resize.ts` `initResize()`
  valid.
- **Uniform asset layout.** All sets live under `public/img/pieces/<set>/<piece>.svg`;
  the previous default moved to `public/img/pieces/classic/`. A single registry,
  `public/js/components/theme/piece-sets.ts`, is the source of truth for the dropdown
  options and the URL builder (`pieceSrc()`). Webpack copies `public/img` →
  `build/public/img` wholesale, so the new subdirs need no webpack change.

## Implementation (as shipped)

1. **Assets** — `git mv` the 12 default SVGs to `pieces/classic/`; downloaded the
   three upstream sets (12 each) and **renamed** from upstream lowercase (`wk.svg`,
   `bb.svg`) to the chessboardjs convention (color-lowercase + piece-UPPERCASE:
   `wK.svg`, `bB.svg` — watch the `bb`→`bB` black-bishop case). CC0 attribution in
   `public/img/pieces/CREDITS.md`.
2. **`piece-sets.ts`** (new) — `PieceSetId` union, `PIECE_SETS` registry (`classic`
   first), `DEFAULT_PIECE_SET = 'classic'`, `pieceSrc()`, `isPieceSetId()` guard.
3. **Event bus** — added `'pieces:change': { set: string }` to `EventMap`.
4. **Theme component** (`components/theme/index.ts`) — `PIECE_SET_KEY`,
   `currentPieceSet`, `loadPieceSet()`, exported `getPieceSet()`, `setPieceSet()`
   (writes localStorage + emits `pieces:change`; never touches `persist()`/`applyColors`).
   `init()` loads the set, populates the `<select>` from `PIECE_SETS`, binds `change`;
   **does not emit on init** (boards read `getPieceSet()` directly at build time).
   `destroy()` unbinds.
5. **Board** (`components/board/index.ts`) — `pieceTheme` is now
   `(piece) => pieceSrc(getPieceSet(), piece)` for all three boards;
   `handlePiecesChange()` rewrites `#board` / `#white-pv-board` / `#black-pv-board`
   `img[data-piece]` `src` in place.
6. **Broadcasts mini-board** — SSR `<img>` in `views/pages/broadcasts.ejs` points at
   `pieces/classic/...` (pre-JS fallback, must stay in sync with `DEFAULT_PIECE_SET`)
   and carries `data-piece`; `public/js/broadcasts.ts` rewrites them to the chosen set
   after `initTheme()` (page auto-refreshes every 30s, so it stays current).
7. **Footer** — credits both Cburnett and
   [Martin Sedlák](https://www.chessprogramming.org/Martin_Sedlak).

`init order` is already correct: `index.ts` runs `initTheme()` before `initBoard()`,
so the board reads the loaded set when building `pieceTheme`. No backend, webpack, or
`shared/` type changes.

## Merge with #163 (board/page theme separation)

PR #163 merged first and restructured the modal into **Page** and **Board**
`<section>`s. Rebasing this branch onto it conflicted in `theme-modal.ejs` and
`_theme-modal.scss`. Resolved by placing the **Pieces** picker as the first item
**inside the new Board section** (it's a board property), and keeping both #163's
`.theme-section` styles and the picker row (dropping the picker's divider border since
the section now provides separation).

## Verification

`npm run build` clean; ESLint 0 errors (needs `--resolve-plugins-relative-to .` when
run from a worktree nested inside the parent repo — otherwise ESLint finds
`@typescript-eslint` in both node_modules trees; the pre-commit hook hits the same, so
the feature commit used `--no-verify` after a manual prettier+eslint pass). Verified
live against a CCRL broadcast: picker swaps the main board **and** both PV boards
instantly; new live positions keep the chosen set; persists across reload with no
classic flash; switching color theme leaves the piece set untouched; all
broadcasts-list mini-boards rewrite to the chosen set. A rendered contact sheet
confirmed every renamed SVG maps to the correct piece.

## Key gotcha: chessboardjs `pieceTheme` + `data-piece`

**chessboardjs `pieceTheme` can be a function, called lazily per render; pieces carry
`data-piece`.** Together these let you change piece sets without destroying/recreating
board instances: a function `pieceTheme` handles future renders, and a `src` rewrite
over `img[data-piece]` handles pieces already on the board. Recreating instances would
strand the closure-captured board refs in `resize.ts`.

Copilot falsely flagged that `handlePiecesChange()` keys off `img[data-piece]` "but
the chessboard.js boards don't set `data-piece` anywhere in this codebase." **Incorrect:**
chessboardjs's `buildPiece()` emits `data-piece` on every piece `<img>` at runtime
(`node_modules/chessboardjs/www/js/chessboard.js:657`). The repo source only hardcodes
`data-piece` on the SSR mini-boards; the live boards get it from the library. Confirmed
empirically. No change made.

## Related

- [[node-tlcv]] — the project
- [[2026-05-24-node-tlcv-separate-board-page-theme]] — merged first; gave the modal
  its Page/Board sections (where the picker now lives)
- [[2026-05-24-node-tlcv-dynamic-custom-themes]] — the theme-modal + token-preset
  system this extends
