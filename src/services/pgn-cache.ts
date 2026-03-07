import fs from 'fs/promises';
import { logger } from '../util/index.js';

const cache = new Map<string, Map<number, string>>();

async function loadFromDisk(siteSlug: string): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  const dir = `pgns/${siteSlug}`;

  try {
    const entries = await fs.readdir(dir);
    for (const entry of entries) {
      const match = /^(\d+)_.+\.pgn$/i.exec(entry);
      if (match) map.set(parseInt(match[1], 10), entry);
    }
  } catch {
    logger.info(`No PGN directory found for ${siteSlug}`);
  }

  return map;
}

export async function getFiles(siteSlug: string): Promise<Map<number, string>> {
  let map = cache.get(siteSlug);
  if (map) return map;

  map = await loadFromDisk(siteSlug);
  cache.set(siteSlug, map);
  return map;
}

export function addFile(siteSlug: string, gameNumber: number, filename: string): void {
  let map = cache.get(siteSlug);
  if (!map) {
    map = new Map();
    cache.set(siteSlug, map);
  }
  map.set(gameNumber, filename);
}

export function invalidate(siteSlug: string): void {
  cache.delete(siteSlug);
}
