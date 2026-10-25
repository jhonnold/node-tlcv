# AGENTS.md

Node TLCV provides a live chess viewer for Tom's Live Chess Server broadcasts. Connects via UDP, processes game state, serves real-time data over Socket.IO.

**Production**: https://ccrl.live/

## Commands

```bash
npm install && npm run build   # Install + compile
npm run dev-server              # Backend (nodemon, auto-restart on src/ & shared/ changes)
npm run dev-public              # Frontend (vite build --watch → build/public)
npm run start                   # Production build (port 8080)
npm run check                   # svelte-check (web/)
npm run lint                    # ESLint + fix
npm run format                  # Prettier
```

Development requires two terminals: `dev-server` + `dev-public`. Build runs `prebuild` (`vite build`) before TypeScript compile.

## Key Conventions

- **ESM**: use `.js` extensions in backend imports (`import foo from './foo.js'`)
- **web/** imports: no file extension; `$lib/…` and `$shared/…` aliases
- **TypeScript**: strict mode, ESNext target
- **Formatting**: Prettier (120 width, single quotes, trailing commas)
- **Node `^20.19.0 || >=22.12.0`**, npm
- **Verification**: `npm run build`, `npm run check`, `npm run lint`

## Navigation

| Need | Path |
|------|------|
| Entry point, server setup | `src/main.ts`, `src/app.ts` |
| Broadcast lifecycle, state | `src/broadcast.ts`, `src/connection.ts` |
| Chess server protocol parsing | `src/game-service.ts`, `src/protocol.ts` |
| UDP transport | `src/transport/` |
| Kibitzers (engine analysis) | `src/kibitzer/` |
| Webhooks (Discord) | `src/webhooks/` |
| Metrics (Prometheus) | `src/metrics.ts` |
| SPA shell, JSON API routes | `src/routes/spa.ts`, `src/routes/index.ts`, `src/routes/admin.ts` |
| Frontend entry, router | `web/src/main.ts`, `web/src/App.svelte`, `web/src/lib/router.svelte.ts` |
| Pages | `web/src/pages/` (Lobby, Viewer, Admin) |
| Components | `web/src/components/` |
| Client state and logic | `web/src/lib/` (`game.svelte.ts`, `tournament.svelte.ts`, `theme/`) |
| Styles, theme tokens | `web/src/styles/tokens.css`, `web/src/lib/theme/presets.ts` |
| Static assets | `web/public/` |
| Build config | `vite.config.ts`, `web/svelte.config.js`, `web/tsconfig.json` |
| Shared types | `shared/types.ts` |
| Config | `config/config.json` |

## Progressive Disclosure

These files load on demand — only read what your task needs:

- [CONVENTIONS.md](./CONVENTIONS.md) — Full code style, tooling, Svelte and style conventions
- [docs/protocol.md](./docs/protocol.md) — TLCS message flow, commands, per-move cycle
- [docs/official-client.md](./docs/official-client.md) — Reverse-engineered official TLCV client: wire protocol, ordering, differences from node-tlcv
- [docs/kibitzer.md](./docs/kibitzer.md) — Engine analysis transports (local, SSH)
- [docs/webhooks.md](./docs/webhooks.md) — Outbound Discord webhooks
- [docs/metrics.md](./docs/metrics.md) — Prometheus instrumentation
- [docs/frontend.md](./docs/frontend.md) — Svelte SPA: routing, stores, components, theming, REST API, Socket.IO events, gotchas
- [docs/gotchas.md](./docs/gotchas.md) — General gotchas (UDP bind, Lichess API, config)