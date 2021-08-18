import http from 'http';
import { app } from './app';
import { io } from './io';
import { logger } from './util';

const server = http.createServer(app);
io.attach(server);

server.listen(8080, () => {
  logger.info('Started listening on port 8080!');
});
