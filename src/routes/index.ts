import { Router, Request, Response, NextFunction } from 'express';
import broadcasts, { Broadcast } from '../broadcast.js';
import { siteSlug } from '../util/index.js';
import { getFiles } from '../services/pgn-cache.js';
import { getMetaFile, getMetaFileUrl } from '../services/game-meta.js';

interface RequestWithBroadcast extends Request {
  broadcast: Broadcast;
}

const router = Router();

router.get('/', (_: Request, res: Response): void => {
  const broadcastList = Array.from(broadcasts.values())
    .map((b) => {
      const kibitzerActive = b.kibitzerManager?.isTargeted(b.port) ?? false;

      return {
        port: b.port,
        white: b.game.white.name,
        black: b.game.black.name,
        whiteTime: b.game.white.clockTime,
        blackTime: b.game.black.clockTime,
        site: b.game.site,
        fen: b.game.instance.fen(),
        score: b.game.liveData.score,
        scoreColor: b.game.liveData.color,
        opening: b.game.opening,
        moveCount: b.game.moveMeta.length,
        viewerCount: b.browserCount,
        kibitzerActive,
      };
    })
    .sort((a, b) => b.viewerCount - a.viewerCount);

  res.render('pages/broadcasts', { broadcasts: broadcastList });
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
  res.render('pages/index', { game: broadcast.game, port: broadcast.port });
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
  const pgnFiles = await getFiles(slug);
  const games = await Promise.all(
    broadcast.parsedGames.map(async (g) => {
      const filename = pgnFiles.get(g.gameNumber);
      const metaUrl = await getMetaFileUrl(slug, g.gameNumber);
      return {
        ...g,
        pgnUrl: filename ? `/pgns/${slug}/${filename}` : undefined,
        metaUrl,
      };
    }),
  );

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

export default router;
