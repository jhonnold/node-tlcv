# Prometheus Metrics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `/admin/metrics` Prometheus endpoint exposing operational and usage metrics for the CCRL broadcast service.

**Architecture:** Centralized `src/metrics.ts` module defines all metrics (gauges with `collect()` callbacks, counters exported for call-site instrumentation). Route in `src/routes/admin.ts` behind existing basic auth. `prom-client` library with default Node.js process metrics enabled.

**Tech Stack:** `prom-client` (Prometheus client for Node.js), Express, TypeScript ESM

---

### Task 1: Install prom-client

**Files:**
- Modify: `package.json`

**Step 1: Install the dependency**

Run: `npm install prom-client`

**Step 2: Verify installation**

Run: `node -e "import('prom-client').then(m => console.log(Object.keys(m.default || m).slice(0,5)))"`
Expected: Array of exported names like `['Counter', 'Gauge', 'Histogram', ...]`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add prom-client for Prometheus metrics"
```

---

### Task 2: Create centralized metrics module

**Files:**
- Create: `src/metrics.ts`

**Step 1: Create the metrics module**

```typescript
import { Counter, Gauge, Registry, collectDefaultMetrics } from 'prom-client';
import broadcasts from './broadcast.js';
import { getKibitzerManager } from './broadcast-manager.js';

export const register = new Registry();

collectDefaultMetrics({ register, prefix: 'ccrl_' });

// --- Gauges (collected at scrape time) ---

export const broadcastsActive = new Gauge({
  name: 'ccrl_broadcasts_active',
  help: 'Number of currently active broadcasts',
  registers: [register],
  collect() {
    this.set(broadcasts.size);
  },
});

export const broadcastSpectators = new Gauge({
  name: 'ccrl_broadcast_spectators',
  help: 'Current spectator count per broadcast',
  labelNames: ['port', 'event'] as const,
  registers: [register],
  collect() {
    this.reset();
    for (const [port, broadcast] of broadcasts) {
      this.set({ port: String(port), event: broadcast.game.site ?? 'unknown' }, broadcast.spectators.size);
    }
  },
});

export const broadcastBrowserConnections = new Gauge({
  name: 'ccrl_broadcast_browser_connections',
  help: 'Current browser connection count per broadcast',
  labelNames: ['port', 'event'] as const,
  registers: [register],
  collect() {
    this.reset();
    for (const [port, broadcast] of broadcasts) {
      this.set({ port: String(port), event: broadcast.game.site ?? 'unknown' }, broadcast.browserCount);
    }
  },
});

export const gameMoveNumber = new Gauge({
  name: 'ccrl_game_move_number',
  help: 'Current move number in the active game per broadcast',
  labelNames: ['port', 'event'] as const,
  registers: [register],
  collect() {
    this.reset();
    for (const [port, broadcast] of broadcasts) {
      this.set({ port: String(port), event: broadcast.game.site ?? 'unknown' }, broadcast.game.moveMeta.length);
    }
  },
});

export const kibitzerTotal = new Gauge({
  name: 'ccrl_kibitzer_total',
  help: 'Total number of configured kibitzer transports',
  registers: [register],
  collect() {
    const statuses = getKibitzerManager()?.getStatus() ?? [];
    this.set(statuses.length);
  },
});

export const kibitzerReady = new Gauge({
  name: 'ccrl_kibitzer_ready',
  help: 'Whether a kibitzer transport is ready (1) or not (0)',
  labelNames: ['id', 'engine', 'type'] as const,
  registers: [register],
  collect() {
    this.reset();
    const statuses = getKibitzerManager()?.getStatus() ?? [];
    for (const s of statuses) {
      this.set({ id: s.id, engine: s.engineName || 'unknown', type: s.type }, s.ready ? 1 : 0);
    }
  },
});

export const kibitzerTargetPort = new Gauge({
  name: 'ccrl_kibitzer_target_port',
  help: 'Port number the kibitzer is currently analyzing (0 if unassigned)',
  labelNames: ['id', 'engine', 'type'] as const,
  registers: [register],
  collect() {
    this.reset();
    const statuses = getKibitzerManager()?.getStatus() ?? [];
    for (const s of statuses) {
      this.set({ id: s.id, engine: s.engineName || 'unknown', type: s.type }, s.targetPort ?? 0);
    }
  },
});

