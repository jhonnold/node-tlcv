import { Router, Request, Response } from 'express';
import { Broadcast } from '../broadcast.js';

interface RequestWithBroadcast extends Request {
  broadcast: Broadcast;
}

const router = Router();

router.get('/:port([0-9]+)/pgn', (req: Request, res: Response): void => {
  const { broadcast } = req as RequestWithBroadcast;
  res.status(200).contentType('text/plain').send(broadcast.game.instance.pgn());
});

router.get('/:port([0-9]+)/result-table', async (req: Request, res: Response): Promise<void> => {
  const { broadcast } = req as RequestWithBroadcast;
  const results = await broadcast.loadResults();

  res.status(200).contentType('text/plain').send(results);
});

export default router;
