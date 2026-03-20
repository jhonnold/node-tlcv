import { Chess } from 'chess.js';
import broadcasts from '../broadcast.js';
import { emitUpdate } from '../socket-io-adapter.js';
import { logger } from '../util/index.js';
import { createTransport } from './transport-factory.js';
import type { KibitzerTransport, KibitzerConfig, AnalysisInfo } from './types.js';
import type { ColorCode, KibitzerMeta, SerializedKibitzerLiveData } from '../../shared/types.js';

const POLL_INTERVAL_MS = 10_000;
const EMIT_INTERVAL_MS = 1_000;
const SWITCH_THRESHOLD = 2;

interface TransportEntry {
  id: string;
  config: KibitzerConfig;
  transport: KibitzerTransport;
}

interface BroadcastSlot {
  transport: KibitzerTransport;
  currentInfo: AnalysisInfo | null;
  currentFen: string | null;
  dirty: boolean;
}

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
        this.transports.push({ id: config.id, config, transport });
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
    const entry: TransportEntry = { id: config.id, config, transport };

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
    const idx = this.transports.findIndex((e) => e.id === id);
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

    return this.transports.map((entry) => {
      const targetPort = transportToPort.get(entry.transport) ?? null;
      const broadcast = targetPort !== null ? broadcasts.get(targetPort) : null;

      return {
        id: entry.id,
        type: entry.config.type,
        priority: entry.config.priority,
        enginePath: entry.config.type === 'ssh' ? entry.config.enginePath : entry.config.enginePath ?? 'stockfish',
        threads: entry.config.threads ?? 1,
        hash: entry.config.hash ?? 256,
        ready: entry.transport.ready,
        engineName: entry.transport.name(),
        targetPort,
        targetName: broadcast?.game.site ?? null,
        ...(entry.config.type === 'ssh'
          ? {
              host: entry.config.host,
              port: entry.config.port,
              username: entry.config.username,
              privateKeyPath: entry.config.privateKeyPath,
            }
          : {}),
      };
    });
  }

  snapshotForMove(port: number): KibitzerMeta | null {
    const slot = this.slots.get(port);
    if (!slot || !slot.currentInfo || !slot.currentFen) return null;

    const pv = this.playoutPV(slot.currentInfo.pv, slot.currentFen);
    const stm = extractStm(slot.currentFen);

    return {
      depth: slot.currentInfo.depth,
      score: slot.currentInfo.score / 100,
      nodes: slot.currentInfo.nodes,
      stm,
      pv: pv?.san ?? null,
      pvAlg: pv?.alg[0] ?? null,
      pvFen: pv?.fen ?? null,
      pvMoveNumber: pv?.moveNumber ?? null,
    };
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
    const slot = this.slots.get(port);
    if (!slot || !slot.currentInfo || !slot.currentFen) return null;

    const pv = this.playoutPV(slot.currentInfo.pv, slot.currentFen);

    return {
      depth: slot.currentInfo.depth,
      score: slot.currentInfo.score / 100,
      nodes: slot.currentInfo.nodes,
      stm: extractStm(slot.currentFen),
      pv: pv?.san ?? [],
      pvAlg: pv?.alg[0] ?? '',
      pvFen: pv?.fen ?? '',
      pvMoveNumber: pv?.moveNumber ?? 1,
      name: slot.transport.name(),
    };
  }

  getTargetPort(): number | null {
    let best: number | null = null;
    let bestCount = 0;
    for (const port of this.slots.keys()) {
      const bc = broadcasts.get(port);
      if (bc && bc.browserCount > bestCount) {
        bestCount = bc.browserCount;
        best = port;
      }
    }
    return best;
  }

  isTargeted(port: number): boolean {
    return this.slots.has(port);
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

    const ranked: { port: number; count: number }[] = [];
    for (const [port, broadcast] of broadcasts) {
      ranked.push({ port, count: broadcast.browserCount });
    }
    ranked.sort((a, b) => b.count - a.count);

    const currentPorts = new Set(this.slots.keys());

    const candidates = ranked.map(({ port, count }) => ({
      port,
      effectiveCount: count + (currentPorts.has(port) ? SWITCH_THRESHOLD : 0),
      actualCount: count,
    }));
    candidates.sort((a, b) => b.effectiveCount - a.effectiveCount);

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

    const fen = broadcast.game.instance.fen();
    slot.currentFen = fen;
    transport.startAnalysis(fen);

    logger.info(`Kibitzer: started analyzing port ${port} (${broadcast.browserCount} viewers)`);
  }

  private playoutPV(
    uciMoves: string[],
    fen: string,
  ): { san: string[]; alg: string[]; fen: string; moveNumber: number } | null {
    try {
      const chess = new Chess(fen);
      const moveNumber = chess.moveNumber();
      const san: string[] = [];
      const alg: string[] = [];

      for (const move of uciMoves) {
        try {
          const result = chess.move(move, { strict: false });
          san.push(result.san);
          alg.push(`${result.from}${result.to}`);
        } catch {
          break;
        }
      }

      return san.length ? { san, alg, fen: chess.fen(), moveNumber } : null;
    } catch {
      return null;
    }
  }
}

function extractStm(fen: string | null): ColorCode {
  const parts = fen?.split(' ');
  return (parts?.[1] === 'b' ? 'b' : 'w') as ColorCode;
}
