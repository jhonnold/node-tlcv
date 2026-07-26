# General Gotchas

Project-wide pitfalls and constraints that don't fit a single subsystem.

## UDP Networking

- **UDP local bind = broadcast port (default mode)**: by default `UdpTransport` binds the local socket to the broadcast port. This is required for classic TLCS: the server streams the broadcast to `clientIP:<broadcast port>` and ignores the source port of our `LOGONv15`. Consequences: you cannot bind an ephemeral local port and still receive data; two instances on the same host cannot watch the *same* broadcast (both need that port → `EADDRINUSE`). To run multiple worktrees against classic TLCS, point each `config/config.json` at a **different** broadcast port.
- **Ephemeral mode (opt-in per connection)**: the optional `ephemeral` flag on a `connections` entry calls `socket.bind()` (OS-assigned local port) instead of `socket.bind(<broadcast port>)`. The remote send destination is unchanged (still `host:<broadcast port>`) — only the source port differs. This only works against a server that replies to our source port (e.g. the sibling `uci-to-tlcs` broadcaster); classic TLCS (Graham's) still replies to the broadcast port, so ephemeral mode would receive nothing there. Because the broadcast port is not bound, multiple instances on one host **can** watch the same ephemeral broadcast. The broadcast port remains the identity everywhere (Map key, `/:port` route, Socket.IO room, metrics) regardless of mode; the flag is threaded `UdpTransport` ← `Connection` ← `Broadcast` and preserved across `reconnect()`.

## Configuration

- **Connections format**: Each `connections` entry is either a bare `"host:port"` string (default mode) or an object `{ "connection": "host:port", "ephemeral": true }`. Both forms are accepted on read; the admin "Add new" form writes a bare string unless the "Ephemeral local port" checkbox is set.
- **Kibitzer config**: Optional. Each entry has an `id` (auto-assigned if missing), `type` (`"local"` or `"ssh"`), `priority` (higher = assigned to more-viewed broadcasts), and type-specific fields. Both types accept optional `threads` (default 1) and `hash` (default 256).
- **Webhook config**: Optional. Each entry has an `id` (auto-assigned if missing), `type` (`"discord"` only), `url`, optional `name`, optional `ports` array (empty = all broadcasts), and optional `events` array of `"game-started"` / `"game-finished"` (empty = both).

## External Dependencies

- **Lichess API**: Uses Bearer auth token (`LICHESS_OAUTH_TOKEN`). Openings explorer and tablebase endpoints have rate limits.

## Verification

- **No test infrastructure**: This project has no test runner or test files. Verification is done via `npm run build` (TypeScript + webpack) and manual testing.