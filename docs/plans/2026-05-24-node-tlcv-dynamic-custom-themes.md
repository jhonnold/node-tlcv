---
ingested: 2026-06-04
source_type: plan
author: Claude Agent (direction + approval by Jay Honnold)
synthesis: done
migrated_from: library/imports/plans/2026-05-24-node-tlcv-dynamic-custom-themes.md
---

# node-tlcv — dynamic custom themes

> Internal plan, authored and executed on 2026-05-24.
> **Outcome:** implemented and shipped as PR
> [#160](https://github.com/jhonnold/node-tlcv/pull/160) on branch
> `feat/dynamic-custom-themes` (squash-merge commit `1273bf5`). Frontend-only.
> Verified end-to-end in a real browser (Playwright) against live broadcasts,
> then a max-effort critical review surfaced bugs that were fixed in a second
> commit before merge. See [[node-tlcv]].

## Context

The viewer shipped two fixed themes. Light lived as the `:root` token block in
`public/css/_variables.scss`; **Dark was a separate webpack entry**
(`dark-theme.scss`) that re-declared the same `:root` tokens plus a few
selector-level overrides, injected/removed at runtime as a `<link
href="/dark-theme.css">` by `components/theme/index.ts`, toggled by one header
button and persisted in `localStorage.theme`. Because ~15 colors already flowed
through CSS custom properties, the system was one step from arbitrary
user-defined palettes. The ask: let a user **pick a preset and override
individual colors** from a modal; migrate Light/Dark into a shared preset model;
replace the toggle.

Decisions made up front (via AskUserQuestion): **modal dialog** (not a popover or
settings tab), **curated essentials + an advanced group** (not all tokens flat),
and **ship only Light + Dark** presets.

## Architecture of the new system

Themes are now applied **entirely in JS** by setting CSS custom properties on
`document.documentElement` (`style.setProperty(...)`). The runtime `<link>`
injection and the standalone `dark-theme.css` bundle are **gone**.

- **`public/js/components/theme/presets.ts`** (new) — the canonical token model:
  a `ThemeColors` map type, a `TOKENS` metadata array (`{key, label, group}`)
  that drives the editor, and `PRESETS` (full Light + Dark token maps).
  `_variables.scss` keeps the Light values as the pre-JS fallback and must stay
  in sync with the `light` preset.
- **`public/js/components/theme/index.ts`** (rewritten) — `applyColors()`
  setProperty loop; persistence; the modal wiring; still emits `theme:change`
  (debounced for live edits) so `components/board` and `components/graphs`
  re-read CSS vars / recreate the chart.
- **`views/partials/theme-modal.ejs`** + **`public/css/_theme-modal.scss`** (new)
  — modal shell included from `header.ejs` (so it's on all three pages); the
  component builds the color rows from `TOKENS` into `#theme-essential` /
  `#theme-advanced`. Header `#theme-toggle` now opens the modal (palette icon).

### Token groups

- **Essentials (editable):** `--primaryColor`, `--backgroundColor`,
  `--surfaceColor`, `--textColor`, `--boardLight`, `--boardDark`.
- **Advanced (editable):** `--secondaryColor`, `--graphWhiteColor`,
  `--graphBlackColor`, `--evalBarWhite`, `--evalBarBlack`, plus the three
  **board arrow** tokens `--whiteArrowColor` / `--blackArrowColor` /
  `--kibitzerArrowColor`.
- **Preset-only / derived (not editable):** `--cardTextColor`,
  `--pieceWhiteColor`, `--pieceBlackColor`, `--kibitzerColor` (`var(--textColor)`),
  `--chatFontWeight`, and the three **auto-derived** tokens below.

### Auto-derived hover/highlight (the key UX decision)

Jay's concern: hiding the hover/highlight colors in "advanced" would let users
build incoherent themes (set a red accent, but the hover stays the preset's
green). Fix: **for custom palettes these are computed from the essentials, not
hand-tuned**, and removed from the editor entirely. Presets keep their authored
values; only custom derives.

- `--primaryColorHover` = a **luminance-aware** shade of `--primaryColor`:
  shift toward white on a dark background, toward black on a light one (so hover
  gains contrast in either direction). `--surfaceColorHover` likewise from
  `--surfaceColor`, but with a subtle alpha on light (`40`) and a solid lift on
  dark — *not* the surface's own (high) alpha, which would make hovers heavy.
- `--highlightColor` = the accent at `6b` alpha (matches the presets' authored
  overlay; the move-highlight follows the accent).
- Verified empirically: purple accent `#7b2ff7` → hover `#6226c6` on light
  (darker), `#9559f9` on a dark base (lighter); hover actually renders on the
  Send button.

### Persistence

`localStorage.theme` holds the preset name `light | dark | custom` (legacy
`light`/`dark` values still valid — backward compatible). `tlcv.customTheme`
holds the full custom color map; `tlcv.themeBase` the preset a custom palette
derives from (the "Reset to preset" target). The saved custom map is **cleared
when switching back to a preset**, so re-selecting "Custom" starts from the
current preset rather than resurrecting a discarded palette.

### Alpha handling

`<input type="color">` only edits `#rrggbb`. For tokens carrying alpha
(`--surfaceColor`, `--surfaceColorHover`, `--highlightColor`, arrows), the editor
re-appends the existing 2-digit alpha suffix when writing, so translucency is
preserved (e.g. editing `#ffffff8c` → `#abcdef8c`).

## Migration: dark theme is now purely token-driven

`dark-theme.scss` was deleted. Its selector-level rules turned out to be **mostly
redundant** — `a:link/:visited`, `a.primary.button`, `button.primary`
(already token-based in `_base.scss`), `.tab-btn.active` (`_tabs.scss`),
`.highlight` / `.info-board` (`_chessboard.scss` / `_info-area.scss`). Only the
**hardcoded** values that genuinely differed by theme needed new tokens:

- `.card` / `.pv` / `#chat-area input` text (`#f2f5f3` in dark) → `--cardTextColor`
  (light `#342f3a`).
- `.pc-black` (`#777` dark / `#222` light) → `--pieceBlackColor`; `.pc-white`
  (`#fff`) → `--pieceWhiteColor`.
- The dark-only `font-weight: 300` on chat/PV → **`--chatFontWeight`** token
  (`500` light / `300` dark).

Out of scope (left hardcoded, no behavior change): resize-handle color
(`_layout.scss`), focus-mode background (`_focus.scss`), replay banner whites
(`_replay.scss`).

## Board arrows became theme tokens (and fixed a latent bug)

Arrow colors were hardcoded JS constants in `components/board/index.ts`, drawn on
the `#arrow-board` canvas via `ctx.fillStyle`. They're now read live from the
three arrow tokens via `getCssVar()` at draw time (with light-preset fallbacks).
This **fixed a latent bug**: `drawArrows()` chose the kibitzer arrow color with
`localStorage.theme === 'dark'` — but `theme` can now be `'custom'`, so a
custom-on-dark theme would have used the *light* kibitzer arrow. Reading the
token (seeded from the base preset) fixes it.

## Critical-review fixes (second commit)

A 5-angle max-effort review caught real issues, all fixed before merge:

1. **Escape stole focus site-wide**: `closeModal()` ran `$('#theme-toggle').trigger('focus')` on *every* Escape, even when the modal was closed. Guard: no-op if the overlay is already hidden.
2. **Light text weight** thinned to 300 → the `--chatFontWeight` token.
3. **Custom surface-hover too opaque** (inherited surface's `8c`) → luminance-based alpha (`40` light / solid dark); highlight keeps `6b`.
4. **Stale custom palette resurfaced** → clear `tlcv.customTheme` on preset switch.
5. Hardening: `clearTimeout(debounceHandle)` in `destroy()`; arrow reads fall back to a default if a token is unset.

## Notable gotchas confirmed during the work

- **`theme:change` consumers re-read CSS vars**: `components/board/index.ts`
  (`handleThemeChange`) and `components/graphs/index.ts` (destroys+recreates the
  chart). Keeping the emit — debounced during live color drags — is mandatory.
- **Prettier rejects inline `type` import modifiers**: the pinned Prettier in the
  Husky/lint-staged hook fails on `import { foo, type Bar } from '...'` even
  though `tsc` accepts it; the commit was blocked until split into a separate
  `import type { Bar }` line.
- **Backend `npm run build` (`tsc`) fails** on a pre-existing `@types/ssh2`
  duplicate-`@types/node` conflict in `node_modules` — unrelated to this
  frontend-only change.

## Verification (Playwright against live broadcasts)

Ran a dev instance from a git worktree per `CLAUDE.local.md`. Confirmed:
Light↔Dark switching recolors the whole UI; building a custom palette from
essentials; auto-derived hover direction; alpha preserved on surface; persistence
across reload; legacy `theme=dark` migration; graphs re-render; live arrow-color
override; all five review fixes.

## Related

- [[node-tlcv]] — the service; theming lives in `public/js/components/theme/`
- [[2026-05-22-node-tlcv-admin-page-cleanup-plan]] — token-only convention this builds on
- [[2026-05-24-node-tlcv-graph-legend-axis]] — sibling Chart.js work; graphs re-read CSS vars on `theme:change`
- [[2026-05-24-node-tlcv-separate-board-page-theme]] — follow-up that split page/board token sections
