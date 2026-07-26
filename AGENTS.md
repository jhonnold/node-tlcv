# AGENTS.md

Node TLCV provides a live chess viewer for Tom's Live Chess Server broadcasts. Connects via UDP, processes game state, serves real-time data over Socket.IO.

**Production**: https://ccrl.live/

## Commands

```bash
npm install && npm run build   # Install + compile
npm run dev-server              # Backend (nodemon, auto-restart on src/ & shared/ changes)
npm run dev-public              # Frontend (webpack watch)
npm run start                   # Production build (port 8080)
npm run lint                    # ESLint + fix
npm run format                  # Prettier
```

Development requires two terminals: `dev-server` + `dev-public`. Build runs `prebuild` (webpack prod) before TypeScript compile.

## Key Conventions

- **ESM**: use `.js` extensions in backend imports (`import foo from './foo.js'`)
- **TypeScript**: strict mode, ESNext target
- **Formatting**: Prettier (120 width, single quotes, trailing commas)
- **Node >= 18**, npm
- **Verification**: `npm run build` (no test infrastructure)

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
| Frontend components | `public/js/` (entry: `index.ts`) |
| Shared types | `shared/types.ts` |
| Config | `config/config.json` |
| Styles | `public/css/` (SCSS partials) |

## Progressive Disclosure

These files load on demand — only read what your task needs:

- [CONVENTIONS.md](./CONVENTIONS.md) — Full code style, tooling, Sass conventions
- [docs/protocol.md](./docs/protocol.md) — TLCS message flow, commands, per-move cycle
- [docs/kibitzer.md](./docs/kibitzer.md) — Engine analysis transports (local, SSH)
- [docs/webhooks.md](./docs/webhooks.md) — Outbound Discord webhooks
- [docs/metrics.md](./docs/metrics.md) — Prometheus instrumentation
- [docs/frontend.md](./docs/frontend.md) — Frontend architecture, theming, Socket.IO events
- [docs/gotchas.md](./docs/gotchas.md) — General gotchas (UDP bind, Lichess API, config)