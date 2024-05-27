import { Router, Request, Response } from 'express';
import basic from 'express-basic-auth';
import broadcasts from '../broadcast.js';
import { logger, closeConnection, newConnection } from '../util/index.js';

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

router.post('/close', async (req: Request, res: Response) => {
  const { connection } = req.body;

  try {
    await closeConnection(connection);
    res.sendStatus(200);
  } catch {
    logger.warn(`Unable to close connection ${connection}`);
    res.sendStatus(400);
  }
});

router.post('/new', async (req: Request, res: Response) => {
  const { connection } = req.body;

  try {
    await newConnection(connection);
    res.sendStatus(200);
  } catch {
    logger.warn(`Unable to add connection ${connection}`);
    res.sendStatus(400);
  }
});

export default router;
