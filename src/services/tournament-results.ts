import fs from 'fs/promises';
import type { Dirent } from 'fs';
import type { ArchiveSummary, GameRecord, StoredTournamentResults } from '../../shared/types.js';
import { logger, siteSlug } from '../util/index.js';
import { PGNS_ROOT, pgnDir, pgnPath, writeArchiveFile } from './pgn-storage.js';
import { getMetaFile, getMetaFiles, invalidate as invalidateMetaCache } from './game-meta.js';
import { invalidate as invalidatePgnCache } from './pgn-cache.js';

const RESULTS_FILENAME = 'tournament-results.json';

// Archives are cached per slug: the `/archive/:slug` middleware runs on every
// sub-request, so a page load would otherwise re-read (and re-parse) the whole
// results.json — or, for tournaments predating it, every meta sidecar — several
// times over. saveTournamentResults() is the only writer and evicts as it goes.
const archiveCache = new Map<string, StoredTournamentResults>();

// The homepage archive listing scans every pgns/* folder (readdir + JSON.parse of
// each results.json) — too expensive to run per request on the busiest, auto-
// refreshing route (see the 2026-05-25 CPU-credit incident). Cache the full scan
// result and only re-scan on a live->archived transition (closeConnection / onSite),
// never on the per-game-finish results.json write: that write only touches *live*
// tournaments, which are filtered out of the listing, so a displayed entry's file is
// already frozen. `listingInflight` coalesces concurrent cold-cache scans into one.
let listingCache: ArchiveSummary[] | null = null;
let listingInflight: Promise<ArchiveSummary[]> | null = null;

export function invalidateListingCache(): void {
  // Clearing the in-flight promise too forces the next caller to start a fresh scan
  // rather than reuse one that began before this mutation. A scan already running
  // still resolves and may briefly repopulate slightly-stale data — acceptable for a
  // non-critical listing, and the triggering mutation is rare.
  listingCache = null;
  listingInflight = null;
}

/**
 * Drops every cache derived from one tournament's folder — PGN filenames, meta
 * filenames, the loaded archive, and the homepage listing. Exposed as one call so
 * mutation sites can't remember a subset of the four.
 */
export function invalidateTournament(slug: string): void {
  invalidatePgnCache(slug);
  invalidateMetaCache(slug);
  archiveCache.delete(slug);
  invalidateListingCache();
}

export async function saveTournamentResults(data: StoredTournamentResults): Promise<void> {
  // Fire-and-forget from the message loop, so the whole body is guarded — a throw
  // anywhere (slug/path construction included) must never become an unhandled rejection.
  try {
    const slug = siteSlug(data.site);
    archiveCache.delete(slug);

    await writeArchiveFile(slug, RESULTS_FILENAME, JSON.stringify(data), data.port);
  } catch (error) {
    logger.error(`Unable to write tournament results! - ${error}`, { port: data.port });
  }
}

export async function loadTournamentResults(slug: string): Promise<StoredTournamentResults | null> {
  try {
    const raw = await fs.readFile(pgnPath(slug, RESULTS_FILENAME), 'utf-8');
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
async function reconstructArchiveFromMeta(slug: string): Promise<StoredTournamentResults | null> {
  const metaFiles = await getMetaFiles(slug);
  if (metaFiles.size === 0) return null;

  // Each sidecar is a full serialized game and a large gauntlet has hundreds of
  // them, so read them concurrently rather than one disk round trip at a time.
  const gameNumbers = [...metaFiles.keys()];
  const metas = await Promise.all(gameNumbers.map((gameNumber) => getMetaFile(slug, gameNumber)));

  let site: string | null = null;
  const parsedGames: GameRecord[] = [];
  metas.forEach((meta, i) => {
    if (!meta) return;
    if (!site) site = meta.site;
    parsedGames.push({
      gameNumber: gameNumbers[i],
      white: meta.white.name,
      black: meta.black.name,
      result: meta.result,
    });
  });

  if (parsedGames.length === 0) return null;
  parsedGames.sort((a, b) => a.gameNumber - b.gameNumber);

  return {
    site: site ?? slug,
    port: 0,
    updated: await dirUpdatedAt(slug),
    results: '',
    parsedResults: null,
    parsedGames,
  };
}

// Returns a results.json-backed archive when present, otherwise a meta-reconstructed
// one. Used by the archive routes so older tournaments are openable.
export async function loadOrReconstructArchive(slug: string): Promise<StoredTournamentResults | null> {
  const cached = archiveCache.get(slug);
  if (cached) return cached;

  const archive = (await loadTournamentResults(slug)) ?? (await reconstructArchiveFromMeta(slug));
  if (archive) archiveCache.set(slug, archive);

  return archive;
}

async function dirUpdatedAt(slug: string): Promise<string> {
  try {
    return (await fs.stat(pgnDir(slug))).mtime.toISOString();
  } catch {
    return new Date(0).toISOString();
  }
}

// Public, cached entry point. Returns the cached scan when warm; otherwise runs a
// single scan shared by all concurrent callers (cold-cache stampede guard). A thrown
// scan resolves to [] without poisoning the cache, so the next call retries.
export async function listArchivedTournaments(): Promise<ArchiveSummary[]> {
  if (listingCache) return listingCache;
  if (listingInflight) return listingInflight;

  listingInflight = scanArchivedTournaments()
    .then((summaries) => {
      listingCache = summaries;
      return summaries;
    })
    .catch((error) => {
      logger.error(`Unable to list archived tournaments! - ${error}`);
      return [];
    })
    .finally(() => {
      listingInflight = null;
    });

  return listingInflight;
}

async function scanArchivedTournaments(): Promise<ArchiveSummary[]> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(PGNS_ROOT, { withFileTypes: true });
  } catch {
    logger.info('No pgns directory found, skipping archive listing');
    return [];
  }

  // Every folder costs at least a readFile + JSON.parse, and this runs on the cold
  // path of a boot and of each listing invalidation — summarize them concurrently.
  const summaries = await Promise.all(
    entries.filter((entry) => entry.isDirectory()).map((entry) => summarizeTournament(entry.name)),
  );

  return summaries.filter((s): s is ArchiveSummary => s !== null).sort((a, b) => b.updated.localeCompare(a.updated));
}

async function summarizeTournament(slug: string): Promise<ArchiveSummary | null> {
  const stored = await loadTournamentResults(slug);
  if (stored) {
    return { slug, site: stored.site, updated: stored.updated, gameCount: stored.parsedGames.length };
  }

  // Fallback for tournaments that predate the results.json roll-up but still have
  // per-game meta sidecars. Build a light summary without reading every meta.
  const metaFiles = await getMetaFiles(slug);
  if (metaFiles.size === 0) return null;

  const firstKey = metaFiles.keys().next().value as number;
  const [firstMeta, updated] = await Promise.all([getMetaFile(slug, firstKey), dirUpdatedAt(slug)]);

  return { slug, site: firstMeta?.site ?? slug, updated, gameCount: metaFiles.size };
}