// --- Counters (incremented at call sites) ---

export const udpMessagesReceived = new Counter({
  name: 'ccrl_udp_messages_received_total',
  help: 'Total UDP messages received',
  labelNames: ['port', 'event'] as const,
  registers: [register],
});

export const udpMessagesOutOfOrder = new Counter({
  name: 'ccrl_udp_messages_out_of_order_total',
  help: 'Total UDP messages received out of order and skipped',
  labelNames: ['port', 'event'] as const,
  registers: [register],
});

export const commandsProcessed = new Counter({
  name: 'ccrl_commands_processed_total',
  help: 'Total commands processed by game service',
  labelNames: ['port', 'event', 'command'] as const,
  registers: [register],
});

export const chatMessages = new Counter({
  name: 'ccrl_chat_messages_total',
  help: 'Total chat messages received from the chess server',
  labelNames: ['port', 'event'] as const,
  registers: [register],
});

export const spectatorJoins = new Counter({
  name: 'ccrl_spectator_joins_total',
  help: 'Total spectator joins via Socket.IO',
  labelNames: ['port', 'event'] as const,
  registers: [register],
});

export const spectatorLeaves = new Counter({
  name: 'ccrl_spectator_leaves_total',
  help: 'Total spectator disconnects via Socket.IO',
  labelNames: ['port', 'event'] as const,
  registers: [register],
});

export const socketEmissions = new Counter({
  name: 'ccrl_socket_emissions_total',
  help: 'Total Socket.IO emissions to clients',
  labelNames: ['port', 'event', 'type'] as const,
  registers: [register],
});

export const kibitzerAssignments = new Counter({
  name: 'ccrl_kibitzer_assignments_total',
  help: 'Total kibitzer transport reassignments',
  labelNames: ['id'] as const,
  registers: [register],
});

