import { Router, Request, Response, NextFunction } from 'express';
import broadcasts, { Broadcast } from '../broadcast.js';
import { siteSlug } from '../util/index.js';
import { getFiles } from '../services/pgn-cache.js';
import { getMetaFile, getMetaFileUrl } from '../services/game-meta.js';
import { loadOrReconstructArchive } from '../services/tournament-results.js';
import type { GameRecord, StoredTournamentResults } from '../../shared/types.js';

interface RequestWithBroadcast extends Request {
  broadcast: Broadcast;
}

interface RequestWithArchive extends Request {
  archive: StoredTournamentResults;
  archiveSlug: string;
}

const router = Router();

// Enriches stored game records with on-disk PGN/meta URLs. Shared by the live
// (`/:port/games/json`) and archive (`/archive/:slug/games/json`) routes.
async function enrichGames(slug: string, parsedGames: GameRecord[]): Promise<GameRecord[]> {
  const pgnFiles = await getFiles(slug);
  return Promise.all(
    parsedGames.map(async (g) => {
      const filename = pgnFiles.get(g.gameNumber);
      const metaUrl = await getMetaFileUrl(slug, g.gameNumber);
      return {
        ...g,
        pgnUrl: filename ? `/pgns/${slug}/${filename}` : undefined,
        metaUrl,
      };
    }),
  );
}

router.get('/', async (_: Request, res: Response): Promise<void> => {
  const broadcastList = Array.from(broadcasts.values())
    .map((b) => {
      const kibitzerData = b.kibitzerManager?.getLiveData(b.port) ?? null;

      return {
        port: b.port,
        white: b.game.white.name,
        black: b.game.black.name,
        whiteTime: b.game.white.clockTime,
        blackTime: b.game.black.clockTime,
        site: b.game.site,
        fen: b.game.instance.fen(),
        score: kibitzerData?.score ?? null,
        opening: b.game.opening,
        moveCount: b.game.moveMeta.length,
        viewerCount: b.browserCount,
      };
    })
    .sort((a, b) => b.viewerCount - a.viewerCount);

  // NOTE: the "Previous Broadcasts" archive listing was removed from the homepage.
  // listArchivedTournaments() read+parsed every pgns/*/tournament-results.json and
  // scanned meta-only folders on every `/` hit — uncached, synchronous JSON.parse on
  // the site's most-trafficked route, which drained the host's CPU credits. Tournament
  // data is still persisted (saveTournamentResults) and reachable via /archive/:slug.
  // We still pass `archived: []` because broadcasts.ejs references the variable under
  // EJS's `with(locals)` scope — omitting it entirely throws a ReferenceError. The
  // empty array makes the template's `archived && archived.length` guard hide the
  // section. Re-enable via a cached listing if/when needed.
  res.render('pages/broadcasts', { broadcasts: broadcastList, archived: [] });
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
  const { broadcast } = req as RequestWithBroadcast;

  if (!broadcast.parsedResults) {
    res.status(404).json({ error: 'No results available' });
    return;
  }

  res.status(200).json(broadcast.parsedResults);
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
  const gameNumber = parseInt(req.params.gameNumber, 10);
  const slug = siteSlug(broadcast.game.site);
  const meta = await getMetaFile(slug, gameNumber);

  if (!meta) {
    res.status(404).json({ error: 'No metadata available for this game' });
    return;
  }

  res.status(200).json(meta);
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
  const gameNumber = parseInt(req.params.gameNumber, 10);
  const meta = await getMetaFile(archiveSlug, gameNumber);

  if (!meta) {
    res.status(404).json({ error: 'No metadata available for this game' });
    return;
  }

  res.status(200).json(meta);
});

router.get('/archive/:slug/result-table/json', (req: Request, res: Response): void => {
  const { archive } = req as RequestWithArchive;

  if (!archive.parsedResults) {
    res.status(404).json({ error: 'No results available' });
    return;
  }

  res.status(200).json(archive.parsedResults);
});

export default router;
