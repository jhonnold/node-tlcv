import { Chess } from 'chess.js';
import broadcasts from '../broadcast.js';
import { emitUpdate } from '../socket-io-adapter.js';
import { logger } from '../util/index.js';
import type { KibitzerTransport, AnalysisInfo } from './types.js';
import type { ColorCode, KibitzerMeta, SerializedKibitzerLiveData } from '../../shared/types.js';

const POLL_INTERVAL_MS = 10_000;
const EMIT_INTERVAL_MS = 1_000;
const SWITCH_THRESHOLD = 2;

interface BroadcastSlot {
  transport: KibitzerTransport;
  currentInfo: AnalysisInfo | null;
  currentFen: string | null;
  dirty: boolean;
}

export class KibitzerManager {
  private readonly transports: KibitzerTransport[];
  private slots = new Map<number, BroadcastSlot>();
  private pollTimer: NodeJS.Timeout | null = null;
  private emitTimer: NodeJS.Timeout | null = null;

  constructor(transports: KibitzerTransport[]) {
    this.transports = transports;
  }

  start(): void {
    if (this.transports.length === 0) {
      logger.info('KibitzerManager: no transports configured, analysis disabled');
      return;
    }

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
    for (const [port, slot] of this.slots) {
      slot.transport.stop();
      logger.info(`Kibitzer: stopped transport for port ${port}`);
    }
    this.slots.clear();
    logger.info('KibitzerManager stopped');
  }

  /** Called by GameService before liveData resets on a move. */
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

  /** Called by GameService after a move is applied. */
  onPositionChange(port: number, fen: string): void {
    const slot = this.slots.get(port);
    if (!slot) return;

    slot.currentInfo = null;
    slot.currentFen = fen;
    slot.dirty = false;
    slot.transport.analyze(fen);
  }

  /** Called by GameService.buildGameDelta() to get current live data. */
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
    const ranked: { port: number; count: number }[] = [];
    for (const [port, broadcast] of broadcasts) {
      if (broadcast.browserCount > 0) {
        ranked.push({ port, count: broadcast.browserCount });
      }
    }
    ranked.sort((a, b) => b.count - a.count);

    const currentPorts = new Set(this.slots.keys());

    // Apply hysteresis: current targets get a bonus
    const candidates = ranked.map(({ port, count }) => ({
      port,
      effectiveCount: count + (currentPorts.has(port) ? SWITCH_THRESHOLD : 0),
      actualCount: count,
    }));
    candidates.sort((a, b) => b.effectiveCount - a.effectiveCount);

    const desiredCount = Math.min(this.transports.length, candidates.length);
    const desired = new Map<number, KibitzerTransport>();
    for (let i = 0; i < desiredCount; i++) {
      desired.set(candidates[i].port, this.transports[i]);
    }

    // Stop slots no longer desired or that need a different transport
    for (const [port, slot] of this.slots) {
      if (!desired.has(port) || desired.get(port) !== slot.transport) {
        slot.transport.stop();
        this.slots.delete(port);
        logger.info(`Kibitzer: stopped analyzing port ${port}`);
      }
    }

    // Start slots for newly desired ports
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
    transport.start();

    this.slots.set(port, slot);

    const fen = broadcast.game.instance.fen();
    slot.currentFen = fen;
    transport.analyze(fen);

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
