# Metrics Subsystem

Prometheus metrics via `prom-client`. `src/metrics.ts` owns a single `Registry` (`ccrl_` prefix, plus default Node process metrics) and is scraped at `GET /admin/metrics` (basic-auth protected, same as the rest of `/admin`).

## Gauges

Recomputed at scrape time via `collect()`:

| Metric | Description |
|--------|-------------|
| `ccrl_broadcasts_active` | Number of active broadcasts |
| `ccrl_broadcast_spectators` | Total spectators |
| `ccrl_broadcast_browser_connections` | Browser connections |
| `ccrl_game_move_number` | Current move number |
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

Gauges read live state (`broadcasts` map, `KibitzerManager`) at scrape time, so no per-event wiring is needed for them.