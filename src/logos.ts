import fs from 'fs';
import path from 'path';
import { logger } from './util/index.js';

const logos_dir = path.resolve('logos');

export type Logo = {
  contentType: string;
  data: Buffer;
};

const contentTypes = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.bmp': 'image/bmp',
};

export function getLogo(engine: string): Logo | null {
  const logos = fs.readdirSync(logos_dir);

  logger.debug(`Searching ${logos.length} logos for ${engine}`);

  const logo = logos.find((logo: string) => {
    return engine.toLowerCase().startsWith(path.basename(logo).toLowerCase().split('.')[0]);
  });

  if (!logo) {
    logger.warn(`No logo found for ${engine}`);
    return null;
  }

  let ext = path.extname(logo);
  let contentType = ext in contentTypes ? contentTypes[ext as keyof typeof contentTypes] : '';

  return {
    contentType,
    data: fs.readFileSync(path.resolve(logos_dir, logo)),
  };
}

export default getLogo;