export const messageBufferErrors = new Counter({
  name: 'ccrl_message_buffer_errors_total',
  help: 'Total errors during message buffer processing',
  labelNames: ['port'] as const,
  registers: [register],
});
```

**Step 2: Verify it compiles**

Run: `npx tsc -p tsconfig.backend.json --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/metrics.ts
git commit -m "feat(metrics): add centralized Prometheus metrics module"
```

---

### Task 3: Add /admin/metrics route

**Files:**
- Modify: `src/routes/admin.ts:1-10` (add import), append route before export

**Step 1: Add the route**

Add import at top of `src/routes/admin.ts`:

```typescript
import { register } from '../metrics.js';
```

Add route before `export default router;` (before line 118):

```typescript
router.get('/metrics', async (_: Request, res: Response) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

**Step 2: Verify it compiles**

Run: `npx tsc -p tsconfig.backend.json --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/routes/admin.ts
git commit -m "feat(metrics): add GET /admin/metrics route"
```

---

### Task 4: Instrument UDP transport counters

**Files:**
- Modify: `src/transport/udp-transport.ts`

**Step 1: Add counter increments**

Add import at top:

```typescript
import broadcasts from '../broadcast.js';
import { udpMessagesReceived, udpMessagesOutOfOrder } from '../metrics.js';
```

In the `onMessage` method, after the existing `logger.debug` on line 44 (before `const fullMessage`), add:

```typescript
const event = broadcasts.get(this.port)?.game.site ?? 'unknown';
udpMessagesReceived.inc({ port: String(this.port), event });
```

In the out-of-order branch (line 57-61), before the `return` on line 61, add:

```typescript
udpMessagesOutOfOrder.inc({ port: String(this.port), event });
```

Note: The `event` variable is declared before the out-of-order check, so it's available in scope.

**Step 2: Verify it compiles**

Run: `npx tsc -p tsconfig.backend.json --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/transport/udp-transport.ts
git commit -m "feat(metrics): instrument UDP transport message counters"
```

---

### Task 5: Instrument game service counters

**Files:**
- Modify: `src/game-service.ts`

**Step 1: Add counter increments**

Add import at top (after existing imports):

```typescript
import { commandsProcessed, chatMessages } from './metrics.js';
```

In `onMessages()` method (line 519), inside the `for` loop (line 532), after the line that calls `commandConfig.fn(...)` (line 535-537), add:

```typescript
const event = this.broadcast.game.site ?? 'unknown';
commandsProcessed.inc({ port: String(this.broadcast.port), event, command: cmd });
```

In the `onChat` method (line 377), at the start of the method before the connection message filter (line 379), add:

```typescript
chatMessages.inc({ port: String(this.broadcast.port), event: this.game.site ?? 'unknown' });
```

**Step 2: Verify it compiles**

Run: `npx tsc -p tsconfig.backend.json --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/game-service.ts
git commit -m "feat(metrics): instrument game service command and chat counters"
```

---

### Task 6: Instrument Socket.IO adapter counters

**Files:**
- Modify: `src/socket-io-adapter.ts`

**Step 1: Add counter increments**

Add import at top:

```typescript
import { spectatorJoins, spectatorLeaves, socketEmissions } from './metrics.js';
```

In the `join` handler (line 19), after `broadcast.browserCount++` (line 23), add:

```typescript
const event = broadcast.game.site ?? 'unknown';
spectatorJoins.inc({ port: String(port), event });
```

In the `disconnect` handler (line 52), after `broadcast.browserCount--` (line 55), add:

```typescript
const event = broadcast.game.site ?? 'unknown';
spectatorLeaves.inc({ port: String(port), event });
```

In `emitUpdate` function (line 63), add before the `io.to(...)` call:

```typescript
const event = broadcasts.get(port)?.game.site ?? 'unknown';
socketEmissions.inc({ port: String(port), event, type: 'update' });
```

In `emitChat` function (line 67), add before the `io.to(...)` call:

```typescript
const event = broadcasts.get(port)?.game.site ?? 'unknown';
socketEmissions.inc({ port: String(port), event, type: 'chat' });
```

**Step 2: Verify it compiles**

Run: `npx tsc -p tsconfig.backend.json --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/socket-io-adapter.ts
git commit -m "feat(metrics): instrument Socket.IO spectator and emission counters"
```

---

### Task 7: Instrument kibitzer assignment counter

**Files:**
- Modify: `src/kibitzer/kibitzer-manager.ts`

**Step 1: Add counter increments**

Add import at top:

```typescript
import { kibitzerAssignments } from '../metrics.js';
```

In the `startSlot` method (line 270), after `this.slots.set(port, slot)` (line 286), add:

```typescript
const entry = this.transports.find((e) => e.transport === transport);
if (entry) kibitzerAssignments.inc({ id: entry.id });
```

**Step 2: Verify it compiles**

Run: `npx tsc -p tsconfig.backend.json --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/kibitzer/kibitzer-manager.ts
git commit -m "feat(metrics): instrument kibitzer assignment counter"
```

---

### Task 8: Instrument message buffer error counter

**Files:**
- Modify: `src/transport/message-buffer.ts`

**Step 1: Add counter increments**

Add import at top:

```typescript
import { messageBufferErrors } from '../metrics.js';
```

In the `drain` method, inside the `catch` block (line 39-40), after the `logger.error` call, add:

```typescript
messageBufferErrors.inc({ port: String(this.port) });
```

**Step 2: Verify it compiles**

Run: `npx tsc -p tsconfig.backend.json --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/transport/message-buffer.ts
git commit -m "feat(metrics): instrument message buffer error counter"
```

---

### Task 9: Full build verification

**Step 1: Run full build (TypeScript + webpack)**

Run: `npm run build`
Expected: Clean build with no errors

**Step 2: Verify metrics module is in build output**

Run: `ls build/src/metrics.js`
Expected: File exists

**Step 3: Run lint**

Run: `npm run lint`
Expected: No errors (auto-fix may adjust formatting)

**Step 4: Commit any lint fixes**

```bash
git add -A
git commit -m "style: apply lint fixes for metrics instrumentation"
```

(Skip this commit if lint made no changes.)
