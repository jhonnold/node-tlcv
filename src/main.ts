import 'dotenv/config';

import crypto from 'node:crypto';
import http from 'http';
import { app } from './app.js';
import { io } from './socket-io-adapter.js';
import { logger } from './util/index.js';
import { connect, setKibitzerManager } from './broadcast-manager.js';
import { KibitzerManager } from './kibitzer/index.js';
import { loadAll as loadPgnCache } from './services/pgn-cache.js';
import { loadAll as loadMetaCache } from './services/game-meta.js';
import configStore from './config/config-store.js';

const server = http.createServer(app);
io.attach(server);

(async () => {
  await Promise.all([loadPgnCache(), loadMetaCache()]);

  const config = await configStore.load();
  const kibitzers = config.kibitzers ?? [];

  let needsSave = false;
  for (const k of kibitzers) {
    if (!k.id) {
      k.id = crypto.randomUUID().slice(0, 8);
      needsSave = true;
    }
  }
  if (needsSave) {
    config.kibitzers = kibitzers;
    await configStore.save(config);
    logger.info('Assigned IDs to kibitzer configs missing them');
  }

  const kibitzerManager = new KibitzerManager(kibitzers);

  setKibitzerManager(kibitzerManager);
  await connect();

  kibitzerManager.start();

  server.listen(8080, () => logger.info('Started listening on port 8080!'));
})();
