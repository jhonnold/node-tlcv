import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { app } from './app';
import { io } from './io';
import { connect } from './broadcast';
import { logger } from './util';

const server = http.createServer(app);
io.attach(server);

(async () => {
  await connect();

  server.listen(8080, () => logger.info('Started listening on port 8080!'));
})();
