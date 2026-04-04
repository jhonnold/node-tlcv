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
  help: 'Total Socket.IO broadcast emission events',
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
