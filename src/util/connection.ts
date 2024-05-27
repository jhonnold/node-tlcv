import dns from 'dns';
import fs from 'node:fs/promises';
import broadcasts, { Broadcast } from '../broadcast.js';

const lookup = (hostname: string): Promise<string> =>
  new Promise((resolve, reject) => dns.lookup(hostname, (err, addr) => (err ? reject(err) : resolve(addr))));

export async function connect(): Promise<void> {
  const configDir = process.env['CONFIG_DIR'] || 'config';
  const data = await fs.readFile(`${configDir}/config.json`, { encoding: 'utf8' });
  const config = JSON.parse(data) as { connections: string[] };

  for (const c of config.connections) {
    const [url, port] = c.split(':');
    const ip = await lookup(url);

    broadcasts.set(+port, new Broadcast(url, ip, +port));
  }
}

export async function newConnection(connection: string): Promise<void> {
  const configDir = process.env['CONFIG_DIR'] || 'config';
  const data = await fs.readFile(`${configDir}/config.json`, { encoding: 'utf8' });
  const config = JSON.parse(data) as { connections: string[] };

  const [url, port] = connection.split(':');
  const ip = await lookup(url);

  if (broadcasts.has(+port)) throw Error('Port already in use!');

  broadcasts.set(+port, new Broadcast(url, ip, +port));

  config.connections = [...new Set([...config.connections, connection])];
  await fs.writeFile(`${configDir}/config.json`, JSON.stringify(config), { encoding: 'utf8' });
}

export async function closeConnection(connection: string): Promise<void> {
  const configDir = process.env['CONFIG_DIR'] || 'config';
  const data = await fs.readFile(`${configDir}/config.json`, { encoding: 'utf8' });
  const config = JSON.parse(data) as { connections: string[] };

  const [_, port] = connection.split(':');
  const broadcast = broadcasts.get(+port);
  if (!broadcast) throw Error('Invalid port!');
  broadcast.close();
  broadcasts.delete(+port);

  config.connections = config.connections.filter((c) => c != connection);
  await fs.writeFile(`${configDir}/config.json`, JSON.stringify(config), { encoding: 'utf8' });
}
