---
source_url: 
ingested: 2026-06-04
source_type: plan
author: Claude Agent (direction + approval by Jay Honnold)
synthesis: done
---

# node-tlcv — push spectator-list changes live for browser viewers

> Internal plan, authored and executed interactively on 2026-05-23.
> **Outcome:** implemented and shipped as PR
> [#151](https://github.com/jhonnold/node-tlcv/pull/151) on branch
> `fix/live-spectator-updates`; `npm run build` passes and the fix was
> verified live with two browser tabs against broadcast `16061`. Filed as
> issue [#150](https://github.com/jhonnold/node-tlcv/issues/150). See
> [[node-tlcv]].

## Context

The bug surfaced organically in the [ccrl.live](https://ccrl.live/) chat: a
regular viewer (Lars) complained the connected-viewers list "never shows people
without refreshing" — refreshing changed his visitor count from 7 to 9. Jay's
expectation was that it "should be live," and another viewer (Martin) joked
"claude pls fix." Jay then told the channel "I'll have claude check in on that."

## Root cause

Two independent sources mutate the shared `broadcast.spectators` `Set`, and only
one of them was being broadcast to already-connected clients:

1. **TLCS-server users** arrive over UDP as `ADDUSER` / `DELUSER`. These flow
   through `GameService.onAddUser` / `onDelUser` (`src/game-service.ts`), which
   set `dirty.spectators`; `buildDelta()` then serializes the full list as
   `delta.spectators`, and `Broadcast.run()` calls `emitUpdate(port, delta)` to
   the **whole Socket.IO room**. Already pushed live.
2. **Browser viewers** arrive over Socket.IO via the `join` / `nick` /
   `disconnect` handlers in `src/socket-io-adapter.ts`. These mutated
   `broadcast.spectators` directly but **never `emitUpdate` to the room** —
   `join` and `nick` only `socket.emit('state', …)` to the *single acting
   socket*, and `disconnect` emitted nothing.

So a browser viewer joining or leaving was invisible to everyone already on the
page until they reloaded.

## Key point — downstream path was already correct

No type or frontend changes were needed:

- `buildDelta()` already serializes `delta.spectators = Array.from(...)`
  (`src/game-service.ts`).
- `BroadcastDelta.spectators?` already exists in `shared/types.ts`.
- The frontend already merges `delta.spectators` in `applyDelta()`
  (`public/js/index.ts`) and re-renders via `updateSpectators()`
  (`public/js/components/game/player-info.ts`).

A room-wide `update` carrying `{ spectators: [...] }` therefore Just Works. The
fix is purely about *emitting* that update from the browser-driven mutation sites.

## Change (1 file)

`src/socket-io-adapter.ts` — `emitUpdate` is already imported there. Added a
small helper and called it after each browser-driven mutation:

```ts
function emitSpectators(broadcast: Broadcast): void {
  emitUpdate(broadcast.port, { spectators: Array.from(broadcast.spectators) });
}
```

Wired into all three handlers:

- **`join`** — after `socket.join(...)` / `socket.emit('state', …)` so existing
  clients see the newcomer.
- **`nick`** — after the delete-old / add-new + the existing `socket.emit('state', …)`.
- **`disconnect`** — after `broadcast.spectators.delete(username)`.

`emitSpectators` is a hoisted function declaration, so referencing it from the
connection callbacks before its textual position is fine.

## Verification

- `npm run build` (tsc + webpack) passes clean (exit 0, no errors).
- **Live, two browser tabs** via local `dev-server` + `dev-public` against
  broadcast `16061`:
  - **Join:** opening Tester-B → Tester-A's list gained Tester-B.
  - **Rename:** Tester-B → Tester-B-Renamed → Tester-A reflected the new name.
  - **Leave:** closing Tester-B's tab → Tester-A dropped the name.
  - **Regression:** TLCS-server user stayed present — `ADDUSER`/`DELUSER` path
    unchanged.

## Implementation notes

- The `nick` handler's pre-existing `socket.emit('state', …)` was kept rather
  than replaced — the room update is an idempotent superset; keeping `state` is
  conservative.
- The username field wires `nick` to the **`blur`** event (persists to
  `localStorage`), per `public/js/components/chat/index.ts`.
