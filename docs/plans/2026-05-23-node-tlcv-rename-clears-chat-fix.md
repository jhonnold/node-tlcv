---
source_url:
ingested: 2026-06-04
source_type: plan
author: Claude Agent (direction + approval by Jay Honnold)
synthesis: done
---

# node-tlcv — stop wiping own chat when a user renames themselves

> Internal debugging + fix session, conducted interactively on 2026-05-23.
> No standalone plan document existed; this import captures the
> investigation, the fix, and the live verification directly.
> **Outcome:** shipped as PR
> [#153](https://github.com/jhonnold/node-tlcv/pull/153) on branch
> `fix/preserve-chat-on-rename` (commit `5055d11`, base `main`, one file,
> +3/−1).

## Trigger

Immediate follow-up to the live-spectator-updates work
(PR #151). Jay's prompt:
"review your change to fix the viewer update bug. it looks like that fix
results in clearing the chat when someone updates their own name. verify
this issue."

## The bug

Renaming yourself (editing the username field on a ccrl.live broadcast
page) **wipes your own chat box**. Only the renaming user's socket is
affected — other viewers' chat is untouched.

## Root cause chain

1. The `nick` handler in `src/socket-io-adapter.ts` called
   `socket.emit('state', broadcast.toJSON())`.
2. `BroadcastState.toJSON()` (`src/broadcast-state.ts:54`) defaults
   `includeChat = false`, so the payload carries **`chat: []`** (the
   `join` handler, by contrast, calls `toJSON(true)`).
3. The frontend `state` handler (`public/js/index.ts:58-63`) destructures
   the chat off the payload and **unconditionally** re-emits it:
   `emit('chat:history', chatData)`.
4. `handleChatHistory` → `setChat(msgs)` (`public/js/components/chat/index.ts:36`)
   does `$('#chat-box').children().remove()` **then** renders `msgs`. An
   empty array therefore clears the box and renders nothing.

So every rename round-tripped an empty chat history to the renamer and
blew away their visible chat.

## Attribution — not caused by PR #151

The chat wipe is **not** a regression from the spectator-updates fix
(#151). #151 only *added* `emitSpectators(broadcast)`, which emits an
`update` delta of `{ spectators: [...] }`; the frontend `applyDelta()`
(`public/js/index.ts:37-51`) only touches `spectators`/`menu`/`game` and
never affects chat.

`git log -L` on the `nick` handler shows the real origin: commit
**`17b72a0`** ("perf: send delta updates over socket.io instead of full
state snapshots") switched the handler from
`socket.emit('update', broadcast.toJSON())` to
`socket.emit('state', broadcast.toJSON())`. After that refactor `update`
became a *delta merge* and `state` became the *full snapshot that
re-seeds chat history* — so emitting `state` with an empty chat started
wiping the box. The bug has been latent since the delta refactor; it
surfaced while testing #151's rename flow.

**Notably**, #151's own plan deliberately *kept* the
`socket.emit('state', …)` line, calling it "the conservative choice"
(an idempotent superset for the renamer's own view). That decision is
exactly what retained the wipe. This fix supersedes that note.

## The fix (1 file)

Remove `socket.emit('state', broadcast.toJSON())` from the `nick`
handler. A rename changes only the spectator list, and
`emitSpectators(broadcast)` (added in #151) already pushes that list
room-wide **including the renaming socket** — so the full-state emit was
both redundant and the sole cause of the wipe.

```ts
socket.on('nick', (user: string) => {
  if (!broadcast) return;
  const originalUsername = username;
  if (username) broadcast.spectators.delete(username);
  username = uniqueName(user, broadcast.spectators);
  if (username) broadcast.spectators.add(username);
  logger.info(`${originalUsername} changed their name to ${username}!`, { port: broadcast.port });

  // A rename only changes the spectator list; emitSpectators pushes that to
  // the whole room (including this socket). Emitting full state here would
  // re-seed chat history from an empty payload and wipe the user's chat box.
  emitSpectators(broadcast);
});
```

## Verification (two browser tabs, live)

Driven via Playwright against local `dev-server` + one-shot webpack build,
broadcast `16061`, two tabs (Tester-A / Tester-B). nodemon's `src` watch
allowed hot-swapping the buggy/fixed code for a true A/B counter-proof.

- **Fixed build, self-rename:** Tab A renamed itself while a message was in
  the box → chat box kept **both** messages (chatCount 2 → 2); spectator
  list updated to the new name; Tab B saw the rename live with its own chat
  intact. ✅
- **Buggy build (line restored via hot-restart):** posted a message (1 in
  box) then self-renamed → chat box dropped to **0** messages. ❌ Confirms
  that exact line is the cause.
- **Restored fix:** re-applied, hot-restarted, repeated → chat persists,
  spectator list still updates live. ✅

Counter-proof summary:

```
FIXED build, self-rename:  chatCount 1 → 1   chat survives
BUGGY build, self-rename:  chatCount 1 → 0   chat wiped
```

## Generalizable footgun

The frontend `state` handler **always** re-seeds chat history from its
payload. Therefore **any** `emit('state', broadcast.toJSON())` without
`includeChat: true` will wipe the recipient's chat. After this change the
`nick` handler no longer emits `state` at all, and the `join` handler
correctly uses `toJSON(true)` — so there are no remaining offenders, but
the pattern is worth remembering before adding new `state` emits.

Side notes observed while verifying:

- A chat message's `[username]` sender label is captured at send time and
  is **not** rewritten on rename (e.g. a message kept `[Tester-A]` after
  the author renamed). Pre-existing and expected.
- Server restart drops in-memory chat history (the `Broadcast` is rebuilt
  fresh on reconnect) — chat is not persisted across deploys.
