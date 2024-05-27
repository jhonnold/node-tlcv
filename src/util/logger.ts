import { createLogger, transports, format } from 'winston';
import chalk from 'chalk';

const { blue, green, yellow, red } = chalk;
const { combine, timestamp, printf } = format;

const colorMap: { [key: string]: chalk.Chalk } = {
  DEBUG: blue,
  INFO: green,
  WARN: yellow,
  ERROR: red,
};

const logger = createLogger({
  transports: [new transports.Console({ level: process.env['LOG_LEVEL'] || 'info' })],
  format: combine(
    timestamp(),
    printf(
      (info) =>
        `${info.timestamp} ${colorMap[info.level.toUpperCase()](`[${info.level.toUpperCase().padStart(5)}]`)} ` +
        `${info.port ? `[P${info.port}] ` : ''}${info.message}`,
    ),
  ),
});

export default logger;
