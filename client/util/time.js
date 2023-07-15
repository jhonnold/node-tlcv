export function msToString(ms) {
  const s = Math.floor((ms / 1000) % 60);
  const m = Math.floor(ms / 1000 / 60);

  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
