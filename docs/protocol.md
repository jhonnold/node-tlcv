# TLCS Protocol

The chess server pushes messages over UDP. Two delivery modes exist:

- **ID-wrapped** (`< NNN>MSG`): reliable channel — `UdpTransport.onMessage` sends an `ACK: NNN` reply and tracks `lastMessage` to reject out-of-order IDs. Used for state-critical commands. The official client only drops ids it has already seen and processes late ones — see [official-client.md](./official-client.md#ordering-official-client-vs-node-tlcv).
- **Unwrapped** (raw line, no `< >` prefix): fire-and-forget — logged with "No message id for ..." at debug. Used for high-frequency/ephemeral commands where loss is tolerable.

## Command Classification

**ID-wrapped commands**: `FEN`, `WMOVE`, `BMOVE`, `FMR`, `WPLAYER`, `BPLAYER`, `SITE`, `FEATURE`, `level`, `ADDUSER`, `DELUSER`, `MENU`, `PONG`, `CHAT`, `RESULT`, `MULTIGAME`, `BOARDS`.

**TLCS-MG wrapped lines** (`BOARD <id> <game line>`, incl. `GAMENO`) keep the channel of the line they wrap.

**Unwrapped commands**: `WTIME`, `BTIME`, `WPV`, `BPV`, `WINFO`, `BINFO`, `CTRESET`, `CT:`, `LOGON SUCCESSFUL`.

**Out-of-band**: `MSG` — free-text server notices. Delivery mode is unconfirmed; the transport strips any id before the line is logged, so observed samples don't say which channel it arrived on.

## Per-Move Cycle

For the side about to move (call it X, with opponent Y):

```
(previous YMOVE just arrived)
XTIME: <cs>   otim <cs>          ← X's remaining time, Y's in otim (centiseconds); ~0.3–3s after YMOVE
XPV: <depth> <cp> <time_cs> <nodes> <pv...>   ← tens per move, ~2 per depth (summary + full PV)
XPV: ...                          (iterative deepening as X thinks)
XINFO: ...                        ← after each XPV, same search (see WINFO/BINFO below)
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
| `XINFO` / `BINFO` | same as `XPV` | One per `XPV`, sent right after it |
| `XTIME` / `BTIME` | 1 | At start of thinking side's turn |
| `FEN` | 1 | Position after the move; +1 at broadcast start |
| `XMOVE` / `BMOVE` | 1 | |
| `FMR` | 1 | Fifty-move-rule halfmove counter |
| `PONG` | ~1 per 10s | Server keepalive reply; independent of moves |
| `ADDUSER` / `DELUSER` | 1 per join/leave | |
| `CHAT` | 1 per message | |
| `CTRESET` + `CT:` | ~100+ lines | Full crosstable dump after each game completes |
| `WPLAYER` / `BPLAYER` / `SITE` / `FEATURE` / `level` / `MENU` / initial `FEN` | 1 | Once per broadcast/game at connection or game start |

## TLCS-MG (multigame)

uci-to-tlcs can carry several concurrent games ("boards") over one port; spec: uci-to-tlcs `docs/tlcs-multigame-spec.md`. node-tlcv opts in; classic TLCS drops the request silently and behaves as before.

- **Handshake** (`Broadcast`): every `login()` sets the mode to `pending` and arms a 5 s retry. `LOGON SUCCESSFUL` is answered with `MULTIGAME: 1` and `RESULTTABLE` (the server forgets the opt-in on every LOGON). The retry resends `MULTIGAME: 1` at +5 s and +10 s (covers a lost `LOGON SUCCESSFUL` or reply) and settles on `single` at +15 s. A `MULTIGAME: 1` reply switches to `mg` (a late one too); another version is ignored. A re-LOGON (watchdog, logout notice) goes back to `pending`.
- **Modes**: `pending`/`single` route bare game lines to board 1 and drop `BOARD`/`BOARDS` lines. Entering `mg` resets every board (`BoardService.reset()`: players, moves and pending `GAMENO` cleared; a `resetMoves` delta), since that state came from bare lines and the server follows its reply with a wrapped snapshot of every board in progress. In `mg` bare game lines are dropped.
- **Boards**: `BOARDS: 1 2 3` creates missing boards (never removed). `BOARD <id> <game line>` is unwrapped by `parseLine()` (`src/protocol.ts`) and dispatched to that board's `BoardService` with the unchanged single-game handlers; an id no `BOARDS:` named yet creates the board with a warning. A wrapped line that is not a game line is `Unable to process`. Liveness and `commands_processed{command}` count the inner command. Board 1's `ChessGame` is named `<port>`, others `<port>:<id>` (log lines). New boards >= 2 start loaded at the start position, so their first startpos `FEN` is a plain new game.
- **Numbering**: `BOARD <id> GAMENO: <n>` precedes that board's `result:`. In `mg` the game is saved (PGN, meta), announced in chat and sent to the `game-finished` webhook as game `<n>`; without a `GAMENO` it is not saved and the chat line has no number. A board's `WPLAYER` drops a stale `GAMENO` (its result was lost). `pending`/`single` keep the CT-derived `currentGameNumber`.
- **Board 1 only, for now**: the kibitzer. Every board's game delta goes to its own Socket.IO room (`<port>:<board>`, see [frontend.md](./frontend.md#socketio)); the viewer shows the board in its URL (`/:port/:board`, picked in the header). Result lines of every board go to the shared chat; every board's `game-started` (numberless in `mg`) and `game-finished` webhooks fire (see [webhooks.md](./webhooks.md)).
- **Known limitation**: a loaded board keeps a bare non-startpos `FEN` only as backup, so a snapshot from a server running `FENSETUPMOVE=0` (`FEN X` without the setup move) shows the old position until that board's first move fails and reloads from the FEN.

## Protocol Gotchas

- **Message-id restarts**: a fresh session restarts the server's id counter, so `UdpTransport.onMessage` reads a backwards jump to exactly `1`, or into the low end of the range (at most `ID_RESTART_WINDOW`) from more than `ID_RESTART_WINDOW` above it, as a restart to follow. Any other backwards step, and a repeat of the last id, is UDP reordering or a retransmit after a lost ACK and is discarded — the size of the step matters because early in every session the high-water mark is itself inside the low range. This covers restarts the client initiates by re-logging in *and* ones the server initiates on its own; without it a re-login succeeds and every datagram of the new session is dropped as out-of-order.
- **Protocol token indexing**: `CommandTokens` is typed `[Command, ...string[]]`. `tokens[0]` is always the Command enum value (e.g. `'CHAT'`), NOT the message content. The actual data starts at `tokens[1]`. Commands with `split: true` have whitespace-tokenized data; `split: false` commands have a single string at `tokens[1]`.
- **PV color guard**: `onPV()` discards PV updates for the non-thinking color to prevent a stale post-move flush from corrupting live data. **Retroactive carve-out**: if the last recorded move belongs to that color, the PV may be the engine's *final flush for that move* (the "optional trailing XPV flush" in the per-move cycle above). `applyTrailingPv()` accepts it and patches the move's `moveMeta` entry — including a move that was previously recorded as a book move — gated on four checks: the PV must play out legally from the position *before* the move (replayed from `fenBeforeLastMove`, captured in `onMove`), its first move must equal the move actually played, and its depth and node count must each be ≥ what is already recorded. Patched entries reach the browser via the `updatedMoves` field on `GameDelta`, gated on the `movesPatched` dirty flag.
- **WINFO/BINFO are the authoritative PV line**: after every `WPV`/`BPV` (same search, the sibling `uci-to-tlcs` `info()` in `src/tlcs/protocol.ts`) the server sends `WINFO:`/`BINFO:`, a latest-only line with tag/value pairs in raw UCI units: `depth`, `seldepth`, `score cp N` or `score mate N`, `wdl w d l`, `nodes`, `nps`, `hashfull`, `tbhits`, `time` (ms), with `lowerbound`/`upperbound` as bare flags and `pv` last. Tags the engine did not send are absent, and any order is valid, so `parseInfoTokens()` walks the line and skips tags it does not read (`nps`, the bounds). `onInfo()` shares `onPV()`'s path: the colour guard, the node-count stale guard and the trailing flush. Because the server sends WPV then WINFO, a WINFO with the same node count overwrites the WPV's core fields and PV; a WPV arriving after a WINFO with the same count rewrites only the core fields and leaves the extras alone. A `score mate N` is stored as `±(100000 − |N|)` cp, the encoding WPV uses, so a reader with no mate support still sees a decisive score and the distance is read back from it. Per move and live, `seldepth`, `hashfull`, `tbhits` and `wdl` (engine POV, permille) are kept; `nps` is still computed as `nodes / usedTime`, and the bounds are not stored. A WPV-only search leaves them null, and moves archived before WINFO existed have no such keys.
- **XPV lines are unsequenced; NPS comes from them alone**: `XPV` carries no `< NNN>` id, so it is never ACKed or retransmitted and the id-ordering guard in `UdpTransport` does not apply — lines can be lost or reordered, so `onPV()` drops a line whose `nodes` is below the current search's. Neither depth nor time is used: depth legitimately drops between iterations, and some engines (seen from Catalyst) report a `time_cs` that steps backwards on genuine lines while nodes keep growing. `<time_cs>` is the engine's own search time, kept per move as `usedTime` (ms) next to `nodes`, and NPS is `nodes / usedTime` from that same line. The server's wall-clock move `time` is not a substitute: engines often go quiet for seconds before moving, so the last PV's nodes over the full move time under-reports NPS (issue #218). Moves archived before `usedTime` existed fall back to `time`.
- **Message batching**: The `MessageBuffer` drains every 100ms, so `GameService.onMessages()` receives batches. Game lines are processed in arrival order per board, boards concurrently (a result awaits its saves); every broadcast line waits for all game lines before it, and the lines after it wait for it. Nothing is de-duplicated; only lines the TLCS-MG mode rules out are dropped. Opening and tablebase lookups run once per board per batch, after its lines (`BoardService.lookUpPosition()`), and before each result's save, for the position the last move left (captured at the move: a batch can end on the next move's `FEN`). A reset since that move drops the lookup. A snapshot or catch-up batch holds thousands of moves; a per-move lookup once held a 1828-line batch for 27.5 s.
- **FEN backup recovery**: If `chess.js` fails to parse a move, the game reloads from the most recent FEN command — the `fen` field on `ChessGame` is kept as a backup for this purpose.
- **No-op protocol commands**: `FEATURE` and `level` are recognized in the `Command` enum with no-op handlers. They exist purely to suppress the `Unable to process <cmd>!` warning in `categorizeMessages`. `LOGON SUCCESSFUL` triggers the TLCS-MG opt-in and a `RESULTTABLE` request (see TLCS-MG above). None of these lines is meaningless on the wire: the official client gates all other commands on `LOGON SUCCESSFUL` and only starts its keepalive `PING` after a `FEATURE:` line containing `PING` (see [official-client.md](./official-client.md#session-lifecycle)).
- **Session loss is silent on the wire**: TLCS can drop a client's login while continuing to answer `PING` with `PONG`, so the socket looks healthy while no broadcast data arrives at all. It sometimes — but not reliably — announces this with `MSG: You are no longer connected to the server.  Please re-connect.`; during the 2026-09-12 incident only 2 of 13 dead broadcasts got that notice. Two things respond to it: `GameService.onServerMessage()` re-logs-in immediately on the notice, and `Broadcast`'s ping interval re-logs-in after `env.dataTimeoutMs` (default 10 min) with no non-keepalive message. Which commands count as "alive" is declared per command in `PROVES_LIVENESS` (`src/protocol.ts`), a total map over `Command` so a new command can't silently default to counting. `PONG`, `MSG`, the `LOGON`/`FEATURE`/`level`/`MENU` connection-time lines, the `MULTIGAME`/`BOARDS` handshake replies, and `ADDUSER`/`DELUSER` (a login is answered with the spectator list, our own name included) are excluded, because all of them arrive whether or not the broadcast is alive — a re-login that is acknowledged but restores no data would otherwise look like recovery. Re-login attempts are rate-limited by a separate timestamp rather than by resetting the clock, so `ccrl_broadcast_seconds_since_data` keeps climbing through failed attempts and stays alertable. The watchdog measures from the later of the last data and the last attempt, so a broadcast that stays quiet is retried once per `dataTimeoutMs`; the 60s floor between attempts is lifted once data has arrived since the last one, so a fresh logout notice after a successful re-login is acted on at once.