import crypto from 'node:crypto';
import { Router, Request, Response } from 'express';
import basic from 'express-basic-auth';
import broadcasts from '../broadcast.js';
import { logger } from '../util/index.js';
import { closeConnection, getKibitzerManager, newConnection } from '../broadcast-manager.js';
import configStore from '../config/config-store.js';
import type { KibitzerConfig } from '../kibitzer/types.js';
import { register } from '../metrics.js';

const router = Router();

router.use(
  basic({
    users: { admin: process.env.TLCV_PASSWORD as string },
    challenge: true,
  }),
);

router.get('/', (_: Request, res: Response) => {
  const kibitzerManager = getKibitzerManager();
  res.render('pages/admin', {
    broadcasts: broadcasts.values(),
    kibitzers: kibitzerManager?.getStatus() ?? [],
  });
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

router.post('/kibitzers', async (req: Request, res: Response) => {
  const body = req.body;

  try {
    const id = crypto.randomUUID().slice(0, 8);
    let config: KibitzerConfig;

    if (body.type === 'ssh') {
      if (!body.host || !body.username || !body.privateKeyPath || !body.enginePath) {
        res.sendStatus(400);
        return;
      }

      config = {
        id,
        type: 'ssh',
        priority: Number(body.priority) || 1,
        host: body.host,
        port: body.port ? Number(body.port) : undefined,
        username: body.username,
        privateKeyPath: body.privateKeyPath,
        enginePath: body.enginePath,
        threads: body.threads ? Number(body.threads) : undefined,
        hash: body.hash ? Number(body.hash) : undefined,
      };
    } else {
      config = {
        id,
        type: 'local',
        priority: Number(body.priority) || 1,
        enginePath: body.enginePath || undefined,
        threads: body.threads ? Number(body.threads) : undefined,
        hash: body.hash ? Number(body.hash) : undefined,
      };
    }

    await configStore.addKibitzer(config);
    getKibitzerManager()?.addTransport(config);

    logger.info(`Added kibitzer ${id} (${config.type})`);
    res.sendStatus(200);
  } catch (error) {
    logger.warn('Unable to add kibitzer');
    logger.error(error);
    res.sendStatus(400);
  }
});

router.delete('/kibitzers/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    getKibitzerManager()?.removeTransport(id);
    await configStore.removeKibitzer(id);

    logger.info(`Removed kibitzer ${id}`);
    res.sendStatus(200);
  } catch (error) {
    logger.warn(`Unable to remove kibitzer ${id}`);
    logger.error(error);
    res.sendStatus(400);
  }
});

router.get('/metrics', async (_: Request, res: Response) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    logger.error(`Metrics scrape failed: ${err}`);
    res.status(500).end();
  }
});

export default router;
