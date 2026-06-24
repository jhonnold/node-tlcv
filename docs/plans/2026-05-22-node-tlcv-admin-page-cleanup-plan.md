---
ingested: 2026-05-23
source_type: plan
author: Claude Code
synthesis: done
---

> Status: implemented 2026-05-22 on branch `cleanup-admin-page` (commit
> `2a41671`). Plan authored by Claude Code with Jay's direction/approval.
> Related: [[node-tlcv]], [[2026-05-20-node-tlcv-issue-132-plan]] (the
> earlier admin-dashboard-modernization plan this builds on).

# Plan: Clean up the Admin page (`/admin`)

## Context

The `/admin` panel works but looks rough, and it has real **dark-mode regressions**. A browser review (light + dark) surfaced these problems:

- **Dark mode is broken**: broadcast table body rows render white, and the form "cards" render white — both clash with the dark header/background, and the form legend text is nearly invisible where it crosses the white edge.
- **Card-in-a-card**: each add-form `<fieldset>` (bordered) sits inside another bordered/padded card, producing a heavy double outline.
- **Width mismatch**: tables/sections are `max-width: 900px` but `.admin-form` is `max-width: 500px`, leaving a large dead gutter under the Kibitzers/Webhooks forms.
- **Overly tall single column**: every field is full-width and stacked, so short numeric fields (Priority/Threads/Hash/Port) each eat a full row.
- **Unstyled empty states**: bare `<p>No kibitzers configured.</p>`.
- **Dead responsive intent**: the tables carry `data-label` attributes for a mobile card layout that was never wired up; `_responsive.scss` has no admin rules.

**Root cause of the dark-mode + card-in-card bugs (single cause):** the admin tables and forms never reset mini.css, so their cell/form backgrounds use mini.css's hardcoded light colors that ignore the theme's CSS custom properties. The `results`/`games` tables avoid this entirely by using the `mini-table-reset` mixin + token-only colors, which is why they need **zero** dark-theme overrides. Applying the same approach to admin fixes dark mode almost for free.

**Intended outcome:** a tidy, theme-correct, responsive admin page that reuses the existing table/mixin patterns — no behavior changes. Scope is **admin only** (the broadcasts page was reviewed and is clean). Ambition: **conservative cleanup** (fix bugs, unify widths, 2-column form grids, styled empty states, mobile support) — keep the stacked-section structure; no badges/visual refresh.

## Hard constraint: don't break `admin.ts`

`public/js/admin.ts` drives the page via **ID lookups** and **event delegation on classes/`data-*`**, not structural traversal — so markup can be reorganized freely **as long as these are preserved verbatim**:

- IDs: `#add-new`, `#connection`, `#kibitzer-form`, `#kibitzer-editing-id`, `#kibitzer-type`, `#kibitzer-priority`, `#kibitzer-engine-path`, `#kibitzer-threads`, `#kibitzer-hash`, `#ssh-fields`, `#kibitzer-host`, `#kibitzer-port`, `#kibitzer-username`, `#kibitzer-private-key-path`, `#kibitzer-form-legend`, `#kibitzer-submit`, `#kibitzer-cancel`, and the `#webhook-*` equivalents incl. `#webhook-event-started` / `#webhook-event-finished`.
- Classes: `.close`, `.kibitzer-edit`, `.kibitzer-remove`, `.webhook-edit`, `.webhook-remove`.
- All `data-*` on the edit/close buttons (full set — missing one breaks the edit-populate flow).
- **`#ssh-fields` must stay a single wrapper** around all four SSH inputs (toggled via `$('#ssh-fields').toggle(isSsh)`). Wrapping each inner field in a `.field` div is fine; they must remain inside `#ssh-fields`.
- Legend/submit text is set in JS via `.text()`, so it's safe to restyle.

## Changes

### 1. `public/css/_admin.scss` — rewrite using existing mixins + tokens

- Add `@use 'mixins' as *;` at the top.
- **Unify width**: drop the `.admin-form { max-width: 500px }`; let forms share the section width. Use one shared admin content width (keep ~900px) on `.admin-section` and `.admin-divider`.
- **Tables** — replace the hand-rolled mini.css overrides with the project pattern (mirrors `_results.scss` / `_games.scss`):
  - `@include mini-table-reset;` on `.admin-table` (this sets `th,td { background: transparent }`, which is what makes cells inherit the token-based table background → fixes the white-rows-in-dark-mode bug).
  - `@include sticky-th-header;` on `thead th` for a dark-safe, consistent header.
  - Row separators via `border-bottom: 1px solid var(--surfaceColorHover)`; cell padding `6px 8px`.
  - Keep the rounded surrounding card on the table via token colors (`var(--surfaceColor)` / `var(--surfaceColorHover)`).
