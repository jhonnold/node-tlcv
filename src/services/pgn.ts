import fs from 'fs/promises';
import { mkdirp } from 'mkdirp';
import { ChessGame } from '../chess-game.js';
import { logger, siteSlug, gameFilenameSlug } from '../util/index.js';
import { addFile } from './pgn-cache.js';

export async function savePgn(game: ChessGame, port: number, gameNumber: number): Promise<void> {
  const { white, black, site } = game;
  const pgn = game.instance.pgn({ maxWidth: 80 });

  const slug = siteSlug(site);
  const dirname = `pgns/${slug}`;

  const filename = gameFilenameSlug(gameNumber, white.name, black.name);
  const filepath = `${dirname}/${filename}.pgn`;

  try {
    await mkdirp(dirname);
    await fs.writeFile(filepath, pgn);
    addFile(slug, gameNumber, `${filename}.pgn`);
  } catch (error) {
    logger.error(`Unable to write to ${filepath}! - ${error}`, { port });
  }
}
