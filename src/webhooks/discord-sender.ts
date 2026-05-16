import { logger } from '../util/index.js';
import type { WebhookEvent, WebhookSender } from './types.js';

const PUBLIC_BASE = 'https://ccrl.live';

const COLOR_STARTED = 0x4caf50; // green
const COLOR_FINISHED = 0x2196f3; // blue

type DiscordEmbed = {
  title: string;
  url: string;
  description: string;
  color: number;
  fields: Array<{ name: string; value: string; inline?: boolean }>;
  timestamp: string;
};

/**
 * Formats webhook events as Discord embeds and POSTs them to a Discord
 * incoming-webhook URL. The full PGN is intentionally omitted — it can blow
 * past Discord's 1024-char field / 6000-char embed limits — so the embed
 * links to the live broadcast instead.
 */
export class DiscordSender implements WebhookSender {
  type(): string {
    return 'discord';
  }

  async send(event: WebhookEvent, url: string): Promise<void> {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [this.buildEmbed(event)] }),
      });
      if (!res.ok) {
        logger.warn(
          `Webhook(discord): POST failed ${res.status} ${res.statusText} for game ${event.gameNumber} on port ${event.port}`,
        );
      }
    } catch (err) {
      logger.error(`Webhook(discord): network error for port ${event.port}: ${err}`);
    }
  }

  private buildEmbed(event: WebhookEvent): DiscordEmbed {
    const broadcastUrl = `${PUBLIC_BASE}/${event.port}`;
    const matchup = `${event.white} vs ${event.black}`;
    const link = `[ccrl.live/${event.port}](${broadcastUrl})`;

    if (event.kind === 'game-started') {
      return {
        title: `♟ Game ${event.gameNumber} started`,
        url: broadcastUrl,
        description: `**${matchup}**`,
        color: COLOR_STARTED,
        fields: [
          { name: 'Event', value: event.site || 'Unknown', inline: true },
          { name: 'Watch live', value: link, inline: true },
        ],
        timestamp: new Date().toISOString(),
      };
    }

    return {
      title: `♟ Game ${event.gameNumber} finished — ${event.result}`,
      url: broadcastUrl,
      description: `**${matchup}**`,
      color: COLOR_FINISHED,
      fields: [
        { name: 'Result', value: event.result || '*', inline: true },
        { name: 'Event', value: event.site || 'Unknown', inline: true },
        { name: 'Opening', value: event.opening || 'Unknown', inline: false },
        { name: 'Watch / replay', value: link, inline: false },
      ],
      timestamp: new Date().toISOString(),
    };
  }
}
