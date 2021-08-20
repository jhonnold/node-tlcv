import { Router, Request, Response } from 'express';
import basic from 'express-basic-auth';
import broadcasts, { Broadcast, defaultUrl } from '../broadcast';

const router = Router();

router.use(
  basic({
    users: { admin: process.env['TLCV_PASSWORD'] as string },
    challenge: true,
  }),
);

router.get('/', (_: Request, res: Response) => {
  res.render('admin', { broadcasts: broadcasts.values() });
});

router.post('/close', (req: Request, res: Response) => {
  const port: number = req.body.port;
  const broadcast = broadcasts.get(port);

  if (broadcast) {
    broadcast.close();
    broadcasts.delete(port);
  }

  res.redirect('/admin');
});

router.post('/reconnect', (req: Request, res: Response) => {
  const port: number = req.body.port;
  const broadcast = broadcasts.get(port);

  if (broadcast) broadcast.reconnect();

  res.redirect('/admin');
});

router.post('/new', (req: Request, res: Response) => {
  const port = parseInt(req.body.port);

  if (!broadcasts.has(port) && port >= 16000 && port <= 16099) {
    broadcasts.set(port, new Broadcast(defaultUrl, port));
    setTimeout(() => res.sendStatus(200), 500); // just let some data populate
  } else {
    res.sendStatus(400);
  }
});

export default router;
