export type ViewerSource = { kind: 'live'; port: number; board: number } | { kind: 'archive'; slug: string };
export type Route = { name: 'lobby' } | { name: 'viewer'; source: ViewerSource } | { name: 'admin' };

const LIVE = /^\/(\d+)(?:\/(\d+))?\/?$/; // `/:port` (board 1) or `/:port/:board`
const ARCHIVE = /^\/archive\/([A-Za-z0-9_]+)\/?$/; // mirrors server SAFE_SLUG
const ADMIN = /^\/admin\/?$/;

export function parsePath(pathname: string): Route | null {
  if (pathname === '/') return { name: 'lobby' };
  const live = LIVE.exec(pathname);
  if (live) return { name: 'viewer', source: { kind: 'live', port: Number(live[1]), board: Number(live[2] ?? 1) } };
  const archive = ARCHIVE.exec(pathname);
  if (archive) return { name: 'viewer', source: { kind: 'archive', slug: archive[1] } };
  if (ADMIN.test(pathname)) return { name: 'admin' };
  return null;
}

/** Per broadcast, not per board: the tournament endpoints (games, results, summary). */
export const apiBase = (s: ViewerSource): string =>
  s.kind === 'live' ? `/broadcasts/${s.port}` : `/archives/${s.slug}`;
/** Board 1 is the bare `/:port` (canonical, and the only form before boards). */
export const pagePath = (s: ViewerSource): string => {
  if (s.kind === 'archive') return `/archive/${s.slug}`;
  return s.board === 1 ? `/${s.port}` : `/${s.port}/${s.board}`;
};
/** A live board's current game PGN; board 1 keeps the board-less URL. */
export const livePgnUrl = (s: { port: number; board: number }): string =>
  s.board === 1 ? `/broadcasts/${s.port}/pgn` : `/broadcasts/${s.port}/boards/${s.board}/pgn`;
