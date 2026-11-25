# Webhook Subsystem

Outbound webhooks POST a notification when a game **starts** or **finishes**. Configs are stored in `config.json` under the `webhooks` key and managed at runtime from the admin panel. Mirrors the kibitzer pattern (discriminated-union-by-`type`, config-backed, runtime-managed, admin-editable).

## Files

| File | Purpose |
|------|---------|
| `src/webhooks/types.ts` | `WebhookConfig` discriminated union (`DiscordWebhookConfig`), `WebhookEvent` payload (`GameStartedEvent | GameFinishedEvent`), `WebhookSender` interface |
| `src/webhooks/discord-sender.ts` | Formats events as Discord embeds, POSTs via Node's global `fetch` |
| `src/webhooks/sender-factory.ts` | `createSender()` builds a sender from a config based on its `type` |
| `src/webhooks/webhook-manager.ts` | Owns configs/senders; `dispatch()` applies port + event filters and fans out |
| `src/webhooks/index.ts` | Barrel export |

## Data Flow

`BoardService` calls `getWebhookManager()?.dispatch(event)` from `onPlayer()` (game-started) and `onResult()` (game-finished). `dispatch()` is **fire-and-forget** — it filters each webhook by `ports` (empty = all) and `events` (empty = both), then calls `sender.send()` without awaiting. Senders catch all errors internally and never throw, so a failed webhook never blocks game processing.

## Game-Started Detection

`onPlayer()` fires once per color. `BoardService` uses a re-arm state machine (`gameStartArmed` + `startColorsSeen`) — armed at construction and re-armed after each `RESULT`, it fires exactly once per game when both colors have been announced. This avoids keying on the 100ms-debounced `currentGameNumber`.

Every event carries its `board` (`1` on a classic broadcast). On a TLCS-MG broadcast (see [protocol.md](./protocol.md#tlcs-mg-multigame)) `game-started` fires for every board with `gameNumber: null` (the tournament number only arrives with the result's `GAMENO`; the CT-derived one is wrong for concurrent games), and `game-finished` fires for every board whose result follows a `GAMENO`, numbered by it, and is skipped without one. Outside TLCS-MG mode `game-started` keeps the CT-derived number. The Discord embed links to the broadcast's viewer (`/${port}`) and titles a numberless start "Game started on board N". The `ports` filter is per broadcast; there is no per-board filter.

## Webhook Gotchas

- **Fire-and-forget**: Do not `await` `dispatch()`. `DiscordSender.send()` catches every error and always resolves, so a slow or failing webhook never blocks `onResult()` / the message batch.
- **Game-started dedup**: Connecting mid-game fires one game-started for the already-in-progress game — accepted.
- **URL is a secret**: Discord webhook URLs embed a token. The admin table masks all but the last 8 chars, but the full URL is still sent in the `GET /admin/webhooks` JSON (the Edit form is prefilled from it; the admin routes are basic-auth protected).
- **TLCS-MG connect**: connecting (or restarting) mid-tournament fires one `game-started` per board with a game in progress (fresh boards are armed; the snapshot re-announces players). A re-LOGON does not re-fire: entering `mg` resets the boards but not their arming. Bare lines that arrive before the server's `MULTIGAME:` reply (after a connect or a re-LOGON) feed board 1 in `pending` mode, so a `game-started` fired then (board 1 armed) carries the CT-derived number, possibly wrong — rare, at most once per pending window.
