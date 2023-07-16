import { Router, Request, Response } from 'express';
import basic from 'express-basic-auth';
import broadcasts, { Broadcast } from '../broadcast.js';
import { config } from '../config.js';
import { logger } from '../util/index.js';

const router = Router();

router.use(
  basic({
    users: { admin: process.env.TLCV_PASSWORD as string },
    challenge: true,
  }),
);

router.get('/', (_: Request, res: Response) => {
  res.render('pages/admin', { broadcasts: broadcasts.values() });
});

router.post('/close', (req: Request, res: Response) => {
  const { port } = req.body;
  const broadcast = broadcasts.get(port);

  if (broadcast) {
    logger.info(`Closing broadcast ${broadcast.game.name} @ port ${broadcast.port}`);

    broadcast.close();
    broadcasts.delete(port);
    res.sendStatus(200);
  } else {
    res.sendStatus(400);
  }
});

router.post('/reconnect', (req: Request, res: Response) => {
  const { port } = req.body;
  const broadcast = broadcasts.get(port);

  if (broadcast) {
    logger.info(`Reconnecting broadcast ${broadcast.game.name} @ port ${broadcast.port}`);
    broadcast.reconnect();

    res.sendStatus(200);
  } else {
    res.sendStatus(400);
  }
});

router.post('/new', (req: Request, res: Response) => {
  const port = parseInt(req.body.port);

  if (!broadcasts.has(port)) {
    broadcasts.set(port, new Broadcast(config.url, port));
    setTimeout(() => res.sendStatus(200), 500); // just let some data populate
  } else {
    res.sendStatus(400);
  }
});

export default router;
