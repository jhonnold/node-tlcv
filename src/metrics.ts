import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import broadcasts from './broadcast.js';
import { getKibitzerManager } from './broadcast-manager.js';
import type { Broadcast } from './broadcast.js';
import type { KibitzerStatus } from './kibitzer/kibitzer-manager.js';

export const register = new Registry();

collectDefaultMetrics({ register, prefix: 'ccrl_' });

// --- Gauges (collected at scrape time) ---

// The per-broadcast and per-kibitzer gauges differ only in the number they read, so
// the label set and the scrape-time iteration are declared once here. Adding a label
// to either family is then a single edit rather than one per gauge.
function perBroadcastGauge(name: string, help: string, value: (broadcast: Broadcast) => number) {
  return new Gauge({
    name,
    help,
    labelNames: ['port', 'event'] as const,
    registers: [register],
    collect() {
      this.reset();
      for (const [port, broadcast] of broadcasts) {
        this.set({ port: String(port), event: broadcast.eventLabel }, value(broadcast));
      }
    },
  });
}

function perKibitzerGauge(name: string, help: string, value: (status: KibitzerStatus) => number) {
  return new Gauge({
    name,
    help,
    labelNames: ['id', 'engine', 'type'] as const,
    registers: [register],
    collect() {
      this.reset();
      for (const s of getKibitzerManager()?.getStatus() ?? []) {
        this.set({ id: s.id, engine: s.engineName || 'unknown', type: s.type }, value(s));
      }
    },
  });
}

export const broadcastsActive = new Gauge({
  name: 'ccrl_broadcasts_active',
  help: 'Number of currently active broadcasts',
  registers: [register],
  collect() {
    this.set(broadcasts.size);
  },
});

export const broadcastSpectators = perBroadcastGauge(
  'ccrl_broadcast_spectators',
  'Current spectator count per broadcast',
  (b) => b.spectators.size,
);

export const broadcastBrowserConnections = perBroadcastGauge(
  'ccrl_broadcast_browser_connections',
  'Current browser connection count per broadcast',
  (b) => b.browserCount,
);

export const gameMoveNumber = perBroadcastGauge(
  'ccrl_game_move_number',
  'Current move number in the active game per broadcast',
  (b) => b.game.moveMeta.length,
);

export const kibitzerTotal = new Gauge({
  name: 'ccrl_kibitzer_total',
  help: 'Total number of configured kibitzer transports',
  registers: [register],
  collect() {
    this.set((getKibitzerManager()?.getStatus() ?? []).length);
  },
});

export const kibitzerReady = perKibitzerGauge(
  'ccrl_kibitzer_ready',
  'Whether a kibitzer transport is ready (1) or not (0)',
  (s) => (s.ready ? 1 : 0),
);

export const kibitzerTargetPort = perKibitzerGauge(
  'ccrl_kibitzer_target_port',
  'Port number the kibitzer is currently analyzing (0 if unassigned)',
  (s) => s.targetPort ?? 0,
);

// --- Histograms (observed at call sites) ---

export const httpRequestDuration = new Histogram({
  name: 'ccrl_http_request_duration_seconds',
  help: 'HTTP request duration in seconds, by method, normalized route, and status code',
  labelNames: ['method', 'route', 'status'] as const,
  // Web latency: fast in-memory EJS renders (~ms) through filesystem reads and
  // JSON.parse work (tens to hundreds of ms) up to slow archive reconstruction (1s+).
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export const lichessRequestDuration = new Histogram({
  name: 'ccrl_lichess_request_duration_seconds',
  help: 'Lichess API request duration in seconds, by endpoint and outcome',
  labelNames: ['endpoint', 'outcome'] as const,
  // External HTTP: ~50ms warm to multi-second on Lichess slow paths; cap at 30s.
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

// --- Counters (incremented at call sites) ---

export const udpMessagesReceived = new Counter({
  name: 'ccrl_udp_messages_received_total',
  help: 'Total UDP messages received',
  labelNames: ['port'] as const,
  registers: [register],
});

export const udpMessagesOutOfOrder = new Counter({
  name: 'ccrl_udp_messages_out_of_order_total',
  help: 'Total UDP messages received out of order and skipped',
  labelNames: ['port'] as const,
  registers: [register],
});

export const commandsProcessed = new Counter({
  name: 'ccrl_commands_processed_total',
  help: 'Total commands processed by game service',
  labelNames: ['port', 'command'] as const,
  registers: [register],
});

export const chatMessages = new Counter({
  name: 'ccrl_chat_messages_total',
  help: 'Total chat messages received from the chess server',
  labelNames: ['port'] as const,
  registers: [register],
});

export const spectatorJoins = new Counter({
  name: 'ccrl_spectator_joins_total',
  help: 'Total spectator joins via Socket.IO',
  labelNames: ['port'] as const,
  registers: [register],
});

export const spectatorLeaves = new Counter({
  name: 'ccrl_spectator_leaves_total',
  help: 'Total spectator disconnects via Socket.IO',
  labelNames: ['port'] as const,
  registers: [register],
});

export const socketEmissions = new Counter({
  name: 'ccrl_socket_emissions_total',
  help: 'Total Socket.IO broadcast emission events',
  labelNames: ['port', 'type'] as const,
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
