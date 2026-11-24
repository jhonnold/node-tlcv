# Metrics Subsystem

Prometheus metrics via `prom-client`. `src/metrics.ts` owns a single `Registry` (`ccrl_` prefix, plus default Node process metrics) and is scraped at `GET /admin/metrics` (basic-auth protected, same as the rest of `/admin`).

## Gauges

Per-broadcast gauges are labeled `port`/`event`; `ccrl_game_move_number` adds `board`.

Recomputed at scrape time via `collect()`:

| Metric | Description |
|--------|-------------|
| `ccrl_broadcasts_active` | Number of active broadcasts |
| `ccrl_broadcast_spectators` | Total spectators |
| `ccrl_broadcast_browser_connections` | Browser connections |
| `ccrl_game_move_number` | Current move number, one series per board (`board="1"` on a classic broadcast). The `board` label arrived with TLCS-MG: every existing series became a new one, so a query for the old per-broadcast value filters `{board="1"}` or aggregates `max by (port)`. Cardinality: one series per board id the broadcast has seen (bounded by the server's concurrency; boards are not removed in v1). |
| `ccrl_broadcast_boards` | Boards per broadcast: 1 for classic TLCS; for TLCS-MG every board seen (never removed in v1), not only those playing |
| `ccrl_broadcast_multigame` | 1 while the broadcast is in TLCS-MG mode, else 0 (classic, or the handshake still pending — so it reads 0 for up to the retry window after every re-login) |
| `ccrl_broadcast_seconds_since_data` | Seconds since the last message proving the session is fed (`PROVES_LIVENESS` in `protocol.ts` — excludes `PONG`, `MSG`, handshake lines and `ADDUSER`/`DELUSER`). Not reset by re-login attempts. The signal to alarm on — `PONG` keeps flowing after TLCS logs the client out, so UDP message rate can't tell a live broadcast from a dead one. |
| `ccrl_kibitzer_total` | Total kibitzers configured |
| `ccrl_kibitzer_ready` | Kibitzers in ready state |
| `ccrl_kibitzer_target_port` | Labeled by `port`/`event` |

## Histograms

Observed at call sites:

| Metric | Labels | Instrumented In |
|--------|--------|-----------------|
| `ccrl_http_request_duration_seconds` | `method`/`route`/`status` | `util/http-metrics.ts` |
| `ccrl_lichess_request_duration_seconds` | `endpoint`/`outcome` | `services/lichess.ts` (`fetchOpening`, `fetchTablebase`) |

## Counters

Incremented inline at the event site:

| Metric | Instrumented In |
|--------|-----------------|
| `ccrl_udp_messages_received_total` | `transport/udp-transport.ts` |
| `ccrl_udp_messages_out_of_order_total` | `transport/udp-transport.ts` |
| `ccrl_commands_processed_total` | `game-service.ts` |
| `ccrl_chat_messages_total` | `game-service.ts` |
| `ccrl_spectator_joins_total` | `socket-io-adapter.ts` |
| `ccrl_spectator_leaves_total` | `socket-io-adapter.ts` |
| `ccrl_socket_emissions_total` | `socket-io-adapter.ts` |
| `ccrl_kibitzer_assignments_total` | `kibitzer/kibitzer-manager.ts` |
| `ccrl_message_buffer_errors_total` | `transport/message-buffer.ts` |
| `ccrl_relogin_attempts_total` | `broadcast.ts` (labeled `reason`: `watchdog` / `server-notice`) |

Gauges read live state (`broadcasts` map, `KibitzerManager`) at scrape time, so no per-event wiring is needed for them.