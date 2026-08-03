import dns from 'dns';
import broadcasts, { Broadcast } from './broadcast.js';
import configStore from './config/config-store.js';
import { invalidateListingCache } from './services/tournament-results.js';
import type { KibitzerManager } from './kibitzer/kibitzer-manager.js';
import type { WebhookManager } from './webhooks/webhook-manager.js';

const lookup = (hostname: string): Promise<string> =>
  new Promise((resolve, reject) => dns.lookup(hostname, (err, addr) => (err ? reject(err) : resolve(addr))));

/**
 * Decodes the "host:port" form used by config entries and the admin panel — the
 * inverse of `Broadcast.connection`. Throws rather than letting a malformed entry
 * become a `NaN` key in the broadcasts map.
 */
function parseConnection(connection: string): { host: string; port: number } {
  const [host, portToken] = connection.split(':');
  const port = Number(portToken);

  if (!host || !Number.isInteger(port) || port <= 0) throw Error(`Invalid connection "${connection}"!`);

  return { host, port };
}

let _kibitzerManager: KibitzerManager | null = null;

export function setKibitzerManager(manager: KibitzerManager): void {
  _kibitzerManager = manager;
}

export function getKibitzerManager(): KibitzerManager | null {
  return _kibitzerManager;
}

let _webhookManager: WebhookManager | null = null;

export function setWebhookManager(manager: WebhookManager): void {
  _webhookManager = manager;
}

export function getWebhookManager(): WebhookManager | null {
  return _webhookManager;
}

export async function connect(): Promise<void> {
  const connections = await configStore.getConnections();
  // Seed the admin autocomplete: boot connections never pass through addConnection().
  await configStore.recordConnectionHistory(connections.map((c) => c.connection));

  for (const { connection, ephemeral } of connections) {
    const { host, port } = parseConnection(connection);
    const ip = await lookup(host);

    broadcasts.set(port, new Broadcast(host, ip, port, _kibitzerManager ?? undefined, ephemeral));
  }
}

export async function newConnection(connection: string, ephemeral = false): Promise<void> {
  const { host, port } = parseConnection(connection);
  const ip = await lookup(host);

  if (broadcasts.has(port)) throw Error('Port already in use!');

  broadcasts.set(port, new Broadcast(host, ip, port, _kibitzerManager ?? undefined, ephemeral));
  await configStore.addConnection(connection, ephemeral);
}

export async function closeConnection(connection: string): Promise<void> {
  const { port } = parseConnection(connection);

  const broadcast = broadcasts.get(port);
  if (!broadcast) throw Error('Invalid port!');
  broadcast.close();
  broadcasts.delete(port);

  // The closed broadcast's tournament drops out of the live set and should now appear
  // in the homepage "Previous Broadcasts" listing with its final stats — re-scan once.
  invalidateListingCache();

  await configStore.removeConnection(connection);
}
