---
source_url: https://github.com/jhonnold/node-tlcv/pull/169
ingested: 2026-06-04
source_type: plan
author: jhonnold / claude_code
synthesis: done
---

# node-tlcv — per-route HTTP request metrics (PR #169)

Closes the [[node-tlcv]] observability gap exposed by
[[node-tlcv-homepage-cpu-credit-incident]] (2026-05-25): the `ccrl_*`
series were all domain gauges/counters with **zero HTTP request
instrumentation**, so during the incident CPU climbed with nothing
pointing at the responsible route. Shipped as
[PR #169](https://github.com/jhonnold/node-tlcv/pull/169)
(`feat: add per-route HTTP request metrics + Grafana panels`),
merged and deployed 2026-05-26.

## Approach

One `prom-client` `Histogram` —
`ccrl_http_request_duration_seconds`, labeled
`{method, route, status}` — observed by a new Express middleware.
A single histogram covers all three asks:

- **Volume** = `_count` (`rate(ccrl_http_request_duration_seconds_count[5m])`)
- **Availability** = the `status` label (e.g. error ratio for `status=~"5.."`)
- **Latency p50 / p90 / p99** = `_bucket` via
  `histogram_quantile()` in PromQL

Buckets in seconds:
`[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]` — tuned
for fast in-memory EJS renders (~ms) up to filesystem / `JSON.parse`
work (the incident's cost landed ~0.1–0.5s+).

`status` is the full 3-digit code string (not the class) — 4xx vs
5xx stays distinguishable while cardinality stays bounded. PromQL
regex-classing on `status=~"5.."` etc. is still available on the fly.

## Middleware

New file `src/util/http-metrics.ts`, mirrors `src/util/logging.ts`:
captures `start = process.hrtime.bigint()` and registers
`onFinished(res, observe)` so `req.route` and the final
`res.statusCode` are populated by observation time. Mounted in
`src/app.ts` **immediately after `logging`** (before `cors`, static,
routers, and the catch-all) so it wraps every served path.

### Route-label normalization

- Matched routes → `(req.baseUrl || '') + req.route.path`, with
  Express inline regex constraints stripped
  (`/:port([0-9]+)/pgn` → `/:port/pgn`). Admin sub-routes compose
  correctly because `baseUrl = '/admin'` for that router.
- Unmatched fallback paths get one of two collapsing labels:
  - `<static>` — asset-shaped (matched by an extension regex covering
    `.js .mjs .css .map .ico .png .svg .jpg .jpeg .gif .webp .mp3
    .wav .woff .woff2 .ttf`, plus the `img/`, `audio/`, `pgns/` dirs)
  - `<unmatched>` — everything else that falls through to
    `app.use('*')`

Cardinality is bounded by `methods (~3) × routes (~25 templated) ×
statuses (~8)`. The `<static>` label is the key defense against
unbounded asset/PGN URLs.

## Skipped traffic

- `/admin/metrics` — the Prometheus scraper hits this every ~30s; if
  recorded it would dominate every panel.
- `/socket.io/*` — transport polling, not a content route.

Both short-circuit at middleware entry with a `next()` and no
observation.

## Grafana

`config/grafana-dashboard.json` gains two new rows
(top-level `version` 1 → 2): **HTTP — Pages** and **HTTP — API**,
separated **purely in the dashboard** via PromQL regex on the
`route` label (no `kind` label on the metric itself):

- Pages: `route=~"/|/:port|/archive/:slug|/admin"`
- API: `route=~"/broadcasts|/:port/.+|/archive/:slug/.+|/admin/.+"`

Each row carries volume-by-route, p50/p90/p99 latency, and a 5xx
error-rate panel. The Pages row leads with two overall stats
(total req/s, overall error %). The API row appends a **Slowest
Routes (p99)** table sorted descending. Dashboard is UI-imported
per [[monitoring]] runbook — the committed JSON has no effect until
a manual re-import (overwrite uid `ccrl-live`).

## Decisions (and what was deliberately not done)

- **No alert rules** in scope — metric + dashboard only. Per-route
  latency / error-rate alerts can come later; the new metric is the
  foundation, and the existing [[2026-05-23-ccrl-outage-alerting-plan]]
  whole-feed-stall rule remains the only HTTP-adjacent alert.
- **No `kind = page | endpoint | static` label** on the metric — Jay's
  call. Pages and APIs are split via the PromQL matchers above; the
  metric label set stays minimal.
- **`status` is a full code string**, not a class — full resolution
  at bounded cardinality.

## Live verification — two bugs the isolated harness missed

End-to-end testing in a worktree against live broadcasts (Playwright
driving the UI plus curl probes plus an authed `/admin/metrics`
scrape) caught two bugs in the route-normalization logic that
reasoning and an isolated Express harness both failed to surface:

1. **Root-level bundles mislabeled.** The first `STATIC_PATH` regex
   was prefix-based (`^/(js|css|img|audio|pgns)(/|$)`). But webpack
   emits the JS / CSS bundles to the **root** of `build/public`
   (`/main.bundle.js`, `/main.css`, `/admin.bundle.js`,
   `/broadcasts.bundle.js`) — there are **no** `/js/` or `/css/`
   subdirectories. Real bundle requests were falling into
   `<unmatched>` instead of `<static>`. Fix: switch to an
   extension-based matcher.
2. **`app.use('*', …)` rewrites `req.path`.** For asset *misses*
   that fall through to the catch-all, by the time `onFinished`
   fires Express has mutated `req.path` (mount-path semantics on
   the `'*'` mount). The static-vs-unmatched test was running
   against a munged path. Fix: capture `const originalPath = req.path`
   at middleware **entry** (before `next()`) and classify the
   fallback against that. `req.route` and `res.statusCode` are
   still safely read inside `onFinished` because those are set by
   reference on the same `req` / `res` object as routing progresses.

Both fixes are now also recorded as gotchas on [[node-tlcv]].

## Deploy

Backend change: full path per the [[node-tlcv]] deploy runbook —
`git stash` `config/config.json`, `git pull`, `git stash pop`,
`npm run build`, `sudo systemctl restart tlcv`. No new dependencies
(reuses `prom-client ^15.1.3` and `on-finished`). Dashboard JSON
must be **manually re-imported** into Grafana (overwrite uid
`ccrl-live`) — provisioning is empty per [[monitoring]].

Deployed 2026-05-26: build clean, service active, all 12 broadcasts
reconnected post-restart. Grafana's existing `ccrl.live` scrape
job picks up `ccrl_http_request_duration_seconds` automatically
within ~30s.

## Related

- [[node-tlcv]] — service entity; Observability and Gotchas updated
  to reference this work
- [[node-tlcv-homepage-cpu-credit-incident]] — the 2026-05-25
  incident that exposed this metrics gap
- [[monitoring]] — Prometheus / Grafana stack and the `ccrl.live`
  scrape job
- [[2026-04-04-node-tlcv-prometheus-metrics-design]] /
  [[2026-04-04-node-tlcv-prometheus-metrics-plan]] — the original
  metrics subsystem this extends
- [[2026-05-23-ccrl-outage-alerting-plan]] — prior alerting work;
  a natural next step is per-route latency / error-rate alerts on
  this histogram
