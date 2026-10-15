# Official TLCV Client (Reverse-Engineered)

What Tom's Live Chess Viewer v2.1c does on the wire, recovered by static analysis, and where node-tlcv
differs. Use it as the reference when a protocol question can't be answered from captures.

## Source and Method

- Installer `tlcv-setup.exe` (Inno Setup, sha256 `848ac70b95c38d5166232e1788b02ef8c7c97b69f18ca72972df1b2a1407621e`)
  → `chess_viewer.exe` 2.01.0003, Feb 2006 (sha256 `28513524586fd63da28610852ae0da3cbf21f2fea6605e26ca0e40a848081609`).
- Native-compiled VB6 using the `MSWinsockLib.Winsock` control.
- Static only: unpacked with innoextract, VB6 object/control/event tables parsed, disassembled with capstone,
  MSVBVM60 ordinals resolved against VBA's `rtc*` export table. Nothing was executed; no traffic captured.
- Server (TLCS) behavior is **not** in this binary. Anything about the server below is inferred from what the
  client expects.

## Transport

- UDP. `RemoteHost`/`RemotePort` = configured host/port; **`LocalPort` is set to the same port**. The official
  client always listens on the broadcast port — corroborates the bind rule in [gotchas.md](./gotchas.md).
- One datagram = one command. `DataArrival` does a single `GetData` and dispatches it once; nothing splits on
  newlines and nothing is trimmed. Command prefixes are matched at fixed character positions.
- No buffering: each datagram is handled as it arrives.

## Reliability Layer

Both directions use the same scheme: `<` + `Str(id)` + `>` + body, answered by `ACK:` + `Str(id)`. VB's `Str()`
prefixes positive numbers with a space, so the client's own wire form is `< 42>CHAT: hi` / `ACK: 42`. Both ends
parse with `Val()`, which skips spaces.

**Receiving** (`CommandLoop` @ `0x42b4c9`):

1. Body starts with `<` and `>` is found after position 2 → `id = Val(between)`; continue only if `id > 0`.
2. Send plain `ACK: <id>` — for **every** copy, duplicates included.
3. Strip the prefix.
4. If `id` is in a ring of the **last 100 ids seen**, drop the body. Otherwise remember it.
5. Dispatch. **No ordering check**: a lower id that is not in the ring is processed.

**Sending** (`SafeSendMessage` @ `0x42facb`, retransmit Timer4 @ `0x42a7b9`):

| Field | Value |
| --- | --- |
| Id | Process-wide counter, +1 per sequenced send |
| Queue | 1000 slots; body stored as a fixed 100-char string |
| ACK | Server body starting `ACK:` → `Val(Mid(body, 5))` marks the slot acked |
| Resend | Timer4 (1 s) resends unacked slots older than 1.0 s → about every 2 s |
| Give up | After ~30 resends (~60 s) |
| Quirk | Retransmits use the stored copy, so bodies over 100 chars are truncated on resend |

## Session Lifecycle

1. Connect: send plain `LOGONv15:<alias>`; Timer1 (3 s) resends it up to 3 more times, then fails (~12 s).
2. The body must equal exactly `LOGON SUCCESSFUL`. Until then **every other command is ignored** (sequenced
   messages are still ACKed).
3. `FEATURE:` containing `PING` enables keepalive. Without it the client never pings.
4. Keepalive (Timer5, 1 s ticks): sends **sequenced** `PING` every 20 s. Any received datagram resets a
   missed-seconds counter; `PONG` also clears the wait. Status turns slow at 10 s, very slow at 30 s, no response at
   50 s, and the client disconnects after 70 s.
5. `LOGOFF` (plain) on disconnect, quit or window close. There is no automatic re-login.

## Server → Client Commands

Checked in this order; first match wins. "n chars" = case-sensitive prefix of that length. Positions are 1-based
into the body after the `< N>` prefix is removed.

| Command | Match | Parse | Official client effect |
| --- | --- | --- | --- |
| `LOGON SUCCESSFUL` | exact | — | Ends logon retry; opens the gate |
| `WPLAYER: <name>` / `BPLAYER:` | 8 chars | `Mid(body, 10)` | Name label |
| `FEN: <fen>` | 4 chars | `Mid(body, 6)` | Board redrawn from this FEN; history counter reset when it equals exactly `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq` |
| `WPV:` / `BPV: <d> <cp> <cs> <nodes> <pv…>` | 4 chars | space tokens | That side's pane: cp/100, cs/100 s, nodes, NPS. Unconditional overwrite |
| `result …` | 6 chars | whole body | Stops clocks, result popup, game over |
| `WTIME: <cs> otim <cs>` / `BTIME:` | 6 chars | split on `otim` | Sets **both** clocks (centiseconds). `otim` is required |
| `level …` | 5 chars | fields from pos 7 | Time-control label |
| `WMOVE: <n>. <san>` / `BMOVE:` | 6 chars | text after prefix / after `.` | Appended to the move-list text; not validated |
| `CHAT: <text>` | 5 chars | `Mid(body, 6)` | Chat window + `chat.txt` |
| `SITE: <text>` | 5 chars | `Mid(body, 6)` | Title label |
| `CTRESET` | exact | — | Clears crosstable |
| `CT:<line>` | 3 chars | `Mid(body, 4)` (no trim) | Appends crosstable line |
| `ADDUSER: <n>` / `DELUSER: <n>` | 8 chars | `Mid(body, 9)` | Spectator list |
| `GL:<line>` | 3 chars | `Mid(body, 4)` | Game list (reply to `GAMELIST`) |
| `MSG: <text>` | 4 chars | `Mid(body, 5)` | Modal message box |
| `FMR: <n>` | 4 chars | trimmed | Fifty-move counter |
| `ACK: <id>` | 4 chars | `Val(Mid(body, 5))` | Acks a client-sent sequenced message |
| `SECUSER: …` | 8 chars | split on `:` | Admin user list |
| `MENU ID=… WIDTH=… HEIGHT=… NAME="…" URL="…"` | `MENU ` | NAME/URL read **between double quotes** | Custom menu item |
| `FEATURE: …PING…` | 8 chars | `InStr` for `PING` | Enables keepalive |
| `PONG` | 4 chars | — | Clears keepalive wait |

