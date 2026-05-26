# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Node TLCV is a backend server that provides a live chess viewer for Tom's Live Chess Server (TLCS) broadcasts. It connects to a chess server via UDP, processes game state updates, and serves real-time data to web clients via Socket.IO.

**Production Website**: https://ccrl.live/

## Common Commands

```bash
npm install && npm run build  # Install dependencies and compile
npm run dev-server             # Run server in development (nodemon)
npm run dev-public             # Build frontend assets in watch mode
npm run start                  # Run production build (port 8080)
npm run lint                   # Run ESLint with auto-fix
npm run format                 # Format code with Prettier
```

Development requires two terminals: `dev-server` for the backend (auto-restarts on `src/`/`shared/` changes) and `dev-public` for webpack watch. The `build` script runs `prebuild` (webpack prod) automatically before compiling TypeScript.

## Architecture

The server uses Express for HTTP routing and Socket.IO for real-time client communication. It connects to external TLCS chess servers via UDP.

### Backend Core Flow

1. **main.ts** - Entry point; creates HTTP server, attaches Socket.IO, assigns kibitzer config IDs if missing, initializes KibitzerManager with configs, loads config connections
2. **config/config.json** - Defines which chess server addresses/ports to connect to
3. **Broadcast** (broadcast.ts) - Represents one chess broadcast/port; manages game state, spectators, chat
4. **Transport** (transport/) - UDP socket layer; `udp-transport.ts` manages the socket, `message-buffer.ts` handles message ordering
5. **GameService** (game-service.ts) - Parses commands from the chess server (FEN, WMOVE, BMOVE, WPV, CHAT, etc.) and updates game state
6. **Socket.IO** (socket-io-adapter.ts) - Broadcasts state to web clients; handles client join/chat/disconnect
7. **Kibitzer** (kibitzer/) - Analysis engine overlay (local or remote via SSH)

### TLCS Protocol Message Flow

The chess server pushes messages over UDP. Two delivery modes exist:

- **ID-wrapped** (`< NNN>MSG`): reliable channel — `UdpTransport.onMessage` sends an `ACK: NNN` reply and tracks `lastMessage` to reject out-of-order IDs. Used for state-critical commands.
- **Unwrapped** (raw line, no `< >` prefix): fire-and-forget — logged with "No message id for ..." at debug. Used for high-frequency/ephemeral commands where loss is tolerable.

**ID-wrapped commands**: `FEN`, `WMOVE`, `BMOVE`, `FMR`, `WPLAYER`, `BPLAYER`, `SITE`, `FEATURE`, `level`, `ADDUSER`, `DELUSER`, `MENU`, `PONG`, `CHAT`, `RESULT`.
**Unwrapped commands**: `WTIME`, `BTIME`, `WPV`, `BPV`, `CTRESET`, `CT:`, `LOGON SUCCESSFUL`.

**Typical per-move cycle** (for the side about to move, call it X, with opponent Y):

```
(previous YMOVE just arrived)
XTIME: <ms>   otim <ms>          ← X's remaining time, Y's in otim; ~0.3–3s after YMOVE
XPV: <depth> <cp> <time_cs> <nodes> <pv...>   ← tens per move, ~2 per depth (summary + full PV)
XPV: ...                          (iterative deepening as X thinks)
...
< NNN>FEN: <position after X's move>
< NNN>XMOVE: <n>. <SAN>
< NNN>FMR: <halfmove-clock>
(optional trailing XPV flush)
(then the cycle flips: YTIME → YPVs → FEN/YMOVE/FMR → XTIME → ...)
```

So `WTIME` precedes `WMOVE` (same color), and `BTIME` precedes `BMOVE` — the TIME message is emitted at the start of that side's thinking phase, not after the move. Immediately after an opponent's move you will see the current side's `XTIME` (not `XMOVE`).

