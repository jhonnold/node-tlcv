import dns from 'dns';
import broadcasts, { Broadcast } from '../broadcast';
import JsonDB from './jsondb';

const lookup = (hostname: string): Promise<string> =>
  new Promise((resolve, reject) => {
    dns.lookup(hostname, (err, addr) => {
      if (err) reject(err);
      else resolve(addr);
    });
  });

const dbPath = `${process.env.CONFIG_DIR || 'config'}/config.json`;
const db = new JsonDB(dbPath);

export async function connect(): Promise<void> {
  const connections = db.read<string[]>('connections') || [];
  console.log(connections);
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

  const connections = db.read<string[]>('connections') || [];
  db.update<string[]>('connections', [...new Set([...connections, connection])]);
}

export async function closeConnection(connection: string): Promise<void> {
  const [, port] = connection.split(':');
  const broadcast = broadcasts.get(+port);
  if (!broadcast) throw Error('Invalid port!');
  broadcast.close();
  broadcasts.delete(+port);

  const connections = db.read<string[]>('connections') || [];
  db.update<string[]>('connections', connections.filter((c) => c !== connection));
}