Unknown bodies are ignored. The client has no handler for a server `PING`.

## Client → Server Commands

| Message | Delivery |
| --- | --- |
| `LOGONv15:<alias>` | plain, retried every 3 s |
| `ACK: <id>` | plain |
| `PING` | sequenced, every 20 s after `FEATURE` |
| `CHAT: <text>` | sequenced (no alias; the server adds it) |
| `VOTE: <text>`, `CHANGE: <newalias>` | sequenced |
| `LOGOFF`, `RESULTTABLE`, `GAMELIST`, `SECURITY`, `BOOT:<u>`, `SRBOOT:<u>`, `EMAIL: <addr>` | plain |

## Ordering: Official Client vs node-tlcv

The official client never reorders, buffers or guards. It can afford that because it keeps no game state: the
board is the last `FEN` received, the move list is append-only text, and each side's PV pane shows the last
`xPV` received. A stale datagram shows stale data until the next one.

node-tlcv replays moves through chess.js, so it can't apply a late `WMOVE` the same way. Most of its ordering
logic is a consequence of that model:

| node-tlcv behavior | Official client | Assessment |
| --- | --- | --- |
| 100 ms `MessageBuffer` batches, processed in arrival order | Immediate, arrival order | Aligned — order preserved |
| Drops any id ≤ last seen (`UdpTransport.onMessage`) | Drops only ids in the last-100 ring; late unseen ids are processed | Justified for game state. Order-insensitive commands (`CHAT`, `ADDUSER`, `DELUSER`, `CT`, `MSG`) are dropped for no benefit |
| `isIdRestart` heuristic | Not needed — never compares ids | Consequence of the row above |
| Drops PV for the non-thinking color; patches it onto the last move when it is the trailing flush | Separate panes; every PV overwrites its side's pane | Justified — node has one live-PV slot. The trailing patch is node-only |
| Drops a PV with fewer nodes than current | No check | Stricter; harmless |
| Board advanced by SAN; `FEN` kept as backup, applied on load/startpos/parse failure | Board = last `FEN` | Different model. Works because the server sends `FEN` before `xMOVE`, so the backup is already post-move |
| Startpos reset on `FEN` prefix | Exact whole-FEN compare | Aligned; confirms TLCS sends only board, side and castling |

## Other Differences

| Area | Official client | node-tlcv |
| --- | --- | --- |
| `MENU` parsing | NAME/URL taken between quotes; spaces allowed; keyed by `ID=` | Whitespace-split tokens: `NAME="Live Games"` becomes `live`; keyed by lowercased name (`onMenu`) |
| `WTIME`/`BTIME` | Sets both clocks from own value + `otim` | Uses only the first number |
| `PING` | Sequenced, every 20 s, only after `FEATURE` advertises it | Plain, every 10 s, always |
| `CHAT` send | Sequenced, retransmitted up to ~60 s | Plain, sent once |
| ACK text | `ACK: 42` | `ACK:  42` — `idString` keeps the server's leading space, then the template adds one. Presumably tolerated (`Val()`); unconfirmed |
| Logon gate | Ignores everything before `LOGON SUCCESSFUL` | Processes everything |
| Logon retry | Every 3 s, 4 attempts | Watchdog (`dataTimeoutMs`) or `MSG` logout notice |
| `CT:` lines | Not trimmed | `splitOnCommand` trims both ends |
| `GL:`, `SECUSER:`, `ACK:` | Handled | Not in `Command`; dropped (node never requests them) |

## Open Questions

- Winsock property mapping is inferred from DISPIDs (0x0A RemoteHost, 0x01/0x02 RemotePort/LocalPort, 0x43
  SendData, 0x44 GetData, 0x46 Close); both port DISPIDs receive the same value, so the bind conclusion holds
  either way.
- Whether TLCS retransmits unacked messages to clients, accepts plain `CHAT`, and parses `ACK:  n` — a capture of
  the official client against a live server would settle these.
- Not traced in detail: `level` fields, the `EMAIL`/`SEND` second message, `SECUSER` semantics.
