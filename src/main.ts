import { createLogger, transports, format } from 'winston';

const logger = createLogger({
  transports: [
    new transports.Console({ level: 'warn' }),
    new transports.File({ dirname: 'logs', filename: 'node-tlcv.log' }),
  ],
  format: format.combine(
    format.timestamp(),
    format.printf((info) => `${info.timestamp} [${info.level.toUpperCase().padStart(5)}] ${info.message}`),
  ),
});

logger.debug('Hello, World!');
logger.info('Hello, World!');
logger.warn('Hello, World!');
logger.error('Hello, World!');
