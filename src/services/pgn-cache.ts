import { FileCache } from './file-cache.js';

const pgnCache = new FileCache(/^(\d+)_.+\.pgn$/i);

export const loadAll = pgnCache.loadAll.bind(pgnCache);
export const getFiles = pgnCache.getFiles.bind(pgnCache);
export const addFile = pgnCache.addFile.bind(pgnCache);
export const invalidate = pgnCache.invalidate.bind(pgnCache);
