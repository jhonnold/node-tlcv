import fs from 'fs/promises';
import { mkdirp } from 'mkdirp';
import type { Broadcast } from '../broadcast.js';
import type { StoredTournamentResults } from '../../shared/types.js';
import { logger, siteSlug as toSiteSlug } from '../util/index.js';

const RESULTS_FILENAME = 'tournament-results.json';

export async function saveTournamentResults(broadcast: Broadcast): Promise<void> {
  // Fire-and-forget from the message loop, so the whole body is guarded — a throw
  // anywhere (slug/path construction included) must never become an unhandled rejection.
  try {
    const { site } = broadcast.game;

    const slug = toSiteSlug(site);
    const dirname = `pgns/${slug}`;
    const filepath = `${dirname}/${RESULTS_FILENAME}`;

    const data: StoredTournamentResults = {
      site,
      port: broadcast.port,
      updated: new Date().toISOString(),
      results: broadcast.results,
      parsedResults: broadcast.parsedResults,
      parsedGames: broadcast.parsedGames ?? [],
    };

    await mkdirp(dirname);
    await fs.writeFile(filepath, JSON.stringify(data));
  } catch (error) {
    logger.error(`Unable to write tournament results! - ${error}`, { port: broadcast.port });
  }
}
