import { spawn } from 'child_process';
import type { ChildProcessWithoutNullStreams } from 'child_process';
import { createInterface } from 'readline';
import { logger } from '../util/index.js';
import { UciTransportBase } from './uci-transport-base.js';
import type { LocalKibitzerConfig } from './types.js';

export class LocalTransport extends UciTransportBase {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private readonly enginePath: string;

  constructor(config: LocalKibitzerConfig) {
    super({ threads: config.threads, hash: config.hash }, 'Stockfish');
    this.enginePath = config.enginePath ?? 'stockfish';
  }

  create(): void {
    this.proc = spawn(this.enginePath, { stdio: ['pipe', 'pipe', 'pipe'] });

    this.proc.on('error', (err) => {
      logger.error(`Kibitzer process error: ${err.message}`);
    });

    this.proc.on('exit', (code) => {
      logger.info(`Kibitzer process exited with code ${code}`);
      this._ready = false;
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
    this.clearState();
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

  protected send(cmd: string): void {
    if (this.proc?.stdin.writable) {
      this.proc.stdin.write(`${cmd}\n`);
    }
  }
}
