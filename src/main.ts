import 'dotenv/config';

import http from 'http';
import { app } from './app.js';
import { io } from './socket-io-adapter.js';
import { logger } from './util/index.js';
import { genId } from './util/ids.js';
import { connect, setKibitzerManager, setWebhookManager } from './broadcast-manager.js';
import { KibitzerManager } from './kibitzer/index.js';
import { WebhookManager } from './webhooks/index.js';
import { loadAll as loadPgnCache } from './services/pgn-cache.js';
import { loadAll as loadMetaCache } from './services/game-meta.js';
import { listArchivedTournaments } from './services/tournament-results.js';
import configStore from './config/config-store.js';
import { env } from './config/env.js';

const server = http.createServer(app);
io.attach(server);

(async () => {
  // Warm the homepage archive-listing cache alongside the file caches so the first
  // `/` hit does no disk scan. listArchivedTournaments() resolves to [] on error.
  await Promise.all([loadPgnCache(), loadMetaCache(), listArchivedTournaments()]);

  const config = await configStore.load();
  const kibitzers = config.kibitzers ?? [];
  const webhooks = config.webhooks ?? [];

  // Backfill IDs for configs created before runtime management was added
  let needsSave = false;
  for (const k of kibitzers) {
    if (!k.id) {
      k.id = genId();
      needsSave = true;
    }
  }
  for (const w of webhooks) {
    if (!w.id) {
      w.id = genId();
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

  server.listen(env.port, () => logger.info(`Started listening on port ${env.port}!`));
})();
