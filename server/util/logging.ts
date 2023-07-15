import { Request, Response, NextFunction } from 'express';
import onFinished from 'on-finished';
import logger from './logger.js';

export default (req: Request, res: Response, next: NextFunction): void => {
  const start = new Date().getTime();

  const print = (): void => {
    logger.log({
      message: `${req.method} ${req.originalUrl || req.url} ${req.body?.method || '--'} ${res.statusCode} - ${
        new Date().getTime() - start
      }ms`,
      level: res.statusCode >= 400 ? 'error' : 'info',
    });
  };

  onFinished(res, print);
  next();
};
