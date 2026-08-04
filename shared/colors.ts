import type { ColorCode } from './types.js';

export type ColorName = 'white' | 'black';

export function colorName(code: ColorCode): ColorName {
  return code === 'w' ? 'white' : 'black';
}

export function colorCode(name: ColorName): ColorCode {
  return name === 'white' ? 'w' : 'b';
}

export function otherColor(code: ColorCode): ColorCode {
  return code === 'w' ? 'b' : 'w';
}
