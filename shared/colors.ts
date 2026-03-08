import type { ColorCode } from './types.js';

export type ColorName = 'white' | 'black';

export function colorName(code: ColorCode): ColorName {
  return code === 'w' ? 'white' : 'black';
}
