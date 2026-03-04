import fs from 'fs/promises';
import { mkdirp } from 'mkdirp';
import dayjs from 'dayjs';
import slugify from 'slugify';
import { ChessGame } from '../chess-game.js';
import { logger } from '../util/index.js';

export async function savePgn(game: ChessGame, port: number): Promise<void> {
  const { white, black, site } = game;
  const pgn = game.instance.pgn();

  const siteSlug = slugify(site, '_');
  const dirname = `pgns/${siteSlug}`;

  const date = dayjs().format('YYYYMMDD_HHmm');
  const filename = slugify(`${date}_${white.name}_vs_${black.name}`, '_');
  const filepath = `${dirname}/${filename}.pgn`;

  try {
    await mkdirp(dirname);
    await fs.writeFile(filepath, pgn);
  } catch (error) {
    logger.error(`Unable to write to ${filepath}! - ${error}`, { port });
  }
}
