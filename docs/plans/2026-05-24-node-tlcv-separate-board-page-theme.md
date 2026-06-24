---
source_url: https://github.com/jhonnold/node-tlcv/pull/163
ingested: 2026-06-04
source_type: plan
author: Claude Agent (direction + approval by Jay Honnold)
synthesis: done
migrated_from: library/imports/plans/2026-05-24-node-tlcv-separate-board-page-theme.md
---

# node-tlcv — separate board theme from page theme

> Internal plan, authored and executed on 2026-05-24.
> **Outcome:** implemented and shipped as PR
> [#163](https://github.com/jhonnold/node-tlcv/pull/163) (squash-merge commit
> `4d16c54`). Frontend-only. Verified end-to-end in a real browser (Playwright)
> against a live broadcast before merge. Directly evolves
> [[2026-05-24-node-tlcv-dynamic-custom-themes]]. See [[node-tlcv]].

## Context

A feature request: the chess **board's** theme and the **rest of the page's**
theme should not overlap. Concretely, "values like *Accent* are used on both the
board and the page."

The real coupling was a single derivation introduced by the dynamic-custom-themes
work: the board's last-move highlight (`--highlightColor`) was **auto-derived
from `--primaryColor`** (the page Accent) inside `deriveDependents()` in
`components/theme/index.ts`. Consequences:

- Changing the page accent silently recolored the board highlight.
- A user who hand-picked a board highlight had it **clobbered** the moment they
  edited any other token, because `setColor()` always re-runs
  `deriveDependents()`.

Beyond that one derivation the board's other colors (square light/dark, the three
arrow colors, piece colors) were **already independent tokens** — they were just
**interleaved with page tokens** in the editor's flat essential/advanced groups,
so there was no visual or conceptual separation.

## Decisions (via AskUserQuestion)

1. **Independent token groups under one selector** (not a separate board
   selector). Keep the single Light/Dark/Custom preset selector; split the editor
   into distinct **Page** and **Board** sections; make every board color fully
   independent (no derivation from / sharing of page tokens). The bigger
   alternative — a board palette with its own presets + localStorage, mixable
   with any page look — was declined as out of proportion.
2. **Board-only scope.** Graphs stay part of the *page* theme (the kibitzer eval
   line keeps reading `--primaryColor`). The board↔page overlap was the ask;
   graph↔page sharing was explicitly left alone.

Scope of "board theme" = the chessboard's visual identity: light/dark squares,
last-move highlight, the three move arrows, and (already preset-only) piece
colors. Structural dividers around board widgets (`#board-caption`,
`#kibitzer-bar` borders that use `--surfaceColorHover`) stay page chrome by
design — frame, not board.

## Changes (4 files, frontend-only)

- **`components/theme/presets.ts`** — replaced the flat `TokenGroup`
  (`essential | advanced`) with **two orthogonal dimensions**:
  `TokenSection` (`'page' | 'board'`) × `TokenTier` (`'essential' | 'advanced'`).
  `TokenMeta` now carries `{key, label, section, tier}`. Regrouped the `TOKENS`
  array by section and **promoted `--highlightColor` to an editable Board /
  essential token**. Preset color *values are unchanged* — the authored
  highlights (`#52b1dc6b` light, `#99d69e66` dark) simply become editable instead
  of derived.
  - **Page / essential:** `--primaryColor`, `--backgroundColor`,
    `--surfaceColor`, `--textColor`.
  - **Page / advanced:** `--secondaryColor`, `--graphWhiteColor`,
    `--graphBlackColor`, `--evalBarWhite`, `--evalBarBlack`.
  - **Board / essential:** `--boardLight`, `--boardDark`, `--highlightColor`.
  - **Board / advanced:** `--whiteArrowColor`, `--blackArrowColor`,
    `--kibitzerArrowColor`.
- **`components/theme/index.ts`** — **dropped the `--highlightColor` derivation**
  from `deriveDependents()`; it now recomputes only the two page hover tokens
  (`--primaryColorHover`, `--surfaceColorHover`). `buildRows()` rewritten to
  render into per-`section`/`tier` containers
  (`#theme-page-essential`, `#theme-page-advanced`, `#theme-board-essential`,
  `#theme-board-advanced`). `syncControls()` unchanged (iterates `TOKENS` by key).
- **`views/partials/theme-modal.ejs`** — split the editor body into labeled
  **Page** and **Board** `<section>`s, each with its own collapsed
  `<details class="theme-advanced">`. Note text changed from "Hover **and
  highlight** colors are calculated automatically…" to hover-only.
- **`public/css/_theme-modal.scss`** — added `.theme-section` /
  `.theme-section-title` (heading spacing + a divider between Page and Board).

No rename: `--highlightColor` kept its name (renaming to `--boardHighlightColor`
would have churned `_chessboard.scss`, `_variables.scss`, presets, and the type
union for no functional gain). `_variables.scss` needed no change — its
`--highlightColor: #52b1dc6b` fallback already matched the light preset. No
persistence/migration needed: `--highlightColor` was already a key in every
preset and in saved custom palettes.

## Verification (Playwright against a live broadcast)

Ran a dev instance from the git worktree per `CLAUDE.local.md` (`PORT=8081`,
`TLCV_PASSWORD` inline, `TS_NODE_TRANSPILE_ONLY=true` to bypass the pre-existing
`@types/ssh2` backend tsc conflict; `config/config.json` untouched). Drove the
real color inputs through their `input`/`change` handlers and read computed
custom properties:

- Editor shows separate **Page** and **Board** sections, each with its own
  Advanced collapse; last-move highlight is an editable Board token.
- **Editing the page Accent (→ red) did NOT change the board highlight** (stayed
  `#52b1dc6b`) — the core decoupling. Page hover still re-derived
  (`#003eaa` → `#cc0000`).
- **Editing the board highlight survived a later unrelated page edit** (the old
  clobbering bug is gone): set to `#00ff006b`, stayed `#00ff006b` after editing
  Background; alpha preserved; persisted to `tlcv.customTheme`.
- Page-advanced held Secondary/Graph/Eval-bar; Board-advanced held the three
  arrows.
- Light/Dark preset switching applied the hand-authored highlights — Dark
  `#99d69e66`, notably **not** derived from the dark accent `#9fc0a2`.
- No theme-related JS console errors (only sandbox-blocked Google Analytics).

Frontend `npm run prebuild` (webpack/ts-loader/SCSS) compiled clean; the full
`npm run build` backend `tsc` failure is the unrelated pre-existing `@types/ssh2`
conflict (confirmed identical with changes stashed).

## Supersedes

The [[2026-05-24-node-tlcv-dynamic-custom-themes]] rule that the move-highlight
is **auto-derived** (accent at `6b` alpha) — that derivation is removed.
`--highlightColor` is now an independent, hand-authored, user-editable **Board**
token. Only `--primaryColorHover` and `--surfaceColorHover` are still derived,
and both are pure page tokens.

## Related

- [[node-tlcv]] — the service; theming lives in `public/js/components/theme/`
  (`index.ts` + `presets.ts`), `views/partials/theme-modal.ejs`,
  `public/css/_theme-modal.scss` + `_variables.scss`
- [[2026-05-24-node-tlcv-dynamic-custom-themes]] — the system this refactors;
  introduced the token model, the modal, and the highlight derivation now removed
