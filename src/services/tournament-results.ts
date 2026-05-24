import fs from 'fs/promises';
import type { Dirent } from 'fs';
import { mkdirp } from 'mkdirp';
import type { Broadcast } from '../broadcast.js';
import type { ArchiveSummary, StoredTournamentResults } from '../../shared/types.js';
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

export async function loadTournamentResults(slug: string): Promise<StoredTournamentResults | null> {
  try {
    const raw = await fs.readFile(`pgns/${slug}/${RESULTS_FILENAME}`, 'utf-8');
    return JSON.parse(raw) as StoredTournamentResults;
  } catch {
    return null;
  }
}

export async function listArchivedTournaments(): Promise<ArchiveSummary[]> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir('pgns', { withFileTypes: true });
  } catch {
    logger.info('No pgns directory found, skipping archive listing');
    return [];
  }

  const summaries: ArchiveSummary[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const stored = await loadTournamentResults(entry.name);
    if (!stored) continue;

    summaries.push({
      slug: entry.name,
      site: stored.site,
      updated: stored.updated,
      gameCount: stored.parsedGames.length,
    });
  }

  return summaries.sort((a, b) => b.updated.localeCompare(a.updated));
}
