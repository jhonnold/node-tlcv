export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Board-shaped placeholder for "no position to show" (PV boards, replay stubs). */
export const EMPTY_FEN = '8/8/8/8/8/8/8/8';

/** Copy a FEN to the clipboard. Resolves to whether the copy succeeded. */
export async function copyFen(fen: string): Promise<boolean> {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(fen);
      return true;
    } catch {
      // Clipboard API refused (permissions, insecure context): fall back to execCommand below.
    }
  }
  const ta = document.createElement('textarea');
  ta.value = fen;
  ta.readOnly = true;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.append(ta);
  ta.select();
  const ok = document.execCommand('copy');
  ta.remove();
  return ok;
}
