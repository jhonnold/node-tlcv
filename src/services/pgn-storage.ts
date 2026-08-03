import fs from 'fs/promises';
import { mkdirp } from 'mkdirp';
import { env } from '../config/env.js';
import { logger } from '../util/index.js';

// Sole owner of the archive layout: every game's PGN and meta sidecar, plus the
// tournament roll-up, live in `<root>/<slug>/`. Readers, writers and the static
// mount in app.ts all go through here so the root stays configurable in one place.
export const PGNS_ROOT = env.pgnsDir;

export function pgnDir(slug: string): string {
  return `${PGNS_ROOT}/${slug}`;
}

export function pgnPath(slug: string, filename: string): string {
  return `${pgnDir(slug)}/${filename}`;
}

/** Public URL for an archived file — always `/pgns/...`, independent of the on-disk root. */
export function pgnUrl(slug: string, filename: string): string {
  return `/pgns/${slug}/${filename}`;
}

/**
 * Writes one file into a tournament's archive folder, creating the folder if
 * needed. Callers are fire-and-forget from the message loop, so failures are
 * logged and reported as `false` rather than thrown.
 */
export async function writeArchiveFile(
  slug: string,
  filename: string,
  contents: string,
  port: number | string,
): Promise<boolean> {
  const filepath = pgnPath(slug, filename);

  try {
    await mkdirp(pgnDir(slug));
    await fs.writeFile(filepath, contents);
    return true;
  } catch (error) {
    logger.error(`Unable to write to ${filepath}! - ${error}`, { port });
    return false;
  }
}
