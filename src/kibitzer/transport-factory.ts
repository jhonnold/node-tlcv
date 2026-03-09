import { logger } from '../util/index.js';
import { LocalTransport } from './local-transport.js';
import { SshTransport } from './ssh-transport.js';
import type { KibitzerConfig, KibitzerTransport } from './types.js';

export function createTransports(configs: KibitzerConfig[]): KibitzerTransport[] {
  const sorted = [...configs].sort((a, b) => b.priority - a.priority);

  const transports: KibitzerTransport[] = [];
  for (const config of sorted) {
    switch (config.type) {
      case 'local':
        logger.info(`Kibitzer: creating LocalTransport (priority ${config.priority})`);
        transports.push(new LocalTransport(config));
        break;
      case 'ssh':
        logger.info(`Kibitzer: creating SshTransport for ${config.host} (priority ${config.priority})`);
        transports.push(new SshTransport(config));
        break;
      default:
        logger.warn(`Kibitzer: unknown transport type "${(config as KibitzerConfig).type}", skipping`);
    }
  }
  return transports;
}
