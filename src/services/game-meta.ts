import fs from 'fs/promises';
import { mkdirp } from 'mkdirp';
import type { ChessGame } from '../chess-game.js';
import type { StoredGameMeta } from '../../shared/types.js';
import { logger, siteSlug as toSiteSlug, gameFilenameSlug } from '../util/index.js';
import { FileCache } from './file-cache.js';

const metaCache = new FileCache(/^(\d+)_.+\.meta\.json$/i);

export const loadAll = metaCache.loadAll.bind(metaCache);
export const invalidate = metaCache.invalidate.bind(metaCache);

export async function getMetaFile(siteSlug: string, gameNumber: number): Promise<StoredGameMeta | null> {
  const files = await metaCache.getFiles(siteSlug);
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
  const files = await metaCache.getFiles(siteSlug);
  const filename = files.get(gameNumber);
  return filename ? `/pgns/${siteSlug}/${filename}` : undefined;
}

export async function saveGameMeta(game: ChessGame, port: number, gameNumber: number, result: string): Promise<void> {
  const { white, black, site } = game;
  const meta: StoredGameMeta = { ...game.toJSON(), result };

  const slug = toSiteSlug(site);
  const dirname = `pgns/${slug}`;

  const filename = gameFilenameSlug(gameNumber, white.name, black.name);
  const filepath = `${dirname}/${filename}.meta.json`;

  try {
    await mkdirp(dirname);
    await fs.writeFile(filepath, JSON.stringify(meta));
    metaCache.addFile(slug, gameNumber, `${filename}.meta.json`);
  } catch (error) {
    logger.error(`Unable to write meta to ${filepath}! - ${error}`, { port });
  }
}
