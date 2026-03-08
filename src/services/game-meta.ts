import fs from 'fs/promises';
import { mkdirp } from 'mkdirp';
import slugify from 'slugify';
import type { ChessGame } from '../chess-game.js';
import type { StoredGameMeta } from '../../shared/types.js';
import { logger } from '../util/index.js';

const cache = new Map<string, Map<number, string>>();

async function loadFromDisk(siteSlug: string): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  const dir = `pgns/${siteSlug}`;

  try {
    const entries = await fs.readdir(dir);
    for (const entry of entries) {
      const match = /^(\d+)_.+\.meta\.json$/i.exec(entry);
      if (match) map.set(parseInt(match[1], 10), entry);
    }
  } catch {
    logger.info(`No PGN directory found for ${siteSlug}`);
  }

  return map;
}

async function getMetaFiles(siteSlug: string): Promise<Map<number, string>> {
  let map = cache.get(siteSlug);
  if (map) return map;

  map = await loadFromDisk(siteSlug);
  cache.set(siteSlug, map);
  return map;
}

function addMetaFile(siteSlug: string, gameNumber: number, filename: string): void {
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

export async function getMetaFile(siteSlug: string, gameNumber: number): Promise<StoredGameMeta | null> {
  const files = await getMetaFiles(siteSlug);
  const filename = files.get(gameNumber);
  if (!filename) return null;

  try {
    const data = await fs.readFile(`pgns/${siteSlug}/${filename}`, 'utf-8');
    return JSON.parse(data) as StoredGameMeta;
  } catch {
    return null;
  }
}

export async function getMetaFileUrl(siteSlug: string, gameNumber: number): Promise<string | undefined> {
  const files = await getMetaFiles(siteSlug);
  const filename = files.get(gameNumber);
  return filename ? `/pgns/${siteSlug}/${filename}` : undefined;
}

export async function saveGameMeta(game: ChessGame, port: number, gameNumber: number, result: string): Promise<void> {
  const { white, black, site } = game;
  const meta: StoredGameMeta = { ...game.toJSON(), result };

  const siteSlug = slugify(site, '_');
  const dirname = `pgns/${siteSlug}`;

  const filename = slugify(`${gameNumber}_${white.name}_vs_${black.name}`, '_').toLowerCase();
  const filepath = `${dirname}/${filename}.meta.json`;

  try {
    await mkdirp(dirname);
    await fs.writeFile(filepath, JSON.stringify(meta));
    addMetaFile(siteSlug, gameNumber, `${filename}.meta.json`);
  } catch (error) {
    logger.error(`Unable to write meta to ${filepath}! - ${error}`, { port });
  }
}
