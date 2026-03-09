import { Client } from 'ssh2';
import type { ClientChannel } from 'ssh2';
import fs from 'node:fs';
import { createInterface } from 'readline';
import { logger } from '../util/index.js';
import { parseInfoLine } from './uci-parser.js';
import type { AnalysisInfo } from './uci-parser.js';
import type { KibitzerTransport, SshKibitzerConfig } from './types.js';

export class SshTransport implements KibitzerTransport {
  private client: Client | null = null;
  private channel: ClientChannel | null = null;
  private callback: ((info: AnalysisInfo) => void) | null = null;
  private ready = false;
  private stm: 'w' | 'b' = 'w';
  private pendingFen: string | null = null;
  private engineName: string;

  private readonly threads: number;
  private readonly hash: number;

  constructor(private readonly config: SshKibitzerConfig) {
    this.threads = config.threads ?? 1;
    this.hash = config.hash ?? 256;
    this.engineName = `Remote Engine @ ${config.host}`;
  }

  create(): void {
    let privateKey: Buffer;
    try {
      privateKey = fs.readFileSync(this.config.privateKeyPath);
    } catch (err) {
      logger.error(`Kibitzer SSH: failed to read private key ${this.config.privateKeyPath}: ${err}`);
      return;
    }

    this.client = new Client();

    this.client.on('ready', () => {
      logger.info(`Kibitzer SSH: connected to ${this.config.host}`);
      this.client!.exec(this.config.enginePath, { pty: true }, (err, channel) => {
        if (err) {
          logger.error(`Kibitzer SSH: exec failed: ${err.message}`);
          this.client?.end();
          this.client = null;
          return;
        }

        this.channel = channel;

        const rl = createInterface({ input: channel });
        rl.on('line', (line) => this.onLine(line));

        channel.stderr.on('data', (data: Buffer) => {
          logger.warn(`Kibitzer SSH stderr: ${data.toString().trim()}`);
        });

        channel.on('close', () => {
          logger.info(`Kibitzer SSH: channel closed on ${this.config.host}`);
          this.ready = false;
          this.channel = null;
        });

        this.send('uci');
      });
    });

    this.client.on('error', (err) => {
      logger.error(`Kibitzer SSH: connection error on ${this.config.host}: ${err.message}`);
      this.ready = false;
      this.channel = null;
      this.client = null;
    });

    this.client.on('close', () => {
      logger.info(`Kibitzer SSH: connection closed on ${this.config.host}`);
      this.ready = false;
      this.channel = null;
      this.client = null;
    });

    this.client.connect({
      host: this.config.host,
      port: this.config.port ?? 22,
      username: this.config.username,
      privateKey,
    });
  }

  teardown(): void {
    this.ready = false;
    this.callback = null;
    this.pendingFen = null;
    this.send('quit');
    setTimeout(() => {
      if (this.channel) {
        this.channel.close();
        this.channel = null;
      }
      if (this.client) {
        this.client.end();
        this.client = null;
      }
    }, 1000);
  }

  startAnalysis(fen: string): void {
    if (!this.channel) return;

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
    if (this.channel?.writable) {
      this.channel.write(`${cmd}\n`);
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
      logger.info(`Kibitzer SSH engine ready on ${this.config.host} (Threads=${this.threads}, Hash=${this.hash})`);
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
