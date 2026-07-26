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

`GameService` calls `getWebhookManager()?.dispatch(event)` from `onPlayer()` (game-started) and `onResult()` (game-finished). `dispatch()` is **fire-and-forget** — it filters each webhook by `ports` (empty = all) and `events` (empty = both), then calls `sender.send()` without awaiting. Senders catch all errors internally and never throw, so a failed webhook never blocks game processing.

## Game-Started Detection

`onPlayer()` fires once per color. `GameService` uses a re-arm state machine (`gameStartArmed` + `startColorsSeen`) — armed at construction and re-armed after each `RESULT`, it fires exactly once per game when both colors have been announced. This avoids keying on the 100ms-debounced `currentGameNumber`.

## Webhook Gotchas

- **Fire-and-forget**: Do not `await` `dispatch()`. `DiscordSender.send()` catches every error and always resolves, so a slow or failing webhook never blocks `onResult()` / the message batch.
- **Game-started dedup**: Connecting mid-game fires one game-started for the already-in-progress game — accepted.
- **URL is a secret**: Discord webhook URLs embed a token. The admin table masks all but the last 8 chars, but the edit button still carries the full URL in a `data-url` attribute (admin page is basic-auth protected).