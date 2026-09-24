# TLCS Protocol

The chess server pushes messages over UDP. Two delivery modes exist:

- **ID-wrapped** (`< NNN>MSG`): reliable channel — `UdpTransport.onMessage` sends an `ACK: NNN` reply and tracks `lastMessage` to reject out-of-order IDs. Used for state-critical commands.
- **Unwrapped** (raw line, no `< >` prefix): fire-and-forget — logged with "No message id for ..." at debug. Used for high-frequency/ephemeral commands where loss is tolerable.

## Command Classification

**ID-wrapped commands**: `FEN`, `WMOVE`, `BMOVE`, `FMR`, `WPLAYER`, `BPLAYER`, `SITE`, `FEATURE`, `level`, `ADDUSER`, `DELUSER`, `MENU`, `PONG`, `CHAT`, `RESULT`.

**Unwrapped commands**: `WTIME`, `BTIME`, `WPV`, `BPV`, `CTRESET`, `CT:`, `LOGON SUCCESSFUL`.

**Out-of-band**: `MSG` — free-text server notices. Delivery mode is unconfirmed; the transport strips any id before the line is logged, so observed samples don't say which channel it arrived on.

## Per-Move Cycle

For the side about to move (call it X, with opponent Y):

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

`WTIME` precedes `WMOVE` (same color), and `BTIME` precedes `BMOVE` — the TIME message is emitted at the start of that side's thinking phase, not after the move. Immediately after an opponent's move you will see the current side's `XTIME` (not `XMOVE`).

## Relative Frequency per Move

| Message | Count | Notes |
|---------|-------|-------|
| `XPV` / `BPV` | ~20–60 | Depends on think time; ~2 per UCI depth iterated |
| `XTIME` / `BTIME` | 1 | At start of thinking side's turn |
| `FEN` | 1 | Position after the move; +1 at broadcast start |
| `XMOVE` / `BMOVE` | 1 | |
| `FMR` | 1 | Fifty-move-rule halfmove counter |
| `PONG` | ~1 per 10s | Server keepalive reply; independent of moves |
| `ADDUSER` / `DELUSER` | 1 per join/leave | |
| `CHAT` | 1 per message | |
| `CTRESET` + `CT:` | ~100+ lines | Full crosstable dump after each game completes |
| `WPLAYER` / `BPLAYER` / `SITE` / `FEATURE` / `level` / `MENU` / initial `FEN` | 1 | Once per broadcast/game at connection or game start |

## Protocol Gotchas

- **Message-id restarts**: a fresh session restarts the server's id counter, so `UdpTransport.onMessage` reads a backwards jump to exactly `1`, or into the low end of the range (at most `ID_RESTART_WINDOW`) from more than `ID_RESTART_WINDOW` above it, as a restart to follow. Any other backwards step, and a repeat of the last id, is UDP reordering or a retransmit after a lost ACK and is discarded — the size of the step matters because early in every session the high-water mark is itself inside the low range. This covers restarts the client initiates by re-logging in *and* ones the server initiates on its own; without it a re-login succeeds and every datagram of the new session is dropped as out-of-order.
- **Protocol token indexing**: `CommandTokens` is typed `[Command, ...string[]]`. `tokens[0]` is always the Command enum value (e.g. `'CHAT'`), NOT the message content. The actual data starts at `tokens[1]`. Commands with `split: true` have whitespace-tokenized data; `split: false` commands have a single string at `tokens[1]`.
- **Low-priority messages**: Commands flagged `lowPrio` in the config are skipped when `browserCount === 0` (no viewers).
- **PV color guard**: `onPV()` discards PV updates for the non-thinking color to prevent a stale post-move flush from corrupting live data. **Retroactive carve-out**: if the last recorded move belongs to that color, the PV may be the engine's *final flush for that move* (the "optional trailing XPV flush" in the per-move cycle above). `applyTrailingPv()` accepts it and patches the move's `moveMeta` entry — including a move that was previously recorded as a book move — gated on three checks: the PV must play out legally from the position *before* the move (replayed from `fenBeforeLastMove`, captured in `onMove`), its first move must equal the move actually played, and its depth must be ≥ the depth already recorded. Patched entries reach the browser via the `updatedMoves` field on `GameDelta`, gated on the `movesPatched` dirty flag.
- **Message batching**: The `MessageBuffer` drains every 100ms, so `GameService.onMessages()` receives batches. Low-priority commands are de-duplicated (last value wins) within a batch.
- **FEN backup recovery**: If `chess.js` fails to parse a move, the game reloads from the most recent FEN command — the `fen` field on `ChessGame` is kept as a backup for this purpose.
- **No-op protocol commands**: `LOGON` (the `LOGON SUCCESSFUL` handshake reply), `FEATURE`, and `level` are recognized in the `Command` enum with no-op handlers. They exist purely to suppress the `Unable to process <cmd>!` warning in `categorizeMessages`.
- **Session loss is silent on the wire**: TLCS can drop a client's login while continuing to answer `PING` with `PONG`, so the socket looks healthy while no broadcast data arrives at all. It sometimes — but not reliably — announces this with `MSG: You are no longer connected to the server.  Please re-connect.`; during the 2026-09-12 incident only 2 of 13 dead broadcasts got that notice. Two things respond to it: `GameService.onServerMessage()` re-logs-in immediately on the notice, and `Broadcast`'s ping interval re-logs-in after `env.dataTimeoutMs` (default 10 min) with no non-keepalive message. Which commands count as "alive" is declared per command in `PROVES_LIVENESS` (`src/protocol.ts`), a total map over `Command` so a new command can't silently default to counting. `PONG`, `MSG`, the `LOGON`/`FEATURE`/`level`/`MENU` connection-time lines, and `ADDUSER`/`DELUSER` (a login is answered with the spectator list, our own name included) are excluded, because all of them arrive whether or not the broadcast is alive — a re-login that is acknowledged but restores no data would otherwise look like recovery. Re-login attempts are rate-limited by a separate timestamp rather than by resetting the clock, so `ccrl_broadcast_seconds_since_data` keeps climbing through failed attempts and stays alertable. The watchdog measures from the later of the last data and the last attempt, so a broadcast that stays quiet is retried once per `dataTimeoutMs`; the 60s floor between attempts is lifted once data has arrived since the last one, so a fresh logout notice after a successful re-login is acted on at once.