/**
 * The single place this process reads its environment.
 *
 * Values resolve once, at import time — `main.ts` loads dotenv before anything
 * else in the graph — so every consumer sees the same view and the full set of
 * variables the server depends on is visible in one file.
 */
export const env = Object.freeze({
  /** HTTP + Socket.IO listen port. */
  port: Number(process.env.PORT) || 8080,
  /** Directory holding config.json. */
  configDir: process.env.CONFIG_DIR || 'config',
  /** Root of the on-disk PGN/meta archive (see services/pgn-storage.ts). */
  pgnsDir: process.env.PGNS_DIR || 'pgns',
  /** Base URL this deployment is reachable at; used for outbound webhook links. */
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'https://ccrl.live',
  /** Admin panel basic-auth password. */
  adminPassword: process.env.TLCV_PASSWORD ?? '',
  /** Optional token lifting Lichess API rate limits. */
  lichessToken: process.env.LICHESS_OAUTH_TOKEN,
  /** Winston console level. */
  logLevel: process.env.LOG_LEVEL || 'info',
});
