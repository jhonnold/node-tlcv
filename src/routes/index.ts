import { Router, Request, Response, NextFunction } from 'express';
import broadcasts, { Broadcast } from '../broadcast.js';
import { siteSlug } from '../util/index.js';
import { getFiles } from '../services/pgn-cache.js';
import { getMetaFile, getMetaFiles } from '../services/game-meta.js';
import { pgnUrl } from '../services/pgn-storage.js';
import { listArchivedTournaments, loadOrReconstructArchive } from '../services/tournament-results.js';
import type {
  ArchiveInfo,
  BroadcastSummary,
  GameRecord,
  LobbyBroadcast,
  ParsedResults,
  StoredTournamentResults,
} from '../../shared/types.js';
import { sendApp } from './spa.js';

interface RequestWithBroadcast extends Request {
  broadcast: Broadcast;
}

interface RequestWithArchive extends Request {
  archive: StoredTournamentResults;
  archiveSlug: string;
}

const router = Router();

// Slugs are produced by `siteSlug` (slugify with `_`), so a safe slug is lowercase
// alphanumerics + underscores. Reject anything else to keep the value out of the
// `pgns/{slug}/...` path (defense against traversal).
const SAFE_SLUG = /^[a-z0-9_]+$/i;

// Enriches stored game records with on-disk PGN/meta URLs. Shared by the live
// (`/broadcasts/:port/games`) and archive (`/archives/:slug/games`) routes. Both
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

type OnMissing = (res: Response) => void;
const redirectHome: OnMissing = (res) => res.redirect('/');
const notFound =
  (what: string): OnMissing =>
  (res) => {
    res.status(404).json({ error: `${what} not found` });
  };

// Page routes redirect home on a miss (unchanged behaviour); API routes answer 404 JSON.
function withBroadcast(onMissing: OnMissing) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const broadcast = broadcasts.get(parseInt(req.params.port, 10));
    if (!broadcast) {
      onMissing(res);
      return;
    }
    (req as RequestWithBroadcast).broadcast = broadcast;
    next();
  };
}

function withArchive(onMissing: OnMissing) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { slug } = req.params;
    const archive = SAFE_SLUG.test(slug) ? await loadOrReconstructArchive(slug) : null;
    if (!archive) {
      onMissing(res);
      return;
    }
    (req as RequestWithArchive).archive = archive;
    (req as RequestWithArchive).archiveSlug = slug;
    next();
  };
}

function sendPgn(req: Request, res: Response): void {
  const { broadcast } = req as RequestWithBroadcast;
  res
    .status(200)
    .contentType('text/plain')
    .send(broadcast.game.instance.pgn({ maxWidth: 80 }));
}

function lobbyBroadcasts(): LobbyBroadcast[] {
  return Array.from(broadcasts.values())
    .map((b): LobbyBroadcast => ({
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
}

router.get('/', sendApp);

router.get('/broadcasts', (_: Request, res: Response): void => {
  res.json(lobbyBroadcasts());
});

router.use('/broadcasts/:port([0-9]+)', withBroadcast(notFound('Broadcast')));

router.get('/broadcasts/:port([0-9]+)', (req: Request, res: Response): void => {
  const { port, game } = (req as RequestWithBroadcast).broadcast;
  res.json({ port, site: game.site, white: game.white.name, black: game.black.name } satisfies BroadcastSummary);
});

router.get('/broadcasts/:port([0-9]+)/results', (req: Request, res: Response): void => {
  const { broadcast } = req as RequestWithBroadcast;
  sendParsedResults(broadcast.parsedResults, res);
});

router.get('/broadcasts/:port([0-9]+)/games', async (req: Request, res: Response): Promise<void> => {
  const { broadcast } = req as RequestWithBroadcast;

  if (!broadcast.parsedGames) {
    res.status(404).json({ error: 'No games available' });
    return;
  }

  const slug = siteSlug(broadcast.game.site);
  const games = await enrichGames(slug, broadcast.parsedGames);

  res.status(200).json(games);
});

router.get(
  '/broadcasts/:port([0-9]+)/games/:gameNumber([0-9]+)',
  async (req: Request, res: Response): Promise<void> => {
    const { broadcast } = req as RequestWithBroadcast;
    await sendGameMeta(siteSlug(broadcast.game.site), parseInt(req.params.gameNumber, 10), res);
  },
);

router.get('/broadcasts/:port([0-9]+)/pgn', sendPgn);

router.get('/archives', async (_: Request, res: Response): Promise<void> => {
  // "Previous Broadcasts": archived tournaments excluding currently-live ones (those
  // already appear in the lobby). listArchivedTournaments() is cached — the disk scan only
  // re-runs on a live->archived transition (see tournament-results.ts), so this route
  // does no per-request disk I/O when warm. The liveSlugs filter stays per-request
  // because the live set changes independently of the cached scan; it's a cheap
  // in-memory Set lookup over the broadcasts map.
  const liveSlugs = new Set(Array.from(broadcasts.values()).map((b) => siteSlug(b.game.site)));
  const archived = (await listArchivedTournaments()).filter((t) => !liveSlugs.has(t.slug));

  res.json(archived);
});

router.use('/archives/:slug', withArchive(notFound('Archive')));

router.get('/archives/:slug', (req: Request, res: Response): void => {
  const { archive, archiveSlug } = req as RequestWithArchive;
  res.json({ site: archive.site, slug: archiveSlug } satisfies ArchiveInfo);
});

router.get('/archives/:slug/results', (req: Request, res: Response): void => {
  sendParsedResults((req as RequestWithArchive).archive.parsedResults, res);
});

router.get('/archives/:slug/games', async (req: Request, res: Response): Promise<void> => {
  const { archive, archiveSlug } = req as RequestWithArchive;
  const games = await enrichGames(archiveSlug, archive.parsedGames);
  res.status(200).json(games);
});

router.get('/archives/:slug/games/:gameNumber([0-9]+)', async (req: Request, res: Response): Promise<void> => {
  const { archiveSlug } = req as RequestWithArchive;
  await sendGameMeta(archiveSlug, parseInt(req.params.gameNumber, 10), res);
});

router.use('/:port([0-9]+)', withBroadcast(redirectHome));

router.get('/:port([0-9]+)', sendApp);

router.get('/:port([0-9]+)/pgn', sendPgn);

router.get('/:port([0-9]+)/result-table', (req: Request, res: Response): void => {
  const { broadcast } = req as RequestWithBroadcast;

  res.status(200).contentType('text/plain').send(broadcast.results);
});

router.use('/archive/:slug', withArchive(redirectHome));

router.get('/archive/:slug', sendApp);

export default router;
