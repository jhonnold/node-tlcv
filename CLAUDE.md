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

1. **main.ts** - Entry point; creates HTTP server, attaches Socket.IO, loads config connections
2. **config/config.json** - Defines which chess server addresses/ports to connect to
3. **Broadcast** (broadcast.ts) - Represents one chess broadcast/port; manages game state, spectators, chat
4. **Transport** (transport/) - UDP socket layer; `udp-transport.ts` manages the socket, `message-buffer.ts` handles message ordering
5. **GameService** (game-service.ts) - Parses commands from the chess server (FEN, WMOVE, BMOVE, WPV, CHAT, etc.) and updates game state
6. **Socket.IO** (socket-io-adapter.ts) - Broadcasts state to web clients; handles client join/chat/disconnect

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
- `components/theme/` - Dark theme toggle
- `components/focus/` - Focus management
- `utils/` - FEN display, PV text formatting
- `events/` - Custom event bus for inter-component communication
- `admin.ts`, `broadcasts.ts` - Standalone page entry points

**Shared types** (`shared/`):
- `types.ts` - Shared type definitions used by both backend and frontend (SerializedGame, MoveMetaData, etc.)
- `chessboard.d.ts` - Type declarations for chessboardjs

**Assets**:
- `public/img/` - Chess piece SVGs
- `public/css/` - Main and dark theme stylesheets

### Key Classes

- **Broadcast**: Core entity representing a single broadcast. Contains ChessGame, spectators Set, chat Array, menu Map. Sends LOGONv15 to connect to server.
- **GameService**: Processes ~20 command types from the chess server via a `commandConfig` map. Each command has `split` (tokenize by whitespace) and `lowPrio` flags.
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
- Husky + lint-staged pre-commit hooks (runs eslint --fix + prettier --write on staged `.ts`/`.css`/`.html` files)
- Node >= 18 required
- ES modules (`"type": "module"` in package.json) — use `.js` extensions in backend imports even for `.ts` source files
- Webpack bundles frontend assets (configs in `webpack/`)

## Configuration

Configuration is in `config/config.json`:
```json
{
  "connections": ["hostname:port", "hostname:port", ...]
}
```

Environment variables:
- `TLCV_PASSWORD` - Admin panel password (required)
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
- `src/chess-game.ts` - Chess game state wrapper
- `src/connection.ts` - Connection lifecycle management
- `src/broadcast-manager.ts` - Broadcast creation, reconnection, and lifecycle orchestration
- `src/config/config-store.ts` - Config read/write abstraction for connections
- `src/transport/` - UDP transport and message buffering
- `src/services/` - External integrations (Lichess openings/tablebase, PGN saving, PGN cache, game metadata, result parsing)
- `src/routes/` - Express route handlers (index, admin)

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