**Relative frequency per move** (observed):
- `XPV` / `BPV`: ~20–60 entries per move (depends on think time; roughly 2 per UCI depth iterated)
- `XTIME` / `BTIME`: exactly 1 per move (at the start of the thinking side's turn)
- `FEN`: 1 per move (position after the move; plus 1 at broadcast start)
- `XMOVE` / `BMOVE`: 1 per move
- `FMR`: 1 per move (fifty-move-rule halfmove counter)
- `PONG`: ~1 every 10s (server keepalive reply; independent of moves)
- `ADDUSER` / `DELUSER`: 1 per spectator join/leave
- `CHAT`: 1 per chat message
- `CTRESET` + `CT:` lines: full crosstable dump after each game completes (~100+ `CT:` lines following one `CTRESET`)
- `WPLAYER` / `BPLAYER` / `SITE` / `FEATURE` / `level` / `MENU` / initial `FEN`: once per broadcast/game (at connection or game start)

### Kibitzer Subsystem

The kibitzer runs chess engines (local or remote via SSH) that independently analyze the live position and overlay analysis alongside the broadcast engine data. Transports are configured in `config.json` under the `kibitzers` key.

**Files** (`src/kibitzer/`):
- `kibitzer-manager.ts` - Orchestrates targeting (assigns transports to top broadcasts by viewers), manages per-broadcast transport slots, PV playout via chess.js, snapshot capture on moves, and 1-second client emit loop
- `local-transport.ts` - Spawns a local engine subprocess, manages UCI lifecycle (`uci` → `setoption` → `isready` → `go infinite`)
- `ssh-transport.ts` - Connects to a remote host via SSH (`ssh2`), runs the engine over the SSH channel, same UCI lifecycle as local
- `transport-factory.ts` - `createTransport()` creates a single transport instance from a `KibitzerConfig`
- `uci-parser.ts` - Parses UCI `info` lines into `AnalysisInfo` structs; normalizes scores to white's perspective
- `types.ts` - `KibitzerTransport` interface, `KibitzerConfig` discriminated union (`LocalKibitzerConfig | SshKibitzerConfig`)
- `index.ts` - Barrel export

**Data flow**:
1. Engine emits UCI `info` lines → `parseInfoLine()` normalizes score → per-slot `currentInfo` updated
2. Every 1s: `emitKibitzerUpdates()` iterates all active slots, plays out PV via chess.js → emits `{ game: { kibitzerLiveData } }` delta to Socket.IO room
3. On each move: `snapshotForMove()` captures current analysis into `moveMeta[n].kibitzer` before state reset, then `onPositionChange()` sends new FEN to engine

**Targeting**: `poll()` runs every 10s (and once immediately at startup), ranks broadcasts by viewer count, assigns the top N transports (where N = number of configured kibitzers). Highest-priority transport gets the most-viewed broadcast. Hysteresis threshold of 2 gives currently-analyzed broadcasts a ranking bonus. Broadcasts with zero viewers are excluded.

### Webhook Subsystem

Outbound webhooks POST a notification when a game **starts** or **finishes**. Configs are stored in `config.json` under the `webhooks` key and managed at runtime from the admin panel. The subsystem mirrors the kibitzer pattern (discriminated-union-by-`type`, config-backed, runtime-managed, admin-editable).

**Files** (`src/webhooks/`):
- `types.ts` - `WebhookConfig` discriminated union (`DiscordWebhookConfig` only for now), the normalized `WebhookEvent` payload (`GameStartedEvent | GameFinishedEvent`), and the `WebhookSender` interface
- `discord-sender.ts` - `DiscordSender` formats events as Discord embeds and POSTs via Node's global `fetch`
- `sender-factory.ts` - `createSender()` builds a sender from a config based on its `type`
- `webhook-manager.ts` - `WebhookManager` owns the configs/senders; `dispatch()` applies port + event filters and fans out
- `index.ts` - Barrel export

**Data flow**: `GameService` calls `getWebhookManager()?.dispatch(event)` from `onPlayer()` (game-started) and `onResult()` (game-finished). `dispatch()` is **fire-and-forget** — it filters each webhook by `ports` (empty = all) and `events` (empty = both), then calls `sender.send()` without awaiting. Senders catch all errors internally and never throw, so a failed webhook never blocks game processing.

**Game-started detection**: `onPlayer()` fires once per color. `GameService` uses a re-arm state machine (`gameStartArmed` + `startColorsSeen`) — armed at construction and re-armed after each `RESULT`, it fires exactly once per game when both colors have been announced. This avoids keying on the 100ms-debounced `currentGameNumber`.

### Metrics Subsystem

Prometheus metrics via `prom-client`. `src/metrics.ts` owns a single `Registry` (`ccrl_` prefix, plus default Node process metrics) and is scraped at `GET /admin/metrics` (basic-auth protected, same as the rest of `/admin`).

**Gauges** (recomputed at scrape time via `collect()`): `ccrl_broadcasts_active`, `ccrl_broadcast_spectators`, `ccrl_broadcast_browser_connections`, `ccrl_game_move_number`, `ccrl_kibitzer_total`, `ccrl_kibitzer_ready`, `ccrl_kibitzer_target_port` (labeled by `port`/`event`).

**Histograms** (observed at call sites): `ccrl_http_request_duration_seconds` (labels `method`/`route`/`status`, instrumented in `util/http-metrics.ts`), `ccrl_lichess_request_duration_seconds` (labels `endpoint`/`outcome`, instrumented in `services/lichess.ts` — wraps `fetchOpening` and `fetchTablebase`).

**Counters** (incremented inline at the event site): `ccrl_udp_messages_received_total`, `ccrl_udp_messages_out_of_order_total`, `ccrl_commands_processed_total`, `ccrl_chat_messages_total`, `ccrl_spectator_joins_total`, `ccrl_spectator_leaves_total`, `ccrl_socket_emissions_total`, `ccrl_kibitzer_assignments_total`, `ccrl_message_buffer_errors_total`.

Instrumented across `game-service.ts` (commands, chat), `socket-io-adapter.ts` (spectator join/leave, emissions), `transport/udp-transport.ts` (UDP receive, out-of-order), `transport/message-buffer.ts` (buffer errors), and `kibitzer/kibitzer-manager.ts` (assignments). Counters import the specific metric and call `.inc()`; gauges read live state (`broadcasts` map, `KibitzerManager`) at scrape time, so no per-event wiring is needed for them.

### Frontend Architecture

The frontend is TypeScript using jQuery and chessboardjs, bundled with Webpack.

**Templates (EJS)**: `views/pages/` (index, broadcasts, admin) and `views/partials/` (header, info-card, chat)

**Component-based TS modules** (public/js/):
- `index.ts` - Entry point; connects Socket.IO, initializes boards, handles state updates
- `components/board/` - Board rendering, PV arrow drawing, resize handling
- `components/chat/` - Chat send/receive, username management
- `components/game/` - Game state display, player info cards, clock timers
- `components/games/` - Games list display from CT data stream
- `components/graphs/` - Chart.js graph rendering (eval, time, etc.)
- `components/navigation/` - Move list navigation with keyboard support
- `components/replay/` - Game replay from persistent metadata sidecar files
- `components/results/` - Tournament results/standings table rendering
- `components/tabs/` - Tabbed interface (Chat, Moves, Results, Details)
- `components/theme/` - Theme selector: applies a color palette as CSS custom properties on `document.documentElement`, persists the choice, and drives the theme editor modal (`presets.ts` holds the Light/Dark presets and editable-token metadata)
- `components/focus/` - Focus management
- `utils/` - FEN display, PV text formatting
- `events/` - Custom event bus for inter-component communication
- `admin.ts`, `broadcasts.ts` - Standalone page entry points

**Shared types** (`shared/`):
- `types.ts` - Shared type definitions used by both backend and frontend (SerializedGame, MoveMetaData, KibitzerMeta, etc.)
- `colors.ts` - `colorName()` helper used by both backend and frontend
- `chessboard.d.ts` - Type declarations for chessboardjs

**Styles** (`public/css/`): SCSS with partials, compiled by webpack via `sass-loader`:
- `main.scss` - Entry point that `@use`s all partials
- `_variables.scss` - CSS custom properties (`:root` tokens; the Light theme baseline / pre-JS fallback)
- `_theme-modal.scss` - Styles for the theme editor modal
- `_mixins.scss` - Reusable mixins (`mini-table-reset`, `icon-btn`, `sticky-th-header`, `table-status-message`)
- `_base.scss` - Global element styles, Google Fonts import
- `_chessboard.scss`, `_layout.scss`, `_board.scss`, `_info-area.scss` - Board/layout components
- `_header.scss`, `_footer.scss` - Site chrome
- `_tabs.scss`, `_chat.scss`, `_moves.scss`, `_results.scss`, `_games.scss`, `_graphs.scss`, `_details.scss` - Tab panels
- `_replay.scss`, `_broadcasts.scss`, `_focus.scss` - Feature-specific styles
- `_responsive.scss` - Mobile breakpoint (`max-width: 767px`)

**Assets**:
- `public/img/` - Chess piece SVGs

### Key Classes

- **Broadcast**: Core entity representing a single broadcast. Contains ChessGame, spectators Set, chat Array, menu Map. Sends LOGONv15 to connect to server.
- **GameService**: Processes ~22 command types from the chess server via a `commandConfig` map. Each command has `split` (tokenize by whitespace) and `lowPrio` flags.
- **BroadcastState** (broadcast-state.ts): Serialization of broadcast state for Socket.IO emission.

### Routes

- `/` - Lists all active broadcasts
- `/broadcasts` - JSON list of broadcast ports
- `/:port` - Individual game view (renders EJS template)
- `/:port/pgn` - Returns PGN for the game
- `/:port/result-table` - Returns tournament results
- `/:port/result-table/json` - Returns parsed tournament results as JSON
- `/:port/games/json` - Returns game records as JSON (with PGN/meta URLs)
- `/:port/games/:gameNumber/meta` - Returns metadata sidecar for a specific game
- `/admin` - Admin panel (basic auth, username: admin)
- `POST /admin/new` - Open a new broadcast connection at runtime
- `POST /admin/close` - Close a broadcast connection at runtime
- `POST /admin/kibitzers` - Add a new kibitzer transport at runtime
- `DELETE /admin/kibitzers/:id` - Remove a kibitzer transport at runtime
- `POST /admin/webhooks` - Add a new webhook at runtime
- `DELETE /admin/webhooks/:id` - Remove a webhook at runtime
- `GET /admin/metrics` - Prometheus metrics scrape endpoint (basic auth)

### Client-Server Communication

Socket.IO events:
- `join` - Client joins a broadcast by port
- `state` - Initial game state sent to client (includes chat history)
- `update` - Game state updates (moves, scores, times, spectators)
- `new-chat` - New chat messages
- `chat` - Client sends chat message
- `nick` - Client changes username
- `disconnect` - Client leaves

## Code Style

- TypeScript strict mode, ESNext target
- Split tsconfigs: `tsconfig.backend.json` (backend + shared), `tsconfig.frontend.json` (frontend + shared)
- Prettier for formatting (120 char width, single quotes, trailing commas, semicolons), ESLint for linting
- SCSS for styles — partials use `@use 'mixins' as *` for mixin access; CSS custom properties for runtime theming
- Husky + lint-staged pre-commit hooks (runs eslint --fix + prettier --write on staged `.ts`/`.scss`/`.css`/`.html` files)
- Node >= 18 required
- ES modules (`"type": "module"` in package.json) — use `.js` extensions in backend imports even for `.ts` source files
- Webpack bundles frontend assets (configs in `webpack/`)

## Configuration

Configuration is in `config/config.json`:
```json
{
  "connections": ["hostname:port", { "connection": "hostname:port", "ephemeral": true }, ...],
  "kibitzers": [
    { "id": "a1b2c3d4", "type": "local", "priority": 10, "enginePath": "/usr/bin/stockfish", "threads": 4, "hash": 512 },
    { "id": "e5f6g7h8", "type": "ssh", "priority": 5, "host": "example.com", "username": "user", "privateKeyPath": "/path/to/key", "enginePath": "/usr/bin/stockfish", "threads": 8, "hash": 2048 }
  ],
  "webhooks": [
    { "id": "i9j0k1l2", "type": "discord", "name": "My channel", "url": "https://discord.com/api/webhooks/...", "ports": [16063], "events": ["game-finished"] }
  ]
}
```

Each `connections` entry is either a bare `"host:port"` string (default mode) or an object `{ "connection": "host:port", "ephemeral": true }`. The optional `ephemeral` flag binds an OS-assigned local UDP port instead of the broadcast port (see the UDP bind gotcha below). Both forms are accepted on read; the admin "Add new" form writes a bare string unless the "Ephemeral local port" checkbox is set.

The `kibitzers` array is optional. Each entry has an `id` (auto-assigned at startup if missing), a `type` (`"local"` or `"ssh"`), a `priority` (higher = assigned to more-viewed broadcasts), and type-specific fields. SSH entries also require `host`, `username`, `privateKeyPath`, and `enginePath`. Both types accept optional `port` (SSH only, default 22), `threads` (default 1), and `hash` (default 256).

The `webhooks` array is also optional. Each entry has an `id` (auto-assigned if missing), a `type` (`"discord"` only for now), a `url`, an optional `name`, an optional `ports` array (empty/unset = all broadcasts), and an optional `events` array of `"game-started"` / `"game-finished"` (empty/unset = both).

Environment variables (see `.env.example`; `.env` is gitignored and loaded via `dotenv`):
- `TLCV_PASSWORD` - Admin panel password (required)
- `PORT` - Backend HTTP/Socket.IO listen port (default: 8080). Set a unique value per worktree to run multiple instances side by side.
- `CONFIG_DIR` - Config directory (default: "config")
- `PGNS_DIR` - PGN output directory (default: "pgns")
- `LICHESS_OAUTH_TOKEN` - Optional Lichess API bearer token for opening/tablebase lookups
- `LOG_LEVEL` - Winston log level (default: "info")

## Key Files

**Backend**:
- `src/main.ts` - Server entry point
- `src/app.ts` - Express configuration
- `src/broadcast.ts` - Broadcast class and exports
- `src/broadcast-state.ts` - Broadcast serialization for Socket.IO
- `src/game-service.ts` - Chess server command processing
- `src/protocol.ts` - Command enum and message parsing
- `src/socket-io-adapter.ts` - Socket.IO server and emit helpers
- `src/metrics.ts` - Prometheus registry, gauges/counters, scraped at `/admin/metrics`
- `src/chess-game.ts` - Chess game state wrapper
- `src/connection.ts` - Connection lifecycle management
- `src/broadcast-manager.ts` - Broadcast creation, reconnection, and lifecycle orchestration
- `src/config/config-store.ts` - Config read/write abstraction for connections
- `src/kibitzer/` - Analysis engine transports (local, SSH), manager, factory, UCI parser
- `src/webhooks/` - Outbound webhook senders (Discord), manager, factory
- `src/transport/` - UDP transport and message buffering
- `src/services/` - External integrations (Lichess openings/tablebase, PGN saving, PGN cache, game metadata, result parsing)
- `src/routes/` - Express route handlers (index, admin)
- `src/util/` - Logger (Winston), request logging middleware, slug helpers, unique name generator

**Shared**:
- `shared/types.ts` - Shared types for backend and frontend

**Frontend**:
- `views/pages/index.ejs` - Main game view template
- `public/js/index.ts` - Client entry point
- `public/js/components/` - UI components (board, chat, game, games, graphs, navigation, replay, results, tabs, theme)
- `public/js/utils/` - Shared utilities (FEN, PV formatting)

## Gotchas

- **Protocol token indexing**: `CommandTokens` is typed `[Command, ...string[]]`. `tokens[0]` is always the Command enum value (e.g. `'CHAT'`), NOT the message content. The actual data starts at `tokens[1]`. Commands with `split: true` have whitespace-tokenized data; `split: false` commands have a single string at `tokens[1]`.
- **Low-priority messages**: Commands flagged `lowPrio` in the config are skipped when `browserCount === 0` (no viewers).
- **Lichess API**: Uses Bearer auth token; openings explorer and tablebase endpoints have rate limits.
- **ESM imports**: Backend `.ts` files must use `.js` extensions in relative imports (e.g. `import foo from './foo.js'`) because the project uses Node ESM with `"type": "module"`.
- **PV color guard**: `onPV()` discards PV updates for the non-thinking color to prevent stale post-move flush from corrupting live data.
- **Message batching**: The `MessageBuffer` drains every 100ms, so `GameService.onMessages()` receives batches. Low-priority commands are de-duplicated (last value wins) within a batch.
- **FEN backup recovery**: If `chess.js` fails to parse a move, the game reloads from the most recent FEN command — the `fen` field on `ChessGame` is kept as a backup for this purpose.
- **Sass `@use` ordering**: `@use` rules must appear before all other rules in a `.scss` file. CSS `@import url()` (e.g., Google Fonts) counts as "other rules" — place font imports in a partial like `_base.scss`, not alongside `@use` statements.
- **Dual CSS/SCSS webpack rules**: `webpack.common.js` has separate rules for `.css` (third-party packages: reset-css, mini.css, chessboardjs) and `.scss` (project styles). Only project styles go through `sass-loader`.
- **Theming is JS-applied tokens, not a stylesheet swap**: themes are sets of CSS custom properties applied at runtime by `components/theme/index.ts` via `documentElement.style.setProperty()`. The Light/Dark presets and the editable-token metadata live in `components/theme/presets.ts`; `_variables.scss` holds the Light values as the pre-JS fallback and **must stay in sync** with the `light` preset. There is no longer a separate `dark-theme.scss` bundle. To keep a color themeable, drive it from a token in a partial — never hardcode a color that needs to differ between themes (e.g. `--cardTextColor`, `--pieceBlackColor` were added for exactly this). The editor exposes a curated subset of tokens (essentials + an advanced group); preset-only tokens (`--cardTextColor`, `--pieceWhiteColor`, `--pieceBlackColor`, `--kibitzerColor`) are defined per preset but not user-editable.
- **Theme persistence + alpha**: `localStorage.theme` holds the preset name (`light`/`dark`/`custom`), `tlcv.customTheme` the custom color map, `tlcv.themeBase` the preset a custom palette derives from. `<input type="color">` only edits `#rrggbb`, so tokens carrying alpha (`--surfaceColor`, `--surfaceColorHover`, `--highlightColor`) preserve their existing 2-digit alpha suffix when edited. `theme:change` is still emitted on every change (debounced for live edits) — `board/` and `graphs/` re-read tokens via `getComputedStyle` on it.
- **Kibitzer score normalization**: UCI scores are always converted to white's perspective in `uci-parser.ts`. When it's black to move, the raw centipawn score is negated. Mate scores map to ±1,000,000 cp.
- **Kibitzer priority-based targeting**: `KibitzerManager` assigns configured transports to the top broadcasts by viewer count. The number of simultaneous analyses equals the number of entries in the `kibitzers` config array. Highest-priority transport serves the most-viewed broadcast. A hysteresis threshold of 2 prevents thrashing — currently analyzed broadcasts get a bonus when ranking.
- **Kibitzer transport lifecycle**: Connection lifecycle (`create`/`teardown`) is separate from analysis lifecycle (`startAnalysis`/`stopAnalysis`). `create()` is called once at startup to establish the engine connection (SSH or local process) and UCI handshake. `teardown()` is only called during graceful shutdown. When moving between broadcasts, only `stopAnalysis()`/`startAnalysis()` are called — the underlying connection stays alive. No automatic restart if an engine crashes or SSH connection drops — `ready` becomes `false` and analysis silently stops.
- **Kibitzer config IDs**: Each kibitzer config entry has a unique `id` field (8-char UUID prefix). Existing configs without IDs get them auto-assigned and saved on first startup. IDs are used for the admin DELETE route.
- **Kibitzer runtime management**: `KibitzerManager` owns the full transport lifecycle from config. It accepts `KibitzerConfig[]` in the constructor and supports `addTransport(config)` / `removeTransport(id)` for runtime changes. The admin panel's "edit" is implemented as delete + re-add on the frontend.
- **Webhook dispatch is fire-and-forget**: `WebhookManager.dispatch()` calls `sender.send()` without awaiting. `DiscordSender.send()` catches every error and always resolves, so a slow or failing webhook never blocks `onResult()` / the message batch. Do not `await` `dispatch()`.
- **Webhook game-started dedup**: `GameService` fires one game-started event per game via a re-arm state machine (`gameStartArmed` / `startColorsSeen`). It is re-armed in `onResult()`. Connecting mid-game fires one game-started for the already-in-progress game — accepted.
- **Webhook URL is a secret**: Discord webhook URLs embed a token. The admin table masks all but the last 8 chars, but the edit button still carries the full URL in a `data-url` attribute (admin page is basic-auth protected).
- **No-op protocol commands**: `LOGON` (the `LOGON SUCCESSFUL` handshake reply), `FEATURE`, and `level` are recognized in the `Command` enum with no-op handlers (`() => [EmitType.UPDATE, false]`, same pattern as `PONG`). They are connection-time handshake/config lines the viewer derives nothing from (clocks come from `WTIME`/`BTIME`, not `level`); the handlers exist purely to suppress the `Unable to process <cmd>!` warning in `categorizeMessages`.
- **UDP local bind = broadcast port (default mode)**: by default `UdpTransport` binds the local socket to the broadcast port (`udp-transport.ts`). This is required for classic TLCS, not a convention: the server streams the broadcast to `clientIP:<broadcast port>` and ignores the source port of our `LOGONv15` (verified empirically — a LOGON sent from a different source port still has its data delivered to the broadcast port). Consequences in default mode: you cannot bind an ephemeral local port and still receive data, and two instances on the same host cannot watch the *same* broadcast (both need that port → `EADDRINUSE`). To run multiple worktrees against classic TLCS, point each `config/config.json` at a **different** broadcast port.
- **Ephemeral mode (opt-in per connection)**: the optional `ephemeral` flag on a `connections` entry calls `socket.bind()` (OS-assigned local port) instead of `socket.bind(<broadcast port>)`. The remote send destination is unchanged (still `host:<broadcast port>`) — only our *source* port differs. This only works against a server that replies to our source port (e.g. the sibling `uci-to-tlcs` broadcaster); classic TLCS (Graham's) still replies to the broadcast port, so ephemeral mode would receive nothing there. Because the broadcast port is not bound, multiple instances on one host **can** watch the same ephemeral broadcast. The broadcast port remains the identity everywhere (Map key, `/:port` route, Socket.IO room, metrics) regardless of mode; the flag is threaded `UdpTransport` ← `Connection` ← `Broadcast` and preserved across `reconnect()`.
- **No test infrastructure**: This project has no test runner or test files. Verification is done via `npm run build` (TypeScript + webpack) and manual testing.
