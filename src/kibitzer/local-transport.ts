import { spawn } from 'child_process';
import type { ChildProcessWithoutNullStreams } from 'child_process';
import { createInterface } from 'readline';
import { logger } from '../util/index.js';
import { parseInfoLine } from './uci-parser.js';
import type { AnalysisInfo } from './uci-parser.js';
import type { KibitzerTransport } from './types.js';

const KIBITZER_PATH = process.env.KIBITZER_PATH ?? 'stockfish';
const THREADS = process.env.KIBITZER_THREADS ?? '1';
const HASH = process.env.KIBITZER_HASH ?? '256';
const ENGINE_NAME = 'Stockfish 18';

export class LocalTransport implements KibitzerTransport {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private callback: ((info: AnalysisInfo) => void) | null = null;
  private ready = false;
  private stm: 'w' | 'b' = 'w';
  private pendingFen: string | null = null;
  private engineName: string = ENGINE_NAME;

  start(): void {
    this.proc = spawn(KIBITZER_PATH, { stdio: ['pipe', 'pipe', 'pipe'] });

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

  stop(): void {
    this.ready = false;
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

  analyze(fen: string): void {
    if (!this.proc) return;

    // Extract side to move from FEN
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
      this.send(`setoption name Threads value ${THREADS}`);
      this.send(`setoption name Hash value ${HASH}`);
      this.send('isready');
      return;
    }

    if (line === 'readyok') {
      this.ready = true;
      logger.info(`Kibitzer engine ready (Threads=${THREADS}, Hash=${HASH})`);
      if (this.pendingFen) {
        const fen = this.pendingFen;
        this.pendingFen = null;
        this.analyze(fen);
      }
      return;
    }

    if (line.startsWith('info ') && this.callback) {
      const info = parseInfoLine(line, this.stm);
      if (info) this.callback(info);
    }
  }
}
