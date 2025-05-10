import { Router, Request, Response } from 'express';
import basic from 'express-basic-auth';
import broadcasts from '../broadcast';
import { logger, closeConnection, newConnection } from '../util/index';

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
  } catch (error) {
    logger.warn(`Unable to close connection ${connection}`);
    logger.error(error);
    res.sendStatus(400);
  }
});

router.post('/new', async (req: Request, res: Response) => {
  const { connection } = req.body;

  try {
    logger.info(`Attempting new connection of ${connection}`);
    await newConnection(connection);
    res.sendStatus(200);
  } catch (error) {
    logger.warn(`Unable to add connection ${connection}`);
    logger.error(error);
    res.sendStatus(400);
  }
});

export default router;
