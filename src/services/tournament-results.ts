import fs from 'fs/promises';
import type { Dirent } from 'fs';
import { mkdirp } from 'mkdirp';
import type { Broadcast } from '../broadcast.js';
import type { ArchiveSummary, GameRecord, StoredTournamentResults } from '../../shared/types.js';
import { logger, siteSlug as toSiteSlug } from '../util/index.js';
import { getMetaFile, getMetaFiles } from './game-meta.js';

const RESULTS_FILENAME = 'tournament-results.json';

// Reconstructed archives (built from meta sidecars when no results.json exists) are
// cached per slug: the `/archive/:slug` middleware runs on every sub-request, and a
// large gauntlet would otherwise re-read every meta file several times per page load.
const archiveCache = new Map<string, StoredTournamentResults>();

export function invalidateArchiveCache(slug: string): void {
  archiveCache.delete(slug);
}

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

// Synthesizes a StoredTournamentResults from the per-game meta sidecars for
// tournaments that predate the results.json roll-up (PR #161). Standings are left
// null (the result table renders "no information"); the games schedule is rebuilt
// from each meta's player names + result. Returns null when no meta sidecars exist
// (e.g. truly-legacy PGN-only folders — we intentionally do not parse PGNs).
export async function reconstructArchiveFromMeta(slug: string): Promise<StoredTournamentResults | null> {
  const cached = archiveCache.get(slug);
  if (cached) return cached;

  const metaFiles = await getMetaFiles(slug);
  if (metaFiles.size === 0) return null;

  let site: string | null = null;
  const parsedGames: GameRecord[] = [];
  for (const gameNumber of metaFiles.keys()) {
    const meta = await getMetaFile(slug, gameNumber);
    if (!meta) continue;
    if (!site) site = meta.site;
    parsedGames.push({ gameNumber, white: meta.white.name, black: meta.black.name, result: meta.result });
  }

  if (parsedGames.length === 0) return null;
  parsedGames.sort((a, b) => a.gameNumber - b.gameNumber);

  const archive: StoredTournamentResults = {
    site: site ?? slug,
    port: 0,
    updated: await dirUpdatedAt(slug),
    results: '',
    parsedResults: null,
    parsedGames,
  };

  archiveCache.set(slug, archive);
  return archive;
}

// Returns a results.json-backed archive when present, otherwise a meta-reconstructed
// one. Used by the archive routes so older tournaments are openable.
export async function loadOrReconstructArchive(slug: string): Promise<StoredTournamentResults | null> {
  return (await loadTournamentResults(slug)) ?? (await reconstructArchiveFromMeta(slug));
}

async function dirUpdatedAt(slug: string): Promise<string> {
  try {
    return (await fs.stat(`pgns/${slug}`)).mtime.toISOString();
  } catch {
    return new Date(0).toISOString();
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
    if (stored) {
      summaries.push({
        slug: entry.name,
        site: stored.site,
        updated: stored.updated,
        gameCount: stored.parsedGames.length,
      });
      continue;
    }

    // Fallback for tournaments that predate the results.json roll-up but still have
    // per-game meta sidecars. Build a light summary without reading every meta.
    const metaFiles = await getMetaFiles(entry.name);
    if (metaFiles.size === 0) continue;

    const firstKey = metaFiles.keys().next().value as number;
    const firstMeta = await getMetaFile(entry.name, firstKey);

    summaries.push({
      slug: entry.name,
      site: firstMeta?.site ?? entry.name,
      updated: await dirUpdatedAt(entry.name),
      gameCount: metaFiles.size,
    });
  }

  return summaries.sort((a, b) => b.updated.localeCompare(a.updated));
}
