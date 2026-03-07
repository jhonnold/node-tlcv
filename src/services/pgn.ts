import fs from 'fs/promises';
import { mkdirp } from 'mkdirp';
import slugify from 'slugify';
import { ChessGame } from '../chess-game.js';
import { logger } from '../util/index.js';

export async function savePgn(game: ChessGame, port: number, gameNumber: number): Promise<void> {
  const { white, black, site } = game;
  const pgn = game.instance.pgn({ maxWidth: 80 });

  const siteSlug = slugify(site, '_');
  const dirname = `pgns/${siteSlug}`;

  const filename = slugify(`${gameNumber}_${white.name}_vs_${black.name}`, '_').toLowerCase();
  const filepath = `${dirname}/${filename}.pgn`;

  const rawDirname = `${dirname}/raw`;
  const rawFilepath = `${rawDirname}/${gameNumber}.pgn`;

  try {
    await mkdirp(rawDirname);
    await Promise.all([fs.writeFile(filepath, pgn), fs.writeFile(rawFilepath, pgn)]);
  } catch (error) {
    logger.error(`Unable to write to ${filepath}! - ${error}`, { port });
  }
}
