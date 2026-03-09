import { spawn } from 'child_process';
import type { ChildProcessWithoutNullStreams } from 'child_process';
import { createInterface } from 'readline';
import { logger } from '../util/index.js';
import { parseInfoLine } from './uci-parser.js';
import type { AnalysisInfo } from './uci-parser.js';
import type { KibitzerTransport, LocalKibitzerConfig } from './types.js';

export class LocalTransport implements KibitzerTransport {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private callback: ((info: AnalysisInfo) => void) | null = null;
  private ready = false;
  private stm: 'w' | 'b' = 'w';
  private pendingFen: string | null = null;
  private engineName: string;

  private readonly enginePath: string;
  private readonly threads: number;
  private readonly hash: number;

  constructor(config: LocalKibitzerConfig) {
    this.enginePath = config.enginePath ?? 'stockfish';
    this.threads = config.threads ?? 1;
    this.hash = config.hash ?? 256;
    this.engineName = 'Stockfish';
  }

  create(): void {
    this.proc = spawn(this.enginePath, { stdio: ['pipe', 'pipe', 'pipe'] });

    this.proc.on('error', (err) => {
      logger.error(`Kibitzer process error: ${err.message}`);
    });

    this.proc.on('exit', (code) => {
      logger.info(`Kibitzer process exited with code ${code}`);
      this.ready = false;
      this.proc = null;
    });

    const rl = createInterface({ input: this.proc.stdout });
    rl.on('line', (line) => this.onLine(line));

    this.proc.stderr.on('data', (data: Buffer) => {
      logger.warn(`Kibitzer stderr: ${data.toString().trim()}`);
    });

    this.send('uci');
  }

  teardown(): void {
    this.ready = false;
    this.callback = null;
    this.pendingFen = null;
    if (this.proc) {
      this.send('quit');
      setTimeout(() => {
        if (this.proc) {
          this.proc.kill();
          this.proc = null;
        }
      }, 1000);
    }
  }

  startAnalysis(fen: string): void {
    if (!this.proc) return;

    const parts = fen.split(' ');
    this.stm = (parts[1] ?? 'w') as 'w' | 'b';

    if (!this.ready) {
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

  private send(cmd: string): void {
    if (this.proc?.stdin.writable) {
      this.proc.stdin.write(`${cmd}\n`);
    }
  }

  private onLine(line: string): void {
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
      this.ready = true;
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
}
