import { logger } from '../util/index.js';
import { createSender } from './sender-factory.js';
import type { WebhookConfig, WebhookEvent, WebhookEventKind, WebhookSender } from './types.js';

interface WebhookEntry {
  id: string;
  config: WebhookConfig;
  sender: WebhookSender;
}

export interface WebhookStatus {
  id: string;
  type: string;
  name: string;
  url: string;
  ports: number[];
  events: WebhookEventKind[];
}

/**
 * Owns the configured outbound webhooks. Unlike KibitzerManager there are no
 * timers or polling — webhooks are purely event-driven, so construction alone
 * makes the manager ready. `dispatch()` is fire-and-forget and never throws.
 */
export class WebhookManager {
  private entries: WebhookEntry[] = [];

  constructor(configs: WebhookConfig[]) {
    for (const config of configs) {
      try {
        this.entries.push({ id: config.id, config, sender: createSender(config) });
      } catch (e) {
        logger.warn(`WebhookManager: failed to create sender ${config.id}: ${e}`);
      }
    }
  }

  addWebhook(config: WebhookConfig): void {
    this.entries.push({ id: config.id, config, sender: createSender(config) });
    logger.info(`WebhookManager: added webhook ${config.id} (${config.type})`);
  }

  removeWebhook(id: string): void {
    const idx = this.entries.findIndex((e) => e.id === id);
    if (idx === -1) return;

    this.entries.splice(idx, 1);
    logger.info(`WebhookManager: removed webhook ${id}`);
  }

  getStatus(): WebhookStatus[] {
    return this.entries.map((e) => ({
      id: e.id,
      type: e.config.type,
      name: e.config.name ?? '',
      url: e.config.url,
      ports: e.config.ports ?? [],
      events: e.config.events ?? ['game-started', 'game-finished'],
    }));
  }

  // Fire-and-forget. Never throws, never meant to be awaited by the caller.
  dispatch(event: WebhookEvent): void {
    for (const { config, sender } of this.entries) {
      // Port filter: empty/unset => all ports.
      if (config.ports && config.ports.length > 0 && !config.ports.includes(event.port)) continue;
      // Event filter: empty/unset => both events.
      if (config.events && config.events.length > 0 && !config.events.includes(event.kind)) continue;

      // Intentionally not awaited — the sender swallows its own errors.
      sender.send(event, config.url);
    }
  }
}
