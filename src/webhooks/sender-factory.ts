import { logger } from '../util/index.js';
import { DiscordSender } from './discord-sender.js';
import type { WebhookConfig, WebhookSender } from './types.js';

export function createSender(config: WebhookConfig): WebhookSender {
  switch (config.type) {
    case 'discord':
      logger.info(`Webhook: creating DiscordSender (${config.id})`);
      return new DiscordSender();
    default:
      throw new Error(`Webhook: unknown sender type "${(config as WebhookConfig).type}"`);
  }
}
