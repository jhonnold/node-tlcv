import 'dotenv/config';

import http from 'http';
import { app } from './app.js';
import { io } from './socket-io-adapter.js';
import { logger } from './util/index.js';
import { connect, setKibitzerManager } from './broadcast-manager.js';
import { KibitzerManager, createTransports } from './kibitzer/index.js';
import { loadAll as loadPgnCache } from './services/pgn-cache.js';
import { loadAll as loadMetaCache } from './services/game-meta.js';
import configStore from './config/config-store.js';

const server = http.createServer(app);
io.attach(server);

(async () => {
  await Promise.all([loadPgnCache(), loadMetaCache()]);

  const config = await configStore.load();
  const transports = createTransports(config.kibitzers ?? []);
  const kibitzerManager = new KibitzerManager(transports);

  setKibitzerManager(kibitzerManager);
  await connect();

  kibitzerManager.start();

  server.listen(8080, () => logger.info('Started listening on port 8080!'));
})();
