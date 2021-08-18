import { Router, Request, Response, NextFunction } from 'express';
import broadcasts, { Broadcast } from '../broadcast';

interface RequestWithBroadcast extends Request {
  broadcast: Broadcast;
}

const router = Router();

router.get('/', (_: Request, res: Response): void => {
  res.redirect(`/16093`);
});

router.use('/:port(160[0-9]{2})', (req: Request, res: Response, next: NextFunction): void => {
  const port: number = parseInt(req.params.port);
  const broadcast: Broadcast | undefined = broadcasts[port];

  if (!broadcast) {
    res.sendStatus(404);
    return;
  }

  (req as RequestWithBroadcast).broadcast = broadcast;
  next();
});

router.get('/:port(160[0-9]{2})', (req: Request, res: Response): void => {
  const { broadcast } = req as RequestWithBroadcast;
  res.render('index', { game: broadcast.game, port: broadcast.port });
});

router.get('/:port(160[0-9]{2})/pgn', (req: Request, res: Response): void => {
  const { broadcast } = req as RequestWithBroadcast;
  res.status(200).contentType('text/plain').send(broadcast.game.instance.pgn());
});

router.get('/:port(160[0-9]{2})/result-table', (req: Request, res: Response): void => {
  const { broadcast } = req as RequestWithBroadcast;

  broadcast.connection.send('RESULTTABLE');
  setTimeout(() => res.status(200).contentType('text/plain').send(broadcast.results), 5000);
});

export default router;
