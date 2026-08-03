import { ChessGame } from '../chess-game.js';
import { siteSlug, gameFilenameSlug } from '../util/index.js';
import { writeArchiveFile } from './pgn-storage.js';
import { addFile } from './pgn-cache.js';

export async function savePgn(game: ChessGame, port: number, gameNumber: number): Promise<void> {
  const { white, black, site } = game;

  const slug = siteSlug(site);
  const filename = `${gameFilenameSlug(gameNumber, white.name, black.name)}.pgn`;

  if (await writeArchiveFile(slug, filename, game.instance.pgn({ maxWidth: 80 }), port)) {
    addFile(slug, gameNumber, filename);
  }
}
