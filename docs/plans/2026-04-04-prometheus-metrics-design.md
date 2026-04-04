# Prometheus Metrics Endpoint Design

## Overview

Add a `/admin/metrics` endpoint for Prometheus pull-based collection, providing both operational health and usage insights for the CCRL live chess broadcast service.

## Decisions

- **Library:** `prom-client` (standard Node.js Prometheus client)
- **Prefix:** `ccrl_` (matches production domain ccrl.live)
- **Approach:** Centralized metrics module (`src/metrics.ts`) with counters instrumented at call sites
- **Route:** `GET /admin/metrics` behind existing basic auth in `src/routes/admin.ts`
- **Default process metrics:** Enabled (`ccrl_process_*`, `ccrl_nodejs_*`)
- **Privacy:** No PII — no usernames, IPs, locations, or chat message content in any metric or label

## Metric Definitions

### Gauges (collected at scrape time via `collect()` callbacks)

| Metric | Labels | Source |
|--------|--------|--------|
| `ccrl_broadcasts_active` | — | `broadcasts.size` |
| `ccrl_broadcast_spectators` | `port`, `event` | `broadcast.spectators.size` |
| `ccrl_broadcast_browser_connections` | `port`, `event` | `broadcast.browserCount` |
| `ccrl_kibitzer_total` | — | count of kibitzer entries |
| `ccrl_kibitzer_ready` | `id`, `engine`, `type` | `status.ready` (1/0) |
| `ccrl_kibitzer_target_port` | `id`, `engine`, `type` | `status.targetPort` (0 if unassigned) |
| `ccrl_game_move_number` | `port`, `event` | `game.moveMeta.length` |

### Counters (instrumented at call sites)

| Metric | Labels | Increment Location |
|--------|--------|--------------------|
| `ccrl_udp_messages_received_total` | `port`, `event` | `udp-transport.ts` on message receive |
| `ccrl_udp_messages_out_of_order_total` | `port`, `event` | `udp-transport.ts` on sequence violation |
| `ccrl_commands_processed_total` | `port`, `event`, `command` | `game-service.ts` in `onMessages()` |
| `ccrl_chat_messages_total` | `port`, `event` | `game-service.ts` on CHAT command |
| `ccrl_spectator_joins_total` | `port`, `event` | `socket-io-adapter.ts` on join |
| `ccrl_spectator_leaves_total` | `port`, `event` | `socket-io-adapter.ts` on disconnect |
| `ccrl_socket_emissions_total` | `port`, `event`, `type` | `socket-io-adapter.ts` on emitUpdate/emitChat |
| `ccrl_kibitzer_assignments_total` | `id` | `kibitzer-manager.ts` on reassignment |
| `ccrl_message_buffer_errors_total` | `port` | `message-buffer.ts` on processing error |

### Default Process Metrics

Enabled via `collectDefaultMetrics({ prefix: 'ccrl_' })`:
- `ccrl_process_cpu_seconds_total`, `ccrl_process_resident_memory_bytes`
- `ccrl_nodejs_eventloop_lag_seconds`, `ccrl_nodejs_heap_size_*_bytes`
- `ccrl_nodejs_active_handles_total`, etc.

## Architecture

### New Files

- `src/metrics.ts` — All metric definitions, gauge `collect()` callbacks, counter exports

### Modified Files

- `src/routes/admin.ts` — Add `GET /metrics` route, calls `register.metrics()`
- `src/transport/udp-transport.ts` — Increment `ccrl_udp_messages_received_total`, `ccrl_udp_messages_out_of_order_total`
- `src/game-service.ts` — Increment `ccrl_commands_processed_total`, `ccrl_chat_messages_total`
- `src/socket-io-adapter.ts` — Increment `ccrl_spectator_joins_total`, `ccrl_spectator_leaves_total`, `ccrl_socket_emissions_total`
- `src/kibitzer/kibitzer-manager.ts` — Increment `ccrl_kibitzer_assignments_total`
- `src/transport/message-buffer.ts` — Increment `ccrl_message_buffer_errors_total`
- `package.json` — Add `prom-client` dependency

### Data Flow

```
Prometheus scraper
  → GET /admin/metrics (basic auth: admin / TLCV_PASSWORD)
  → Express route in admin.ts
  → prom-client register.metrics()
  → collect() callbacks read broadcasts Map + KibitzerManager.getStatus()
  → Returns text/plain OpenMetrics format
```

### Label Resolution

Counter call sites resolve `event` from `broadcasts.get(port)?.game.site ?? 'unknown'`. The `broadcasts` Map is already imported as a global in these files.

### Prometheus Scrape Config (reference)

```yaml
scrape_configs:
  - job_name: ccrl
    metrics_path: /admin/metrics
    basic_auth:
      username: admin
      password: <TLCV_PASSWORD>
```
