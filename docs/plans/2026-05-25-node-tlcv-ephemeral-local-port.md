---
ingested: 2026-05-25
source_type: plan
author: claude_code (drafted) + jhonnold (direction + approval)
synthesis: done
---

# node-tlcv — opt-in ephemeral local UDP port per connection

Plan authored and executed 2026-05-25. Shipped as **PR #168** (squash commit
`af6e373` on `main`). The client-side counterpart to [[uci-to-tlcs]]'s
source-port reply ([[2026-05-25-uci-to-tlcs-source-port-reply-plan]]).

## Context / problem

[[node-tlcv]] connects to a TLCS chess server over UDP. By default
`UdpTransport` **must** bind the broadcast port locally (`udp-transport.ts`),
because strict TLCS (Graham's CCRL server) streams the broadcast to
`clientIP:<broadcast port>` and ignores the source port of our `LOGONv15` (the
fixed-port rule — see [[tlcv-udp-broadcast-protocol]]). That mandatory bind has
two consequences: two instances on one host can't watch the *same* broadcast
(`EADDRINUSE`), and you can't bind an OS-assigned port and still receive data.

The sibling [[uci-to-tlcs]] broadcaster now replies to the client's **source
port** instead of the fixed broadcast port. So node-tlcv can opt into binding an
OS-assigned local port **per connection** to interoperate with it (and let
multiple instances/worktrees share a broadcast). Graham's broadcasts keep the
default (bind the broadcast port); the new mode is strictly **opt-in**.

## Key design fact

The broadcast **port stays the identity everywhere** — Map key in `broadcasts`,
route `/:port`, Socket.IO room `String(port)`, metrics labels,
`ChessGame(String(port))`, `Broadcast.connection` getter. Only the **local
bind** changes; the **remote send destination stays the broadcast port**. So
routes, Socket.IO, and metrics needed **no changes**.

Decisions confirmed with Jay:
- **Config format:** backward-compatible union. Normal connections stay plain
  `"host:port"` strings; ephemeral ones are stored as
  `{ "connection": "host:port", "ephemeral": true }`. Existing config entries
  untouched (no diff churn).
- **Local port:** OS-assigned — `socket.bind()` with no port.

## Changes

1. **Transport** (`src/transport/udp-transport.ts`) — new fourth ctor param
   `ephemeral = false`. When set, `this.socket.bind()` (OS-assigned) instead of
   `this.socket.bind(port)`. `send()` unchanged — still targets
   `host:<broadcast port>`; only the *source* port differs. `onListening()` logs
   the actual bound local port alongside the broadcast address.
2. **Thread the flag** — `Connection` (`src/connection.ts`) forwards `ephemeral`
   to `UdpTransport`; `Broadcast` (`src/broadcast.ts`) stores it as
   `readonly ephemeral` and reuses it in both the initial `Connection` and the
   `reconnect()` re-creation, so reconnects preserve the mode. Exposed for the
   admin template.
3. **Config store** (`src/config/config-store.ts`) — `ConnectionConfig
   { connection; ephemeral? }` + `ConnectionEntry = string | ConnectionConfig`
   union; `normalizeConnection()` tolerates both forms on read.
   `getConnections()` returns normalized configs; `addConnection(connection,
   ephemeral)` writes a bare string by default, an object only when ephemeral;
   `removeConnection()` filters on the normalized connection string.
4. **Manager** (`src/broadcast-manager.ts`) — `connect()` / `newConnection()`
   parse and pass `ephemeral` through to `Broadcast` and `addConnection`.
5. **Admin route** (`src/routes/admin.ts`) — `POST /admin/new` reads/coerces
   `ephemeral` from the body.
6. **Admin UI** — `views/pages/admin.ejs` gains an "Ephemeral local port"
   checkbox on the add-new form and an "Ephemeral" column in the broadcasts
   table; `public/js/admin.ts` collects the checkbox and sends it.
7. **Docs** — `CLAUDE.md` config schema + the UDP-bind gotcha rewritten as
   default-vs-ephemeral modes.

## Verification (live, end-to-end)

`npm run build` (tsc + webpack) and `npm run lint` clean. Then run against a live
`uci-to-tlcs` broadcasting the sample fixture on `127.0.0.1:16061`:

- **Ephemeral bind + data flow:** node-tlcv logged
  `Listening @ 0.0.0.0:58645 (broadcast 127.0.0.1:16061)` — an OS-assigned port,
  not 16061. uci-to-tlcs registered the client by that ephemeral port
  (`LOGON tlcv.net@127.0.0.1:58645`), ACKs round-tripped both ways, and
  `/16061/pgn` showed the received Site/players/FEN.
- **Two instances, same broadcast, one host** (the headline benefit, impossible
  in default mode): instance 1 → `0.0.0.0:58645`, instance 2 → `0.0.0.0:38772`,
  **no `EADDRINUSE`**; uci-to-tlcs reported `2 client(s)`.

The default (non-ephemeral) path against a real Graham server is unchanged and
was not separately live-tested (no outbound connection opened); reconnect
preservation is covered by the stored flag but not forced live.

## Effect on prior knowledge

Flips consequences #1 and #2 of [[tlcv-udp-broadcast-protocol]] **for servers
under our control** (i.e. [[uci-to-tlcs]]): an ephemeral local bind *can* now
receive, and multiple instances *can* share one broadcast. The fixed-port rule
still holds against real TLCS servers (CCRL/Graham), which is why the mode is
opt-in and defaults off.