- **Kill the card-in-card**: neutralize mini.css's default `form` card chrome — `form.admin-form { background: none; border: 0; padding: 0; }`. Make the `<fieldset>` the **single** card (token bg/border, `var(--universal-border-radius)`, padding). The connection form (`#add-new`, no fieldset) becomes a simple inline row (label + input + button), not a card.
- **2-column form grid**: lay the fieldset out as `display: grid; grid-template-columns: 1fr 1fr; gap`. Short fields (Type, Priority, Threads, Hash, Port) occupy one cell; full-width fields (Engine Path, Host, Username, Private Key Path, Name, URL, Ports, Events) span both via a `.field--full` modifier. Submit/cancel row spans full width.
- **Empty states**: add `.admin-empty { @include table-status-message; }`.
- Prefer tokens over hardcoded px for color/radius; keep `var(--fontFamily)`.

### 2. `views/pages/admin.ejs` — minimal structural edits (IDs/classes/`data-*` unchanged)

- Wrap each `label`+`input`/`select` pair inside the fieldsets in a `<div class="field">` (add `field--full` to the wide ones) so the grid can place them. Keep every `id`/`name`/`data-*` intact. The four SSH fields each get a `.field` wrapper **but stay inside `#ssh-fields`**.
- Wrap the connection form's label/input/button as a simple inline `.field` row.
- Replace bare `<p>No kibitzers configured.</p>` / `<p>No webhooks configured.</p>` with `class="admin-empty"`.
- Add a `—` fallback for the empty Site cell: `<%= broadcast.game.site || '—' %>`.

### 3. `public/css/_responsive.scss` — wire up admin mobile

- Under the existing `@media (max-width: 767px)` block:
  - Collapse the form grid to one column (`grid-template-columns: 1fr`).
  - Apply `@include mini-table-mobile-reset;` to `.admin-table` and activate the **already-present** `data-label` attributes for a stacked card layout: `td::before { content: attr(data-label); ... }` (follow the move/results/games mobile precedent).

### 4. `public/css/dark-theme.scss` — expected NO changes

Because the rewrite is token-only, the existing `:root` dark overrides should cover admin automatically (same reason `results`/`games` need nothing here). **Add a selector override only if** a hardcoded mini.css color visibly leaks through after the reset — to be confirmed during browser verification, not assumed up front.

> Note: `dark-theme.scss` is a standalone webpack entry with no `@use` of partials — if any override is needed, hand-write it with raw properties (no mixins), matching the existing `.card` / `#chat-area input` pattern.

## Verification

Two-commit suggestion: **(a)** dark-mode + card-in-card fix (correctness), then **(b)** layout grid/width/responsive (design).

1. `npm run build` — must pass (tsc + webpack; this is the project's only "test").
2. Browser check via Playwright MCP against the running dev server (`http://localhost:8080/admin`, basic-auth):
   - **Light + dark**, full-page screenshots. Confirm: no white table rows in dark mode, single (not double) form card, legend legible, forms and tables share the same width.
   - **Populated tables**: add a dummy webhook (and a local kibitzer) via the UI to render the table rows, confirm styling, then **exercise the Edit button** to confirm the form still populates (proves the `data-*` contract survived), then Remove to clean up.
   - **Empty states**: confirm the styled "No … configured." message renders.
   - **Mobile**: `browser_resize` to ~375px wide; confirm the form grid collapses to one column and the tables render as readable `data-label` cards.
3. Clean up review artifacts before committing: remove screenshots and the `.playwright-mcp/` directory from the working tree.

## Files

- `public/css/_admin.scss` — rewrite (mixins + tokens)
- `views/pages/admin.ejs` — `.field` wrappers, `.admin-empty`, Site fallback
- `public/css/_responsive.scss` — admin mobile grid + table cards
- `public/css/dark-theme.scss` — only if a leak is observed (likely untouched)

## Outcome (as implemented)

All four verification dimensions passed (light, dark, edit-flow, mobile). The dark-mode fix required **zero** changes to `dark-theme.scss`, confirming the root-cause analysis. Committed as `2a41671` ("fix: clean up admin page styling and dark-mode regressions"), 3 files changed.

## See also

- [[node-tlcv]] — the project this plan targets (live chess viewer backend powering ccrl.live)
- [[2026-05-20-node-tlcv-issue-132-plan]] — earlier plan to modernize the admin dashboard UI (header/footer, theme, styling)
