import { Chess } from 'chess.js';
import broadcasts from '../broadcast.js';
import { emitUpdate } from '../socket-io-adapter.js';
import { logger } from '../util/index.js';
import { LocalTransport } from './local-transport.js';
import type { KibitzerTransport, AnalysisInfo } from './types.js';
import type { ColorCode, KibitzerMeta, SerializedKibitzerLiveData } from '../../shared/types.js';

const POLL_INTERVAL_MS = 10_000;
const EMIT_INTERVAL_MS = 1_000;
const SWITCH_THRESHOLD = 2;
const ENGINE_NAME = 'Stockfish 18';

export class KibitzerManager {
  private transport: KibitzerTransport;
  private targetPort: number | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private emitTimer: NodeJS.Timeout | null = null;
  private currentInfo: AnalysisInfo | null = null;
  private currentFen: string | null = null;
  private dirty = false;

  constructor(transport?: KibitzerTransport) {
    this.transport = transport ?? new LocalTransport();
  }

  start(): void {
    this.transport.onAnalysis((info) => {
      this.currentInfo = info;
      this.dirty = true;
    });
    this.transport.start();
    this.pollTimer = setInterval(() => this.poll(), POLL_INTERVAL_MS);
    this.emitTimer = setInterval(() => this.emitKibitzerUpdate(), EMIT_INTERVAL_MS);
    logger.info('KibitzerManager started');
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
    this.transport.stop();
    this.targetPort = null;
    this.currentInfo = null;
    this.currentFen = null;
    logger.info('KibitzerManager stopped');
  }

  /** Called by GameService before liveData resets on a move. */
  snapshotForMove(port: number): KibitzerMeta | null {
    if (port !== this.targetPort || !this.currentInfo || !this.currentFen) return null;

    const pv = this.playoutPV(this.currentInfo.pv);
    const stm = this.extractStm();

    return {
      depth: this.currentInfo.depth,
      score: this.currentInfo.score / 100, // convert cp to pawns
      nodes: this.currentInfo.nodes,
      stm,
      pv: pv?.san ?? null,
      pvAlg: pv?.alg[0] ?? null,
      pvFen: pv?.fen ?? null,
      pvMoveNumber: pv?.moveNumber ?? null,
    };
  }

  /** Called by GameService after a move is applied. */
  onPositionChange(port: number, fen: string): void {
    if (port !== this.targetPort) return;

    this.currentInfo = null;
    this.currentFen = fen;
    this.dirty = false;
    this.transport.analyze(fen);
  }

  /** Called by GameService.buildGameDelta() to get current live data. */
  getLiveData(port: number): SerializedKibitzerLiveData | null {
    if (port !== this.targetPort || !this.currentInfo || !this.currentFen) return null;

    const pv = this.playoutPV(this.currentInfo.pv);

    return {
      depth: this.currentInfo.depth,
      score: this.currentInfo.score / 100,
      nodes: this.currentInfo.nodes,
      stm: this.extractStm(),
      pv: pv?.san ?? [],
      pvAlg: pv?.alg[0] ?? '',
      pvFen: pv?.fen ?? '',
      pvMoveNumber: pv?.moveNumber ?? 1,
      name: ENGINE_NAME,
    };
  }

  getTargetPort(): number | null {
    return this.targetPort;
  }

  private emitKibitzerUpdate(): void {
    if (!this.dirty || this.targetPort === null) return;

    const broadcast = broadcasts.get(this.targetPort);
    if (!broadcast || broadcast.browserCount === 0) return;

    this.dirty = false;
    const liveData = this.getLiveData(this.targetPort);
    if (liveData) emitUpdate(this.targetPort, { game: { kibitzerLiveData: liveData } });
  }

  private poll(): void {
    let bestPort: number | null = null;
    let bestCount = 0;

    for (const [port, broadcast] of broadcasts) {
      if (broadcast.browserCount > bestCount) {
        bestCount = broadcast.browserCount;
        bestPort = port;
      }
    }

    // No viewers anywhere — stop analyzing
    if (bestPort === null || bestCount === 0) {
      if (this.targetPort !== null) {
        logger.info('Kibitzer: no viewers on any broadcast, pausing');
        this.targetPort = null;
        this.currentInfo = null;
        this.currentFen = null;
      }
      return;
    }

    // Already targeting this port
    if (bestPort === this.targetPort) return;

    // Check hysteresis: new leader must exceed current by SWITCH_THRESHOLD
    if (this.targetPort !== null) {
      const currentBroadcast = broadcasts.get(this.targetPort);
      const currentCount = currentBroadcast?.browserCount ?? 0;
      if (bestCount < currentCount + SWITCH_THRESHOLD) return;
    }

    this.switchTo(bestPort);
  }

  private switchTo(port: number): void {
    const broadcast = broadcasts.get(port);
    if (!broadcast) return;

    logger.info(`Kibitzer: switching to port ${port} (${broadcast.browserCount} viewers)`);

    this.targetPort = port;
    this.currentInfo = null;

    const fen = broadcast.game.instance.fen();
    this.currentFen = fen;
    this.transport.analyze(fen);
  }

  private extractStm(): ColorCode {
    const parts = this.currentFen?.split(' ');
    return (parts?.[1] === 'b' ? 'b' : 'w') as ColorCode;
  }

  private playoutPV(uciMoves: string[]): { san: string[]; alg: string[]; fen: string; moveNumber: number } | null {
    if (!this.currentFen) return null;

    try {
      const chess = new Chess(this.currentFen);
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
