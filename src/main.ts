import http from 'http';
import app from './app';
import { logger } from './util';

const server = http.createServer(app);

server.listen(8080, () => {
  logger.info('Started listening on port 8080!');
});


