# Piece set credits

Each subdirectory holds one chess piece set (12 SVGs named `wK.svg`…`bP.svg`, i.e.
lowercase color + uppercase piece, the chessboardjs `{piece}` convention).

- **classic** — the viewer's original/default set.
- **livius**, **meridian**, **meridian_shaded** — by Martin Sedlák, released under
  **CC0 / public domain**. Source: https://github.com/kmar/chess_svg_piece_sets
  (added per https://github.com/jhonnold/node-tlcv/issues/162). Upstream files use
  lowercase names (`wk.svg`, `bb.svg`); they were renamed to `wK.svg`/`bB.svg` here.
- **claude**, **claude_minimal**, **claude_glyph**, **claude_playful** — four
  Claude-branded sets authored in-repo (no upstream source). All share a coral
  accent (`#D97757`, Anthropic brand coral) and a 45×45 viewBox matching the
  classic set. `claude` is a Staunton-style silhouette with an asterisk-style
  jewel on the king; `claude_minimal` is flat geometric primitives;
  `claude_glyph` is typographic (SAN letter per piece); `claude_playful` is a
  cartoony silhouette variant.
