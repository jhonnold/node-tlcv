import { logger } from '../util/index.js';
import { LocalTransport } from './local-transport.js';
import { SshTransport } from './ssh-transport.js';
import type { KibitzerConfig, KibitzerTransport } from './types.js';

export function createTransport(config: KibitzerConfig): KibitzerTransport {
  switch (config.type) {
    case 'local':
      logger.info(`Kibitzer: creating LocalTransport (priority ${config.priority})`);
      return new LocalTransport(config);
    case 'ssh':
      logger.info(`Kibitzer: creating SshTransport for ${config.host} (priority ${config.priority})`);
      return new SshTransport(config);
    default:
      throw new Error(`Kibitzer: unknown transport type "${(config as KibitzerConfig).type}"`);
  }
}
