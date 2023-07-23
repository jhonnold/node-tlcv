import { createLogger, transports, format } from 'winston';
import chalk from 'chalk';

const { blue, green, yellow, red } = chalk;
const { combine, timestamp, printf } = format;

const colorMap: { [key: string]: chalk.Chalk } = {
  debug: blue,
  info: green,
  warn: yellow,
  error: red,
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
        `${info.timestamp} ${colorMap[info.level](`[${info.level}]`)} [P${info.port}] ${info.message}`,
    ),
  ),
});

export default logger;
