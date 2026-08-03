import { Router, Request, Response, NextFunction } from 'express';
import broadcasts, { Broadcast } from '../broadcast.js';
import { siteSlug } from '../util/index.js';
import { getFiles } from '../services/pgn-cache.js';
import { getMetaFile, getMetaFiles } from '../services/game-meta.js';
import { pgnUrl } from '../services/pgn-storage.js';
import { listArchivedTournaments, loadOrReconstructArchive } from '../services/tournament-results.js';
import type { GameRecord, ParsedResults, StoredTournamentResults } from '../../shared/types.js';

interface RequestWithBroadcast extends Request {
  broadcast: Broadcast;
}

interface RequestWithArchive extends Request {
  archive: StoredTournamentResults;
  archiveSlug: string;
}

const router = Router();

// Enriches stored game records with on-disk PGN/meta URLs. Shared by the live
// (`/:port/games/json`) and archive (`/archive/:slug/games/json`) routes. Both
// filename maps are fetched once up front — a tournament runs to hundreds of games.
async function enrichGames(slug: string, parsedGames: GameRecord[]): Promise<GameRecord[]> {
  const [pgnFiles, metaFiles] = await Promise.all([getFiles(slug), getMetaFiles(slug)]);

  return parsedGames.map((g) => {
    const pgnFile = pgnFiles.get(g.gameNumber);
    const metaFile = metaFiles.get(g.gameNumber);

    return {
      ...g,
      pgnUrl: pgnFile ? pgnUrl(slug, pgnFile) : undefined,
      metaUrl: metaFile ? pgnUrl(slug, metaFile) : undefined,
    };
  });
}

// The live and archive routes serve the same two payloads off different sources.
async function sendGameMeta(slug: string, gameNumber: number, res: Response): Promise<void> {
  const meta = await getMetaFile(slug, gameNumber);

  if (!meta) {
    res.status(404).json({ error: 'No metadata available for this game' });
    return;
  }

  res.status(200).json(meta);
}

function sendParsedResults(parsedResults: ParsedResults | null, res: Response): void {
  if (!parsedResults) {
    res.status(404).json({ error: 'No results available' });
    return;
  }

  res.status(200).json(parsedResults);
}

router.get('/', async (_: Request, res: Response): Promise<void> => {
  const broadcastList = Array.from(broadcasts.values())
    .map((b) => ({
      port: b.port,
      white: b.game.white.name,
      black: b.game.black.name,
      whiteTime: b.game.white.clockTime,
      blackTime: b.game.black.clockTime,
      site: b.game.site,
      fen: b.game.instance.fen(),
      // Only the score is shown here; getLiveData() would replay the whole PV per card.
      score: b.kibitzerManager?.getScore(b.port) ?? null,
      opening: b.game.opening,
      moveCount: b.game.moveMeta.length,
      viewerCount: b.browserCount,
    }))
    .sort((a, b) => b.viewerCount - a.viewerCount);

  // "Previous Broadcasts": archived tournaments excluding currently-live ones (those
  // already appear above). listArchivedTournaments() is cached — the disk scan only
  // re-runs on a live->archived transition (see tournament-results.ts), so this route
  // does no per-request disk I/O when warm. The liveSlugs filter stays per-request
  // because the live set changes independently of the cached scan; it's a cheap
  // in-memory Set lookup over the broadcasts map.
  const liveSlugs = new Set(Array.from(broadcasts.values()).map((b) => siteSlug(b.game.site)));
  const archived = (await listArchivedTournaments()).filter((t) => !liveSlugs.has(t.slug));

  res.render('pages/broadcasts', { broadcasts: broadcastList, archived });
});

router.get('/broadcasts', (_: Request, res: Response): void => {
  const broadcastIds = Array.from(broadcasts.keys());

  res.status(200).contentType('application/json').send(JSON.stringify(broadcastIds));
});

router.use('/:port([0-9]+)', (req: Request, res: Response, next: NextFunction): void => {
  const port: number = parseInt(req.params.port);
  const broadcast: Broadcast | undefined = broadcasts.get(port);

  if (!broadcast) {
    res.redirect('/');
    return;
  }

  (req as RequestWithBroadcast).broadcast = broadcast;
  next();
});

router.get('/:port([0-9]+)', (req: Request, res: Response): void => {
  const { broadcast } = req as RequestWithBroadcast;
  res.render('pages/index', {
    game: broadcast.game,
    port: broadcast.port,
    archive: false,
    slug: null,
    site: broadcast.game.site,
  });
});

router.get('/:port([0-9]+)/pgn', (req: Request, res: Response): void => {
  const { broadcast } = req as RequestWithBroadcast;
  res
    .status(200)
    .contentType('text/plain')
    .send(broadcast.game.instance.pgn({ maxWidth: 80 }));
});

router.get('/:port([0-9]+)/result-table', (req: Request, res: Response): void => {
  const { broadcast } = req as RequestWithBroadcast;

  res.status(200).contentType('text/plain').send(broadcast.results);
});

router.get('/:port([0-9]+)/result-table/json', (req: Request, res: Response): void => {
  sendParsedResults((req as RequestWithBroadcast).broadcast.parsedResults, res);
});

router.get('/:port([0-9]+)/games/json', async (req: Request, res: Response): Promise<void> => {
  const { broadcast } = req as RequestWithBroadcast;

  if (!broadcast.parsedGames) {
    res.status(404).json({ error: 'No games available' });
    return;
  }

  const slug = siteSlug(broadcast.game.site);
  const games = await enrichGames(slug, broadcast.parsedGames);

  res.status(200).json(games);
});

router.get('/:port([0-9]+)/games/:gameNumber([0-9]+)/meta', async (req: Request, res: Response): Promise<void> => {
  const { broadcast } = req as RequestWithBroadcast;
  await sendGameMeta(siteSlug(broadcast.game.site), parseInt(req.params.gameNumber, 10), res);
});

// --- Archive (previous broadcasts) ---
// Slugs are produced by `siteSlug` (slugify with `_`), so a safe slug is lowercase
// alphanumerics + underscores. Reject anything else to keep the value out of the
// `pgns/{slug}/...` path (defense against traversal).
const SAFE_SLUG = /^[a-z0-9_]+$/i;

router.use('/archive/:slug', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { slug } = req.params;

  if (!SAFE_SLUG.test(slug)) {
    res.redirect('/');
    return;
  }

  const archive = await loadOrReconstructArchive(slug);
  if (!archive) {
    res.redirect('/');
    return;
  }

  (req as RequestWithArchive).archive = archive;
  (req as RequestWithArchive).archiveSlug = slug;
  next();
});

router.get('/archive/:slug', (req: Request, res: Response): void => {
  const { archive, archiveSlug } = req as RequestWithArchive;
  res.render('pages/index', { archive: true, slug: archiveSlug, site: archive.site, port: null, game: null });
});

router.get('/archive/:slug/games/json', async (req: Request, res: Response): Promise<void> => {
  const { archive, archiveSlug } = req as RequestWithArchive;
  const games = await enrichGames(archiveSlug, archive.parsedGames);
  res.status(200).json(games);
});

router.get('/archive/:slug/games/:gameNumber([0-9]+)/meta', async (req: Request, res: Response): Promise<void> => {
  const { archiveSlug } = req as RequestWithArchive;
  await sendGameMeta(archiveSlug, parseInt(req.params.gameNumber, 10), res);
});

router.get('/archive/:slug/result-table/json', (req: Request, res: Response): void => {
  sendParsedResults((req as RequestWithArchive).archive.parsedResults, res);
});

export default router;
