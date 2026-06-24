---
ingested: 2026-06-04
source_type: plan
author: Claude Agent (direction + approval by Jay Honnold)
synthesis: done
---

# node-tlcv — git worktree support + TLCV fixed-port finding

> Plan + interactive investigation, 2026-05-23. Goal: run `node-tlcv` from
> multiple git worktrees at once. The plan half shipped; the other half was
> **overturned by an empirical protocol finding** during live testing.
> **Outcome:** PR [#155](https://github.com/jhonnold/node-tlcv/pull/155)
> (branch `feat/configurable-backend-port`, commit `86d9f1d`, merged to `main`
> `663ac9e`). See [[node-tlcv]] and the synthesized hub
> [[tlcv-udp-broadcast-protocol]].

## Goal

Check the repo out into a second git worktree and run `npm run dev-server`
alongside the main checkout without collisions. Two collision points were
identified up front:

1. **Backend HTTP/Socket.IO port** — hardcoded `8080` in `src/main.ts`.
2. **Broadcast UDP port** — `UdpTransport` binds the *local* UDP socket to the
   *broadcast* port (`src/transport/udp-transport.ts`, `socket.bind(port)`), so
   two instances on the same broadcast both try to bind that port → `EADDRINUSE`.

Everything else (`config/`, `pgns/`, `build/`) already uses cwd-relative paths,
so it isolates per worktree automatically. `.env` is gitignored; `dotenv` is
already loaded first in `main.ts`.

## Original plan (as approved)

1. **`PORT` env var** — `Number(process.env.PORT) || 8080` in `main.ts`. Frontend
   uses origin-relative Socket.IO, so no client change. *(Shipped.)*
2. **`UDP_EPHEMERAL_BIND` flag** — gate the bind so a secondary worktree binds an
   OS-assigned local port instead of the broadcast port, theoretically letting
   two instances share a broadcast. Production unchanged with the flag unset.
   *(Reverted — see below.)*
3. `.env.example` (committed template) + docs.

## The finding that overturned the ephemeral approach

Live testing on host `192.168.10.201` against `GrahamCCRL.dyndns.org`
(`125.236.131.100`) showed the ephemeral bind connected, logged on, then
received **zero** broadcast data, while the fixed-port bind received ~170
packets/20s. A sequence of UDP probes (sending the app's real `LOGONv15`) pinned
the cause:

| Local bind port | Source port of LOGON | Packets received |
|---|---|---|
| 16067 (broadcast port) | 16067 | 45 ✅ |
| 16090 (in 16000–16100) | 16090 | 0 ❌ |
| 40000 (high) | 40000 | 0 ❌ |
| **16067 (separate listener)** | **40000 (separate sender)** | **41 ✅** |

The last row is decisive: the `LOGON` was sent from source port 40000, yet the
broadcast arrived on a *different* socket bound to 16067. **The TLCS server
streams the broadcast to `clientIP:<broadcast port>` and ignores the source port
entirely.** Therefore:

- `socket.bind(port)` is **mandatory**, not a convention. An ephemeral local
  port can never receive data.
- Two instances on one host **cannot** watch the same broadcast (both need that
  UDP port). This is a protocol constraint, unfixable in pfSense.

Full reasoning lives in [[tlcv-udp-broadcast-protocol]].

## pfSense / NAT angle

`node-tlcv` runs as a client on the LAN behind [[pfsense]] (host `.201`, also
`.202`); production is on AWS (not behind pfSense). Two mechanisms can deliver
the inbound broadcast stream to `clientIP:16067`:

1. **Source-restricted inbound port forward** (UDP `16000–16100` from the chess
   server IP → the host). Delivers `WAN:16067 → host:16067` regardless of NAT
   state.
2. **Static-Port outbound NAT** (Firewall → NAT → Outbound, hybrid) preserving
   the source port so the outbound LOGON's state `[WAN:16067 ↔ server:16067]`
   matches the server's return stream. (This was the May-23 fix for the 16061
   drops.)

The split-socket probe (LOGON from 40000, data on 16067) can **only** be
explained by mechanism (1) — an outbound 40000 state wouldn't match an inbound
packet to 16067. So an inbound `16000–16100 → .201` forward is **active**, which
**contradicts** the [[pfsense]] entity's NAT table marking that forward
`disabled`. Flagged for Jay to verify.

Static Port is a **no-op for ephemeral source ports** — another reason ephemeral
can't work. Recommended hardening: scope outbound rule source = host alias
(`.201`, `.202`), source port `16000:16100`, dest port `16000:16100`, Static Port
on — so Static Port applies only to TLCV flows.

## Shipped result

- `src/main.ts` — `PORT` env var (default 8080; production unchanged).
- `src/transport/udp-transport.ts` — `socket.bind(port)` retained, with a comment
  documenting why it's mandatory. `UDP_EPHEMERAL_BIND` **removed**.
- `.env.example` — new committed template; documents `PORT`.
- `CLAUDE.md` — `PORT` env entry + a gotcha recording the fixed-port/worktree
  constraint.

**Workable worktree model:** each worktree points `config/config.json` at a
**different** broadcast port, and sets a unique `PORT`. Same-broadcast-from-two-
worktrees is impossible on one host.

## Related

- [[node-tlcv]] — the service; `udp-transport.ts`, `main.ts`
- [[tlcv-udp-broadcast-protocol]] — synthesized hub for the fixed-port finding
- [[pfsense]] — NAT delivery + the `disabled`-forward contradiction
