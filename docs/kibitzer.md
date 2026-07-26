# Kibitzer Subsystem

The kibitzer runs chess engines (local or remote via SSH) that independently analyze the live position and overlay analysis alongside the broadcast engine data. Transports are configured in `config.json` under the `kibitzers` key.

## Files

| File | Purpose |
|------|---------|
| `src/kibitzer/kibitzer-manager.ts` | Orchestrates targeting, manages per-broadcast transport slots, PV playout via chess.js, snapshot capture on moves, 1-second client emit loop |
| `src/kibitzer/local-transport.ts` | Spawns a local engine subprocess, manages UCI lifecycle (`uci` → `setoption` → `isready` → `go infinite`) |
| `src/kibitzer/ssh-transport.ts` | Connects to a remote host via SSH (`ssh2`), runs the engine over the SSH channel, same UCI lifecycle |
| `src/kibitzer/transport-factory.ts` | `createTransport()` creates a single transport instance from a `KibitzerConfig` |
| `src/kibitzer/uci-parser.ts` | Parses UCI `info` lines into `AnalysisInfo` structs; normalizes scores to white's perspective |
| `src/kibitzer/types.ts` | `KibitzerTransport` interface, `KibitzerConfig` discriminated union |
| `src/kibitzer/index.ts` | Barrel export |

## Data Flow

1. Engine emits UCI `info` lines → `parseInfoLine()` normalizes score → per-slot `currentInfo` updated
2. Every 1s: `emitKibitzerUpdates()` iterates all active slots, plays out PV via chess.js → emits `{ game: { kibitzerLiveData } }` delta to Socket.IO room
3. On each move: `snapshotForMove()` captures current analysis into `moveMeta[n].kibitzer` before state reset, then `onPositionChange()` sends new FEN to engine

## Targeting

`poll()` runs every 10s (and once immediately at startup), ranks broadcasts by viewer count, assigns the top N transports (where N = number of configured kibitzers). Highest-priority transport gets the most-viewed broadcast. Hysteresis threshold of 2 gives currently-analyzed broadcasts a ranking bonus. Broadcasts with zero viewers are excluded.

## Kibitzer Gotchas

- **Score normalization**: UCI scores are always converted to white's perspective in `uci-parser.ts`. When it's black to move, the raw centipawn score is negated. Mate scores map to ±1,000,000 cp.
- **Priority-based targeting**: The number of simultaneous analyses equals the number of entries in the `kibitzers` config array. Highest-priority transport serves the most-viewed broadcast.
- **Transport lifecycle**: Connection lifecycle (`create`/`teardown`) is separate from analysis lifecycle (`startAnalysis`/`stopAnalysis`). `create()` runs once at startup. When moving between broadcasts, only `stopAnalysis()`/`startAnalysis()` are called — the underlying connection stays alive. No automatic restart if an engine crashes or SSH connection drops — `ready` becomes `false` and analysis silently stops.
- **Config IDs**: Each kibitzer config entry has a unique `id` field (8-char UUID prefix). Existing configs without IDs get them auto-assigned and saved on first startup. IDs are used for the admin DELETE route.
- **Runtime management**: `KibitzerManager` supports `addTransport(config)` / `removeTransport(id)` for runtime changes. Admin "edit" is delete + re-add on the frontend.