import { Router, Request, Response, NextFunction } from 'express';
import broadcasts, { Broadcast } from '../broadcast.js';

interface RequestWithBroadcast extends Request {
  broadcast: Broadcast;
}

const router = Router();

router.get('/', (_: Request, res: Response): void => {
  const broadcastList = Array.from(broadcasts.values()).map((b) => ({
    port: b.port,
    white: b.game.white.name,
    black: b.game.black.name,
    site: b.game.site,
    viewerCount: b.browserCount,
  }));

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

router.get('/:port([0-9]+)/games/json', (req: Request, res: Response): void => {
  const { broadcast } = req as RequestWithBroadcast;

  if (!broadcast.parsedGames) {
    res.status(404).json({ error: 'No games available' });
    return;
  }

  res.status(200).json(broadcast.parsedGames);
});

export default router;
