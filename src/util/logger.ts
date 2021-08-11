import { createLogger, transports, format } from 'winston';

const { combine, timestamp, printf } = format;

const logger = createLogger({
  transports: [
    new transports.Console({ level: 'info' }),
    new transports.File({ dirname: 'logs', filename: 'node-tlcv.log', level: 'debug' }),
  ],
  format: combine(
    timestamp(),
    printf((info) => `${info.timestamp} [${info.level.toUpperCase().padStart(5)}] ${info.message}`),
  ),
});

export default logger;
