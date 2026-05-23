import 'dotenv/config';

import crypto from 'node:crypto';
import http from 'http';
import { app } from './app.js';
import { io } from './socket-io-adapter.js';
import { logger } from './util/index.js';
import { connect, setKibitzerManager, setWebhookManager } from './broadcast-manager.js';
import { KibitzerManager } from './kibitzer/index.js';
import { WebhookManager } from './webhooks/index.js';
import { loadAll as loadPgnCache } from './services/pgn-cache.js';
import { loadAll as loadMetaCache } from './services/game-meta.js';
import configStore from './config/config-store.js';

const server = http.createServer(app);
io.attach(server);

(async () => {
  await Promise.all([loadPgnCache(), loadMetaCache()]);

  const config = await configStore.load();
  const kibitzers = config.kibitzers ?? [];
  const webhooks = config.webhooks ?? [];

  // Backfill IDs for configs created before runtime management was added
  let needsSave = false;
  for (const k of kibitzers) {
    if (!k.id) {
      k.id = crypto.randomUUID().slice(0, 8);
      needsSave = true;
    }
  }
  for (const w of webhooks) {
    if (!w.id) {
      w.id = crypto.randomUUID().slice(0, 8);
      needsSave = true;
    }
  }
  if (needsSave) {
    config.kibitzers = kibitzers;
    config.webhooks = webhooks;
    await configStore.save(config);
    logger.info('Assigned IDs to configs missing them');
  }

  const kibitzerManager = new KibitzerManager(kibitzers);
  const webhookManager = new WebhookManager(webhooks);

  setKibitzerManager(kibitzerManager);
  setWebhookManager(webhookManager);
  await connect();

  kibitzerManager.start();

  const port = Number(process.env.PORT) || 8080;
  server.listen(port, () => logger.info(`Started listening on port ${port}!`));
})();
