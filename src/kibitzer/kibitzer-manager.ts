import broadcasts from '../broadcast.js';
import { emitUpdate } from '../socket-io-adapter.js';
import { kibitzerAssignments } from '../metrics.js';
import { logger } from '../util/index.js';
import { replayUciFromFen, sideToMove } from '../util/uci.js';
import { createTransport } from './transport-factory.js';
import { DEFAULT_ENGINE_PATH, DEFAULT_HASH, DEFAULT_THREADS } from './types.js';
import type { KibitzerTransport, KibitzerConfig, AnalysisInfo } from './types.js';
import type { KibitzerMeta, SerializedKibitzerLiveData } from '../../shared/types.js';

const POLL_INTERVAL_MS = 10_000;
const EMIT_INTERVAL_MS = 1_000;
const SWITCH_THRESHOLD = 2;

interface TransportEntry {
  config: KibitzerConfig;
  transport: KibitzerTransport;
}

interface BroadcastSlot {
  transport: KibitzerTransport;
  currentInfo: AnalysisInfo | null;
  currentFen: string | null;
  dirty: boolean;
}

// A slot that has both a position and an analysis of it — the only state any of the
// read accessors can report from.
type ActiveSlot = BroadcastSlot & { currentInfo: AnalysisInfo; currentFen: string };

export interface KibitzerStatus {
  id: string;
  type: string;
  priority: number;
  enginePath: string;
  threads: number;
  hash: number;
  ready: boolean;
  engineName: string;
  targetPort: number | null;
  targetName: string | null;
  host?: string;
  port?: number;
  username?: string;
  privateKeyPath?: string;
}

export class KibitzerManager {
  private transports: TransportEntry[] = [];
  private slots = new Map<number, BroadcastSlot>();
  private pollTimer: NodeJS.Timeout | null = null;
  private emitTimer: NodeJS.Timeout | null = null;

  constructor(configs: KibitzerConfig[]) {
    const sorted = [...configs].sort((a, b) => b.priority - a.priority);
    for (const config of sorted) {
      try {
        const transport = createTransport(config);
        this.transports.push({ config, transport });
      } catch (e) {
        logger.warn(`Kibitzer: failed to create transport ${config.id}: ${e}`);
      }
    }
  }

