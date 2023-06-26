import { createLogger, transports, format } from 'winston';
import { blue, green, yellow, red, Chalk } from 'chalk';

const { combine, timestamp, printf } = format;

const colorMap: { [key: string]: Chalk } = {
  DEBUG: blue,
  INFO: green,
  WARN: yellow,
  ERROR: red,
};

const logger = createLogger({
  transports: [
    new transports.Console({ level: 'error' }),
    new transports.File({ level: 'debug', filename: `${process.env['LOG_DIR'] || ''}tlcv.log` }),
  ],
  format: combine(
    timestamp(),
    printf(
      (info) =>
        `${info.timestamp} ${colorMap[info.level.toUpperCase()](`[${info.level.toUpperCase().padStart(5)}]`)} ${
          info.message
        }`,
    ),
  ),
});

export default logger;
