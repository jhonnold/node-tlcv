import { Router, Request, Response, NextFunction } from 'express';
import basic from 'express-basic-auth';
import broadcasts from '../broadcast.js';
import { logger } from '../util/index.js';
import { genId } from '../util/ids.js';
import { closeConnection, getKibitzerManager, getWebhookManager, newConnection } from '../broadcast-manager.js';
import configStore from '../config/config-store.js';
import { env } from '../config/env.js';
import type { KibitzerConfig } from '../kibitzer/types.js';
import type { WebhookConfig, WebhookEventKind } from '../webhooks/types.js';
import type { AdminBroadcast } from '../../shared/types.js';
import { register } from '../metrics.js';
import { sendApp } from './spa.js';

const router = Router();

// Fail closed when TLCV_PASSWORD is unset: express-basic-auth compares the supplied
// password against the configured one, and an empty configured password matches an
// empty supplied one — so an unconfigured deployment would accept a blank login.
if (!env.adminPassword) logger.error('TLCV_PASSWORD is not set — the admin panel is disabled.');

router.use((_: Request, res: Response, next: NextFunction): void => {
  if (!env.adminPassword) {
    res.sendStatus(503);
    return;
  }

  next();
});

router.use(
  basic({
    users: { admin: env.adminPassword },
    challenge: true,
  }),
);

/**
 * Wraps a mutating admin handler so every one of them reports failure the same way:
 * a labelled warning, the error itself, and a 400 to the caller.
 */
function guard(label: string, fn: (req: Request, res: Response) => Promise<void> | void) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      await fn(req, res);
    } catch (error) {
      logger.warn(label);
      logger.error(error);
      res.sendStatus(400);
    }
  };
}

const optionalNumber = (value: unknown): number | undefined => (value ? Number(value) : undefined);

router.get('/', sendApp);

router.get('/broadcasts', (_: Request, res: Response) => {
  res.json(
    [...broadcasts.values()].map((b): AdminBroadcast => ({
      connection: b.connection,
      host: b.host,
      port: b.port,
      site: b.game.site,
      ephemeral: b.ephemeral,
      viewerCount: b.browserCount,
    })),
  );
});

router.get('/connection-history', async (_: Request, res: Response) => {
  // Already-live connections would only 400 with "Port already in use!" — keep them out of the picker.
  const active = new Set([...broadcasts.values()].map((b) => b.connection));

  res.json((await configStore.getConnectionHistory()).filter((c) => !active.has(c)));
});

router.get('/kibitzers', (_: Request, res: Response) => {
  res.json(getKibitzerManager()?.getStatus() ?? []);
});

router.get('/webhooks', (_: Request, res: Response) => {
  res.json(getWebhookManager()?.getStatus() ?? []);
});

router.delete(
  '/broadcasts/:connection',
  guard('Unable to close connection', async (req, res) => {
    const { connection } = req.params;

    logger.info(`Attempting to close connection ${connection}`);
    await closeConnection(connection);
    res.sendStatus(200);
  }),
);

router.post(
  '/broadcasts',
  guard('Unable to add connection', async (req, res) => {
    const { connection } = req.body;
    const ephemeral = Boolean(req.body.ephemeral);

    logger.info(`Attempting new connection of ${connection}${ephemeral ? ' (ephemeral)' : ''}`);
    await newConnection(connection, ephemeral);
    res.sendStatus(200);
  }),
);

router.post(
  '/kibitzers',
  guard('Unable to add kibitzer', async (req, res) => {
    const body = req.body;
    const base = {
      id: genId(),
      priority: Number(body.priority) || 1,
      threads: optionalNumber(body.threads),
      hash: optionalNumber(body.hash),
    };

    let config: KibitzerConfig;
    if (body.type === 'ssh') {
      if (!body.host || !body.username || !body.privateKeyPath || !body.enginePath) {
        res.sendStatus(400);
        return;
      }

      config = {
        ...base,
        type: 'ssh',
        host: body.host,
        port: optionalNumber(body.port),
        username: body.username,
        privateKeyPath: body.privateKeyPath,
        enginePath: body.enginePath,
      };
    } else {
      config = { ...base, type: 'local', enginePath: body.enginePath || undefined };
    }

    await configStore.addKibitzer(config);
    getKibitzerManager()?.addTransport(config);

    logger.info(`Added kibitzer ${config.id} (${config.type})`);
    res.sendStatus(200);
  }),
);

router.delete(
  '/kibitzers/:id',
  guard('Unable to remove kibitzer', async (req, res) => {
    const { id } = req.params;

    getKibitzerManager()?.removeTransport(id);
    await configStore.removeKibitzer(id);

    logger.info(`Removed kibitzer ${id}`);
    res.sendStatus(200);
  }),
);

router.post(
  '/webhooks',
  guard('Unable to add webhook', async (req, res) => {
    const body = req.body;

    if (!body.url || body.type !== 'discord') {
      res.sendStatus(400);
      return;
    }

    const ports = String(body.ports ?? '')
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n));

    const rawEvents: string[] = Array.isArray(body.events) ? body.events : body.events ? [body.events] : [];
    const events = rawEvents.filter((e): e is WebhookEventKind => e === 'game-started' || e === 'game-finished');

    const config: WebhookConfig = {
      id: genId(),
      type: 'discord',
      name: body.name || undefined,
      url: body.url,
      ports: ports.length ? ports : undefined,
      events: events.length ? events : undefined,
    };

    await configStore.addWebhook(config);
    getWebhookManager()?.addWebhook(config);

    logger.info(`Added webhook ${config.id}`);
    res.sendStatus(200);
  }),
);

router.delete(
  '/webhooks/:id',
  guard('Unable to remove webhook', async (req, res) => {
    const { id } = req.params;

    getWebhookManager()?.removeWebhook(id);
    await configStore.removeWebhook(id);

    logger.info(`Removed webhook ${id}`);
    res.sendStatus(200);
  }),
);

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
