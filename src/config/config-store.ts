import fs from 'node:fs/promises';
import path from 'node:path';
import type { KibitzerConfig } from '../kibitzer/types.js';

export interface AppConfig {
  connections: string[];
  kibitzers?: KibitzerConfig[];
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

  async getConnections(): Promise<string[]> {
    const config = await this.load();
    return config.connections;
  }

  async addConnection(connection: string): Promise<void> {
    const config = await this.load();
    config.connections = [...new Set([...config.connections, connection])];
    await this.save(config);
  }

  async removeConnection(connection: string): Promise<void> {
    const config = await this.load();
    config.connections = config.connections.filter((c) => c !== connection);
    await this.save(config);
  }
}

const configStore = new ConfigStore();

export default configStore;
