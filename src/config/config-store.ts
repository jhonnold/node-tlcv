import fs from 'node:fs/promises';
import path from 'node:path';
import type { KibitzerConfig } from '../kibitzer/types.js';
import type { WebhookConfig } from '../webhooks/types.js';

export interface ConnectionConfig {
  connection: string;
  ephemeral?: boolean;
}

/** A connections entry is either a bare "host:port" string or a config object. */
export type ConnectionEntry = string | ConnectionConfig;

export interface AppConfig {
  connections: ConnectionEntry[];
  kibitzers?: KibitzerConfig[];
  webhooks?: WebhookConfig[];
}

function normalizeConnection(entry: ConnectionEntry): ConnectionConfig {
  return typeof entry === 'string' ? { connection: entry, ephemeral: false } : { ephemeral: false, ...entry };
}

export class ConfigStore {
  private readonly configPath: string;

  constructor() {
    const configDir = process.env.CONFIG_DIR || 'config';
    this.configPath = path.join(configDir, 'config.json');
  }

  async load(): Promise<AppConfig> {
    const data = await fs.readFile(this.configPath, { encoding: 'utf8' });
    return JSON.parse(data) as AppConfig;
  }

  async save(config: AppConfig): Promise<void> {
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), { encoding: 'utf8' });
  }

  async getConnections(): Promise<ConnectionConfig[]> {
    const config = await this.load();
    return config.connections.map(normalizeConnection);
  }

  async addConnection(connection: string, ephemeral = false): Promise<void> {
    const config = await this.load();
    const existing = config.connections.filter((c) => normalizeConnection(c).connection !== connection);
    // Keep the file tidy: a bare string for the default mode, an object only when
    // ephemeral is set. Reads tolerate both forms via normalizeConnection().
    const entry: ConnectionEntry = ephemeral ? { connection, ephemeral: true } : connection;
    config.connections = [...existing, entry];
    await this.save(config);
  }

  async removeConnection(connection: string): Promise<void> {
    const config = await this.load();
    config.connections = config.connections.filter((c) => normalizeConnection(c).connection !== connection);
    await this.save(config);
  }

  async addKibitzer(config: KibitzerConfig): Promise<void> {
    const appConfig = await this.load();
    const kibitzers = appConfig.kibitzers ?? [];
    kibitzers.push(config);
    appConfig.kibitzers = kibitzers;
    await this.save(appConfig);
  }

  async removeKibitzer(id: string): Promise<void> {
    const appConfig = await this.load();
    appConfig.kibitzers = (appConfig.kibitzers ?? []).filter((k) => k.id !== id);
    await this.save(appConfig);
  }

  async addWebhook(config: WebhookConfig): Promise<void> {
    const appConfig = await this.load();
    const webhooks = appConfig.webhooks ?? [];
    webhooks.push(config);
    appConfig.webhooks = webhooks;
    await this.save(appConfig);
  }

  async removeWebhook(id: string): Promise<void> {
    const appConfig = await this.load();
    appConfig.webhooks = (appConfig.webhooks ?? []).filter((w) => w.id !== id);
    await this.save(appConfig);
  }
}

const configStore = new ConfigStore();

export default configStore;
