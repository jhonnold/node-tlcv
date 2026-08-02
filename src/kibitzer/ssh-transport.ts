import { Client } from 'ssh2';
import type { ClientChannel } from 'ssh2';
import fs from 'node:fs';
import { createInterface } from 'readline';
import { logger } from '../util/index.js';
import { UciTransportBase } from './uci-transport-base.js';
import type { SshKibitzerConfig } from './types.js';

export class SshTransport extends UciTransportBase {
  private client: Client | null = null;
  private channel: ClientChannel | null = null;
  private readonly config: SshKibitzerConfig;

  constructor(config: SshKibitzerConfig) {
    super({ threads: config.threads, hash: config.hash }, `Remote Engine @ ${config.host}`);
    this.config = config;
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
          this._ready = false;
          this.channel = null;
        });

        this.send('uci');
      });
    });

    this.client.on('error', (err) => {
      logger.error(`Kibitzer SSH: connection error on ${this.config.host}: ${err.message}`);
      this._ready = false;
      this.channel = null;
      this.client = null;
    });

    this.client.on('close', () => {
      logger.info(`Kibitzer SSH: connection closed on ${this.config.host}`);
      this._ready = false;
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
    this.clearState();
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

  protected send(cmd: string): void {
    if (this.channel?.writable) {
      this.channel.write(`${cmd}\n`);
    }
  }
}