  start(): void {
    for (const entry of this.transports) entry.transport.create();

    this.poll();
    this.pollTimer = setInterval(() => this.poll(), POLL_INTERVAL_MS);
    this.emitTimer = setInterval(() => this.emitKibitzerUpdates(), EMIT_INTERVAL_MS);
    logger.info(`KibitzerManager started (${this.transports.length} transports)`);
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.emitTimer) {
      clearInterval(this.emitTimer);
      this.emitTimer = null;
    }
    this.slots.clear();
    for (const entry of this.transports) entry.transport.teardown();
    logger.info('KibitzerManager stopped');
  }

  addTransport(config: KibitzerConfig): void {
    const transport = createTransport(config);
    const entry: TransportEntry = { config, transport };

    const idx = this.transports.findIndex((e) => e.config.priority < config.priority);
    if (idx === -1) {
      this.transports.push(entry);
    } else {
      this.transports.splice(idx, 0, entry);
    }

    transport.create();
    this.poll();
    logger.info(`KibitzerManager: added transport ${config.id} (${config.type}, priority ${config.priority})`);
  }

  removeTransport(id: string): void {
    const idx = this.transports.findIndex((e) => e.config.id === id);
    if (idx === -1) return;

    const entry = this.transports[idx];

    for (const [port, slot] of this.slots) {
      if (slot.transport === entry.transport) {
        slot.transport.stopAnalysis();
        this.slots.delete(port);
        break;
      }
    }

    entry.transport.teardown();
    this.transports.splice(idx, 1);
    this.poll();
    logger.info(`KibitzerManager: removed transport ${id}`);
  }

  getStatus(): KibitzerStatus[] {
    const transportToPort = new Map<KibitzerTransport, number>();
    for (const [port, slot] of this.slots) {
      transportToPort.set(slot.transport, port);
    }

    return this.transports.map(({ config, transport }) => {
      const targetPort = transportToPort.get(transport) ?? null;

      // Spreading the config carries the transport-specific fields (host, username,
      // …) through without the status builder having to branch per type.
      return {
        ...config,
        enginePath: config.enginePath ?? DEFAULT_ENGINE_PATH,
        threads: config.threads ?? DEFAULT_THREADS,
        hash: config.hash ?? DEFAULT_HASH,
        ready: transport.ready,
        engineName: transport.name(),
        targetPort,
        targetName: targetPort !== null ? broadcasts.get(targetPort)?.game.site ?? null : null,
      };
    });
  }

  /**
   * The slot for a port, but only once it holds both a position and an analysis of
   * it. Every read accessor goes through this so they all agree on what "analyzing"
   * means — reporting off `currentInfo` alone would surface the transient state
   * between a transport's first info line and the slot's FEN being recorded.
   */
  private activeSlot(port: number): ActiveSlot | null {
    const slot = this.slots.get(port);
    if (!slot || !slot.currentInfo || !slot.currentFen) return null;

    return slot as ActiveSlot;
  }

  /**
   * The current analysis, shaped for the move history. The live panel builds on the
   * same object; the two differ only in how they render "nothing yet".
   */
  private buildSnapshot(slot: ActiveSlot): KibitzerMeta {
    const pv = replayUciFromFen(slot.currentFen, slot.currentInfo.pv);

    return {
      depth: slot.currentInfo.depth,
      score: slot.currentInfo.score / 100,
      nodes: slot.currentInfo.nodes,
      stm: sideToMove(slot.currentFen),
      pv: pv?.san ?? null,
      pvAlg: pv?.alg[0] ?? null,
      pvFen: pv?.fen ?? null,
      pvMoveNumber: pv?.moveNumber ?? null,
    };
  }

  snapshotForMove(port: number): KibitzerMeta | null {
    const slot = this.activeSlot(port);
    return slot ? this.buildSnapshot(slot) : null;
  }

  /** Just the evaluation, for callers (the homepage cards) that would discard the rest. */
  getScore(port: number): number | null {
    const slot = this.activeSlot(port);
    return slot ? slot.currentInfo.score / 100 : null;
  }

  onPositionChange(port: number, fen: string): void {
    const slot = this.slots.get(port);
    if (!slot) return;

    slot.currentInfo = null;
    slot.currentFen = fen;
    slot.dirty = false;
    slot.transport.startAnalysis(fen);
  }

  getLiveData(port: number): SerializedKibitzerLiveData | null {
    const slot = this.activeSlot(port);
    if (!slot) return null;

    const snapshot = this.buildSnapshot(slot);

    return {
      ...snapshot,
      pv: snapshot.pv ?? [],
      pvAlg: snapshot.pvAlg ?? '',
      pvFen: snapshot.pvFen ?? '',
      pvMoveNumber: snapshot.pvMoveNumber ?? 1,
      name: slot.transport.name(),
    };
  }

  private emitKibitzerUpdates(): void {
    for (const [port, slot] of this.slots) {
      if (!slot.dirty) continue;

      const broadcast = broadcasts.get(port);
      if (!broadcast || broadcast.browserCount === 0) continue;

      slot.dirty = false;
      const liveData = this.getLiveData(port);
      if (liveData) emitUpdate(port, { game: { kibitzerLiveData: liveData } });
    }
  }

  private poll(): void {
    if (this.transports.length === 0) return;

    // Ports already being analyzed get a handicap, so a marginally busier broadcast
    // doesn't cause the engine to hop back and forth.
    const analyzed = new Set(this.slots.keys());
    const candidates = [...broadcasts]
      .map(([port, broadcast]) => ({
        port,
        effectiveCount: broadcast.browserCount + (analyzed.has(port) ? SWITCH_THRESHOLD : 0),
      }))
      .sort((a, b) => b.effectiveCount - a.effectiveCount);

    const desiredCount = Math.min(this.transports.length, candidates.length);
    const desired = new Map<number, KibitzerTransport>();
    for (let i = 0; i < desiredCount; i++) {
      desired.set(candidates[i].port, this.transports[i].transport);
    }

    for (const [port, slot] of this.slots) {
      if (!desired.has(port) || desired.get(port) !== slot.transport) {
        slot.transport.stopAnalysis();
        this.slots.delete(port);
        logger.info(`Kibitzer: stopped analyzing port ${port}`);
      }
    }

    for (const [port, transport] of desired) {
      if (!this.slots.has(port)) {
        this.startSlot(port, transport);
      }
    }
  }

  private startSlot(port: number, transport: KibitzerTransport): void {
    const broadcast = broadcasts.get(port);
    if (!broadcast) return;

    const slot: BroadcastSlot = {
      transport,
      currentInfo: null,
      currentFen: null,
      dirty: false,
    };

    transport.onAnalysis((info) => {
      slot.currentInfo = info;
      slot.dirty = true;
    });

    this.slots.set(port, slot);

    const entry = this.transports.find((e) => e.transport === transport);
    if (entry) kibitzerAssignments.inc({ id: entry.config.id });

    const fen = broadcast.game.instance.fen();
    slot.currentFen = fen;
    transport.startAnalysis(fen);

    logger.info(`Kibitzer: started analyzing port ${port} (${broadcast.browserCount} viewers)`);
  }
}
