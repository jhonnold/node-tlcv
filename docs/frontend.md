# Frontend Architecture

The frontend is TypeScript using jQuery and chessboardjs, bundled with Webpack.

## Templates (EJS)

- `views/pages/` — index, broadcasts, admin
- `views/partials/` — header, info-card, chat

## Components (`public/js/`)

| Module | Purpose |
|--------|---------|
| `index.ts` | Entry point; connects Socket.IO, initializes boards, handles state updates |
| `components/board/` | Board rendering, PV arrow drawing, resize handling |
| `components/chat/` | Chat send/receive, username management |
| `components/game/` | Game state display, player info cards, clock timers |
| `components/games/` | Games list display from CT data stream |
| `components/graphs/` | Chart.js graph rendering (eval, time, etc.) |
| `components/navigation/` | Move list navigation with keyboard support |
| `components/replay/` | Game replay from persistent metadata sidecar files |
| `components/results/` | Tournament results/standings table rendering |
| `components/tabs/` | Tabbed interface (Chat, Moves, Results, Details) |
| `components/theme/` | Theme selector, theme editor modal, presets |
| `components/focus/` | Focus management |
| `utils/` | FEN display, PV text formatting |
| `events/` | Custom event bus for inter-component communication |
| `admin.ts`, `broadcasts.ts` | Standalone page entry points |

## Shared Types (`shared/`)

- `types.ts` — Shared type definitions (SerializedGame, MoveMetaData, KibitzerMeta, etc.)
- `colors.ts` — `colorName()` helper
- `chessboard.d.ts` — Type declarations for chessboardjs

## Styles (`public/css/`)

SCSS compiled by webpack via `sass-loader`. Entry point `main.scss` `@use`s all partials:

- `_variables.scss` — CSS custom properties (`:root` tokens; Light theme baseline / pre-JS fallback)
- `_theme-modal.scss` — Theme editor modal styles
- `_mixins.scss` — Reusable mixins
- `_base.scss` — Global element styles, Google Fonts import
- `_chessboard.scss`, `_layout.scss`, `_board.scss`, `_info-area.scss` — Board/layout
- `_header.scss`, `_footer.scss` — Site chrome
- `_tabs.scss`, `_chat.scss`, `_moves.scss`, `_results.scss`, `_games.scss`, `_graphs.scss`, `_details.scss` — Tab panels
- `_replay.scss`, `_broadcasts.scss`, `_focus.scss` — Feature-specific
- `_responsive.scss` — Mobile breakpoint (max-width: 767px)

## Assets

- `public/img/` — Chess piece SVGs

## Routes

| Route | Purpose |
|-------|---------|
| `/` | List all active broadcasts |
| `/broadcasts` | JSON list of broadcast ports |
| `/:port` | Individual game view |
| `/:port/pgn` | PGN for the game |
| `/:port/result-table` | Tournament results |
| `/:port/result-table/json` | Parsed tournament results as JSON |
| `/:port/games/json` | Game records as JSON (with PGN/meta URLs) |
| `/:port/games/:gameNumber/meta` | Metadata sidecar for a specific game |
| `/admin` | Admin panel (basic auth, username: admin) |
| `POST /admin/new` | Open a new broadcast connection |
| `POST /admin/close` | Close a broadcast connection |
| `POST /admin/kibitzers` | Add a kibitzer transport |
| `DELETE /admin/kibitzers/:id` | Remove a kibitzer transport |
| `POST /admin/webhooks` | Add a webhook |
| `DELETE /admin/webhooks/:id` | Remove a webhook |
| `GET /admin/metrics` | Prometheus metrics scrape endpoint |

## Client-Server Communication (Socket.IO)

| Event | Direction | Purpose |
|-------|-----------|---------|
| `join` | Client → Server | Join a broadcast by port |
| `state` | Server → Client | Initial game state (includes chat history) |
| `update` | Server → Client | Game state updates (moves, scores, times, spectators) |
| `new-chat` | Server → Client | New chat messages |
| `chat` | Client → Server | Client sends chat message |
| `nick` | Client → Server | Client changes username |
| `disconnect` | Client → Server | Client leaves |

## Frontend Gotchas

- **Theming is JS-applied tokens, not a stylesheet swap**: themes are sets of CSS custom properties applied at runtime by `components/theme/index.ts` via `documentElement.style.setProperty()`. The Light/Dark presets and editable-token metadata live in `components/theme/presets.ts`; `_variables.scss` holds the Light values as the pre-JS fallback and **must stay in sync** with the `light` preset. There is no separate `dark-theme.scss` bundle. To keep a color themeable, drive it from a token in a partial — never hardcode a color that needs to differ between themes. The editor exposes a curated subset of tokens (essentials + advanced); preset-only tokens (`--cardTextColor`, `--pieceWhiteColor`, `--pieceBlackColor`, `--kibitzerColor`) are defined per preset but not user-editable.
- **Theme persistence + alpha**: `localStorage.theme` holds the preset name (`light`/`dark`/`custom`), `tlcv.customTheme` the custom color map, `tlcv.themeBase` the preset a custom palette derives from. `<input type="color">` only edits `#rrggbb`, so tokens carrying alpha (`--surfaceColor`, `--surfaceColorHover`, `--highlightColor`) preserve their existing 2-digit alpha suffix when edited. `theme:change` is emitted on every change (debounced) — `board/` and `graphs/` re-read tokens via `getComputedStyle` on it.
- **Sass `@use` ordering**: `@use` rules must appear before all other rules. CSS `@import url()` counts as "other rules" — place font imports in a partial like `_base.scss`.
- **Dual CSS/SCSS webpack rules**: Separate rules for `.css` (third-party packages) and `.scss` (project styles). Only project styles go through `sass-loader`.