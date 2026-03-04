import dns from 'dns';
import broadcasts, { Broadcast } from '../broadcast.js';
import configStore from '../config/config-store.js';

const lookup = (hostname: string): Promise<string> =>
  new Promise((resolve, reject) => dns.lookup(hostname, (err, addr) => (err ? reject(err) : resolve(addr))));

export async function connect(): Promise<void> {
  const connections = await configStore.getConnections();

  for (const c of connections) {
    const [url, port] = c.split(':');
    const ip = await lookup(url);

    broadcasts.set(+port, new Broadcast(url, ip, +port));
  }
}

export async function newConnection(connection: string): Promise<void> {
  const [url, port] = connection.split(':');
  const ip = await lookup(url);

  if (broadcasts.has(+port)) throw Error('Port already in use!');

  broadcasts.set(+port, new Broadcast(url, ip, +port));
  await configStore.addConnection(connection);
}

export async function closeConnection(connection: string): Promise<void> {
  const [, port] = connection.split(':');
  const broadcast = broadcasts.get(+port);
  if (!broadcast) throw Error('Invalid port!');
  broadcast.close();
  broadcasts.delete(+port);

  await configStore.removeConnection(connection);
}
