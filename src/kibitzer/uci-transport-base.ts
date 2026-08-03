import { logger } from '../util/index.js';
import { parseInfoLine } from './uci-parser.js';
import type { AnalysisInfo } from './uci-parser.js';
import type { KibitzerTransport } from './types.js';

// Shared UCI engine state machine — handshake, option setup, pending-position replay
// and the info-line callback — used by both the local and SSH transports, which only
// differ in how they spawn/connect and write a command to the raw stream.
export abstract class UciTransportBase implements KibitzerTransport {
  protected callback: ((info: AnalysisInfo) => void) | null = null;
  protected _ready = false;
  protected stm: 'w' | 'b' = 'w';
  protected pendingFen: string | null = null;
  protected engineName: string;

  protected readonly threads: number;
  protected readonly hash: number;

  constructor(options: { threads?: number; hash?: number }, defaultName: string) {
    this.threads = options.threads ?? 1;
    this.hash = options.hash ?? 256;
    this.engineName = defaultName;
  }

  get ready(): boolean {
    return this._ready;
  }

  abstract create(): void;
  abstract teardown(): void;
  protected abstract send(cmd: string): void;

  startAnalysis(fen: string): void {
    const parts = fen.split(' ');
    this.stm = (parts[1] ?? 'w') as 'w' | 'b';

    if (!this._ready) {
      this.pendingFen = fen;
      return;
    }

    this.send('stop');
    this.send(`position fen ${fen}`);
    this.send('go infinite');
  }

  stopAnalysis(): void {
    this.pendingFen = null;
    this.send('stop');
  }

  onAnalysis(callback: (info: AnalysisInfo) => void): void {
    this.callback = callback;
  }

  name(): string {
    return this.engineName;
  }

  protected onLine(line: string): void {
    if (line.startsWith('id name ')) {
      this.engineName = line.slice('id name '.length);
      return;
    }

    if (line === 'uciok') {
      this.send(`setoption name Threads value ${this.threads}`);
      this.send(`setoption name Hash value ${this.hash}`);
      this.send('isready');
      return;
    }

    if (line === 'readyok') {
      this._ready = true;
      logger.info(`Kibitzer engine ready (Threads=${this.threads}, Hash=${this.hash})`);
      if (this.pendingFen) {
        const fen = this.pendingFen;
        this.pendingFen = null;
        this.startAnalysis(fen);
      }
      return;
    }

    if (line.startsWith('info ') && this.callback) {
      const info = parseInfoLine(line, this.stm);
      if (info) this.callback(info);
    }
  }

  protected clearState(): void {
    this._ready = false;
    this.callback = null;
    this.pendingFen = null;
  }
}
