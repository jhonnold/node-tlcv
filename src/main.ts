import 'dotenv/config';

import http from 'http';
import { app } from './app.js';
import { io } from './socket-io-adapter.js';
import { logger } from './util/index.js';
import { connect } from './broadcast-manager.js';

const server = http.createServer(app);
io.attach(server);

(async () => {
  await connect();

  server.listen(8080, () => logger.info('Started listening on port 8080!'));
})();
