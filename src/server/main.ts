import 'dotenv/config';

import http from 'http';
import app from './app';
import io from './io';
import { logger, connect } from './util/index';

const server = http.createServer(app);
io.attach(server);

(async () => {
  await connect();

  server.listen(8080, () => logger.info('Started listening on port 8080!'));
})();
