---
ingested: 2026-06-04
source_type: plan
title: "node-tlcv — scale down Meridian piece sets to match Classic"
author: "Claude (drafted), Jay Honnold (direction + approval)"
synthesis: done
---

# node-tlcv — scale down Meridian piece sets to match Classic

Internal plan + outcome for the fix that resized the Meridian / Meridian
Shaded chess piece sets so they render at the same on-square size as
Classic. Follow-up to the piece-set selection feature
([[2026-05-24-node-tlcv-piece-set-selection]], PR #164). Shipped as
[PR #167](https://github.com/jhonnold/node-tlcv/pull/167) on
`fix/meridian-piece-size`. See [[node-tlcv]].

## Problem

The two Meridian sets added in #164 rendered noticeably larger than
Classic within each board square. Pieces are served as
`<img src="/img/pieces/<set>/<piece>.svg">` and scaled by CSS to fill the
square (`pieceTheme` in `public/js/components/board/index.ts`), so the
*apparent* size of a piece is governed by how much of its **own SVG
canvas** the glyph occupies — not by the canvas pixel dimensions.

Classic glyphs are drawn on a `45×45` canvas; Meridian glyphs on `64×64`.
Neither Meridian set declared a `viewBox` (coordinate system `0..64`), and
the glyphs filled ~90% of that canvas vs ~75% for Classic.

## Root cause (measured)

Rendered glyph bounding boxes via the browser, expressed as glyph height ÷
canvas (the dimension that controls on-square size, since the whole canvas
maps to the square):

| Piece | Classic (÷45) | Meridian (÷64) | Match factor |
|---|---|---|---|
| King height | 0.747 | 0.835 | 0.747/0.835 = **0.894** |
| Pawn height | 0.678 | 0.750 | 0.678/0.750 = **0.904** |

Meridian fills ~10–12% more vertical space. A uniform ~0.89 scale lands
both reference pieces almost exactly on Classic. Meridian and Meridian
Shaded share the same outline paths, so one factor covers both.

## Approach

Add a symmetric, padded `viewBox="-4 -4 72 72"` to every Meridian /
Meridian Shaded SVG (keeping `width`/`height` at `64px`). This maps a
72-unit window — centered on the existing `32,32` canvas centre — into the
same intrinsic size, scaling all content to `64/72 ≈ 0.889` and
re-centering it in place. Glyph centres were already ≈`(32, 32)`, so
symmetric padding scales each piece down without shifting it.

### Why `viewBox` (not CSS/JS)

- It is a pure coordinate-mapping change — it touches **no** path
  coordinates or gradient definitions, so Meridian Shaded's
  `userSpaceOnUse` linear gradient stays aligned.
- It fixes every render path at once (main board, mini boards in
  games/replay/broadcasts, and the pre-JS SSR fallback) with **zero**
  TypeScript/SCSS changes.
- It is literally "scale the piece down within its square," matching the
  request.

No application code needed — `components/theme/piece-sets.ts` and
`components/board/index.ts` resolve and render these SVGs unchanged.

## Changes

24 static asset files, one added attribute (`viewBox="-4 -4 72 72"`) each:

- `public/img/pieces/meridian/{wK,wQ,wR,wB,wN,wP,bK,bQ,bR,bB,bN,bP}.svg`
- `public/img/pieces/meridian_shaded/{wK,…,bP}.svg`

Classic and Livius untouched (Livius already sits at a comfortable size).

## Outcome (verified)

Post-fix measurement confirmed the target:

| Piece | Classic | Meridian before | Meridian after |
|---|---|---|---|
| King height | 0.747 | 0.835 | **0.742** |
| Pawn height | 0.678 | 0.750 | **0.667** |
| Meridian Shaded King | — | 0.835 | **0.742** (gradient intact) |

Also verified live: `dev-server` + `dev-public` against broadcast 16061,
switching the Theme → Pieces dropdown between Classic / Meridian /
Meridian Shaded. Meridian pieces now sit at the Classic scale with proper
margins; Meridian Shaded keeps its gradient shading.

`npm run prebuild` (webpack) compiles cleanly. The full `npm run build`
still surfaces the pre-existing nested `@types/ssh2`/`@types/node`
duplicate type errors — unrelated to this change (no TS touched); also
noted in [[2026-05-24-node-tlcv-archive-meta-fallback]].

## Reusable takeaway

To resize an SVG glyph **within** its square without editing paths or
breaking gradients, add/expand a symmetric `viewBox` rather than scaling
in CSS. A padded `viewBox` of side `64/f` centered on the canvas centre
shrinks content by factor `f` and re-centers it; it works everywhere the
asset is used, including non-JS render paths.
