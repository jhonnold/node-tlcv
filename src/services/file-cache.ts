import fs from 'fs/promises';
import { logger } from '../util/index.js';

export class FileCache {
  private cache = new Map<string, Map<number, string>>();
  private readonly pattern: RegExp;

  constructor(pattern: RegExp) {
    this.pattern = pattern;
  }

  private async loadFromDisk(siteSlug: string): Promise<Map<number, string>> {
    const map = new Map<number, string>();
    const dir = `pgns/${siteSlug}`;

    try {
      const entries = await fs.readdir(dir);
      for (const entry of entries) {
        const match = this.pattern.exec(entry);
        if (match) map.set(parseInt(match[1], 10), entry);
      }
    } catch {
      logger.info(`No PGN directory found for ${siteSlug}`);
    }

    return map;
  }

  async getFiles(siteSlug: string): Promise<Map<number, string>> {
    let map = this.cache.get(siteSlug);
    if (map) return map;

    map = await this.loadFromDisk(siteSlug);
    this.cache.set(siteSlug, map);
    return map;
  }

  addFile(siteSlug: string, gameNumber: number, filename: string): void {
    let map = this.cache.get(siteSlug);
    if (!map) {
      map = new Map();
      this.cache.set(siteSlug, map);
    }
    map.set(gameNumber, filename);
  }

  async loadAll(): Promise<void> {
    try {
      const entries = await fs.readdir('pgns', { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const map = await this.loadFromDisk(entry.name);
          this.cache.set(entry.name, map);
        }
      }
    } catch {
      logger.info('No pgns directory found, skipping cache preload');
    }
  }

  invalidate(siteSlug: string): void {
    this.cache.delete(siteSlug);
  }
}
