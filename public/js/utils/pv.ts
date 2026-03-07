import type { SerializedLiveData } from '../../../shared/types';

export function formatPv(pv: string[] | null, pvMoveNumber: number, color: string) {
  if (!pv || !pv.length) return '';

  const printOn = color === 'white' ? 0 : 1;

  return pv.reduce(
    (h: string, move: string, idx: number) =>
      `${h}${
        idx % 2 === printOn ? `<strong>${pvMoveNumber + Math.floor((idx + printOn) / 2)}</strong>. ` : ''
      }${move} `,
    color === 'white' ? '' : `<strong>${pvMoveNumber}...</strong> `,
  );
}

export default function pvString(liveData: SerializedLiveData, color: string) {
  return formatPv(liveData.pv, liveData.pvMoveNumber, color);
}
