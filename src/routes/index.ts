import { Router, Request, Response, NextFunction } from 'express';
import broadcasts, { Broadcast } from '../broadcast.js';

interface RequestWithBroadcast extends Request {
  broadcast: Broadcast;
}

const router = Router();

router.get('/', (_: Request, res: Response): void => {
  const [first] = broadcasts.values();

  res.redirect(`/${first.port}`);
});

router.get('/broadcasts', (_: Request, res: Response): void => {
  const broadcast_ids = broadcasts.keys();

  res.status(200).contentType('application/json').send(JSON.stringify(broadcast_ids));
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
  res.status(200).contentType('text/plain').send(broadcast.game.instance.pgn());
});

router.get('/:port([0-9]+)/result-table', (req: Request, res: Response): void => {
  const { broadcast } = req as RequestWithBroadcast;

  res.status(200).contentType('text/plain').send(broadcast.results);
});

export default router;
