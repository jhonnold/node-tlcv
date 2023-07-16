import 'dotenv/config';

import http from 'http';
import { app } from './app.js';
import { io } from './io.js';
import { connect } from './broadcast.js';
import { logger } from './util/index.js';

const server = http.createServer(app);
io.attach(server);

(async () => {
  await connect();

  server.listen(8080, () => logger.info('Started listening on port 8080!'));
})();
