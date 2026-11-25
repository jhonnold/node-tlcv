export type ViewerSource = { kind: 'live'; port: number } | { kind: 'archive'; slug: string };
export type Route = { name: 'lobby' } | { name: 'viewer'; source: ViewerSource } | { name: 'admin' };

const LIVE = /^\/(\d+)\/?$/; // `/:port` only; the server 301s `/:port/:board` to it
const ARCHIVE = /^\/archive\/([A-Za-z0-9_]+)\/?$/; // mirrors server SAFE_SLUG
const ADMIN = /^\/admin\/?$/;

export function parsePath(pathname: string): Route | null {
  if (pathname === '/') return { name: 'lobby' };
  const live = LIVE.exec(pathname);
  if (live) return { name: 'viewer', source: { kind: 'live', port: Number(live[1]) } };
  const archive = ARCHIVE.exec(pathname);
  if (archive) return { name: 'viewer', source: { kind: 'archive', slug: archive[1] } };
  if (ADMIN.test(pathname)) return { name: 'admin' };
  return null;
}

/** Per broadcast, not per board: the tournament endpoints (games, results, summary). */
export const apiBase = (s: ViewerSource): string =>
  s.kind === 'live' ? `/broadcasts/${s.port}` : `/archives/${s.slug}`;
/** A live broadcast is `/:port` whatever board is shown: the selected board is client state (`boardKey`), not URL. */
export const pagePath = (s: ViewerSource): string => {
  if (s.kind === 'archive') return `/archive/${s.slug}`;
  return `/${s.port}`;
};
/** A live board's current game PGN; board 1 keeps the board-less URL. */
export const livePgnUrl = (s: { port: number; board: number }): string =>
  s.board === 1 ? `/broadcasts/${s.port}/pgn` : `/broadcasts/${s.port}/boards/${s.board}/pgn`;
