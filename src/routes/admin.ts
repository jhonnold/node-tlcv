import crypto from 'node:crypto';
import { Router, Request, Response } from 'express';
import basic from 'express-basic-auth';
import broadcasts from '../broadcast.js';
import { logger } from '../util/index.js';
import { closeConnection, getKibitzerManager, getWebhookManager, newConnection } from '../broadcast-manager.js';
import configStore from '../config/config-store.js';
import type { KibitzerConfig } from '../kibitzer/types.js';
import type { WebhookConfig, WebhookEventKind } from '../webhooks/types.js';
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
    webhooks: getWebhookManager()?.getStatus() ?? [],
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

router.post('/webhooks', async (req: Request, res: Response) => {
  const body = req.body;

  try {
    if (!body.url || body.type !== 'discord') {
      res.sendStatus(400);
      return;
    }

    const id = crypto.randomUUID().slice(0, 8);

    const ports = String(body.ports ?? '')
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n));

    const rawEvents: string[] = Array.isArray(body.events) ? body.events : body.events ? [body.events] : [];
    const events = rawEvents.filter((e): e is WebhookEventKind => e === 'game-started' || e === 'game-finished');

    const config: WebhookConfig = {
      id,
      type: 'discord',
      name: body.name || undefined,
      url: body.url,
      ports: ports.length ? ports : undefined,
      events: events.length ? events : undefined,
    };

    await configStore.addWebhook(config);
    getWebhookManager()?.addWebhook(config);

    logger.info(`Added webhook ${id}`);
    res.sendStatus(200);
  } catch (error) {
    logger.warn('Unable to add webhook');
    logger.error(error);
    res.sendStatus(400);
  }
});

router.delete('/webhooks/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    getWebhookManager()?.removeWebhook(id);
    await configStore.removeWebhook(id);

    logger.info(`Removed webhook ${id}`);
    res.sendStatus(200);
  } catch (error) {
    logger.warn(`Unable to remove webhook ${id}`);
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
