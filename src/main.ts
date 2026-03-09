import 'dotenv/config';

import http from 'http';
import { app } from './app.js';
import { io } from './socket-io-adapter.js';
import { logger } from './util/index.js';
import { connect, setKibitzerManager } from './broadcast-manager.js';
import { KibitzerManager } from './kibitzer/index.js';

const server = http.createServer(app);
io.attach(server);

(async () => {
  const kibitzerManager = new KibitzerManager();

  setKibitzerManager(kibitzerManager);
  await connect();

  kibitzerManager.start();

  server.listen(8080, () => logger.info('Started listening on port 8080!'));
})();
