<script lang="ts">
  import { getGameStore } from '$lib/game.svelte';
  import { copyFen } from '$lib/fen';
  import { onDestroy } from 'svelte';
  import type { ViewerSource } from '$lib/url';
  import { apiBase } from '$lib/url';
  import { DASH } from '$lib/format';

  type Props = { source: ViewerSource };
  const { source }: Props = $props();
  const game = getGameStore();

  const MENU_ORDER: Array<[string, string]> = [
    ['schedule', 'Schedule'],
    ['even', 'Event thread'], // onMenu splits on whitespace, so NAME="Event thread" becomes the key `even` (game-service.ts:514-535)
    ['event', 'Event'],
  ];
  const KNOWN = new Set(MENU_ORDER.map(([k]) => k));
  const isUrl = (v: string | undefined): v is string => /^https?:\/\//i.test(v ?? '');
  const links = $derived.by(() => {
    const menu = game.live?.menu ?? {};
    const out: { label: string; href: string }[] = [{ label: 'PGN archive', href: '/pgns' }];
    if (source.kind === 'live') out.push({ label: 'Current game PGN', href: `${apiBase(source)}/pgn` });
    for (const [key, label] of MENU_ORDER) if (isUrl(menu[key])) out.push({ label, href: menu[key] });
    for (const key of Object.keys(menu).sort()) {
      if (!KNOWN.has(key) && isUrl(menu[key]))
        out.push({ label: key.charAt(0).toUpperCase() + key.slice(1), href: menu[key] });
    }
    return out;
  });
  const keys = [
    ['←', 'Previous move'],
    ['→', 'Next move'],
    ['↑', 'Start position'],
    ['↓', 'Latest position'],
    ['Esc', 'Leave focus mode'],
  ];

  let copied = $state(false);
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => clearTimeout(copiedTimer));
  async function copy(): Promise<void> {
    if (!(await copyFen(game.fen))) return;
    copied = true;
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => (copied = false), 1500);
  }
</script>

<div class="info">
  <section class="block">
    <h3>Links</h3>
    {#each links as lk (lk.label)}
      <a class="link" href={lk.href} target="_blank" rel="noopener noreferrer">
        {lk.label}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          ><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg
        >
      </a>
    {/each}
  </section>
  <section class="block">
    <h3>Position</h3>
    <dl class="grid">
      <dt>Opening</dt>
      <dd>{game.game?.opening || DASH}</dd>
      <dt>Tablebase</dt>
      <dd class="muted">{game.game?.tablebase || DASH}</dd>
      <dt>FEN</dt>
      <dd class="fen-row">
        <code class="fen">{game.fen}</code>
        <button type="button" class="copy" onclick={copy}>{copied ? 'Copied' : 'Copy'}</button>
      </dd>
    </dl>
  </section>
  <section class="block">
    <h3>Keyboard</h3>
    <dl class="grid">
      {#each keys as [k, v] (k)}
        <dt><kbd>{k}</kbd></dt>
        <dd class="muted">{v}</dd>
      {/each}
    </dl>
  </section>
  <p class="credits">
    Pieces by <a href="https://en.wikipedia.org/wiki/User:Cburnett" target="_blank" rel="noopener noreferrer"
      >Cburnett</a
    >
    and
    <a href="https://www.chessprogramming.org/Martin_Sedlak" target="_blank" rel="noopener noreferrer">Martin Sedlák</a
    >. Broadcasts by
    <a href="https://computerchess.org.uk/ccrl/4040/" target="_blank" rel="noopener noreferrer">CCRL</a>. Built on
    <a href="https://chessboardjs.com/" target="_blank" rel="noopener noreferrer">chessboard.js</a>. Questions or ideas?
    <a href="https://github.com/jhonnold/node-tlcv/issues" target="_blank" rel="noopener noreferrer"
      >Open an issue on GitHub</a
    >.
  </p>
</div>

<style>
  .info {
    display: flex;
    flex-direction: column;
    gap: 22px;
    padding: 16px 14px;
  }
  .block {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  h3 {
    margin: 0;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .link {
    min-height: var(--pCtlH);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    border: 1px solid var(--line);
    color: var(--text);
    font-size: 14px;
    font-weight: 500;
    text-decoration: none;
  }
  .grid {
    margin: 0;
    display: grid;
    grid-template-columns: 96px minmax(0, 1fr);
    gap: 8px 12px;
    font-size: 13px;
  }
  dd {
    margin: 0;
  }
  .muted {
    color: var(--muted);
  }
  .fen-row {
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }
  .fen {
    flex: 1;
    min-width: 0;
    font-family: var(--fontMono);
    font-size: 12px;
    line-height: 1.5;
    word-break: break-all;
  }
  .copy {
    height: var(--pBtnH);
    padding: 0 10px;
    border: 1px solid var(--line);
    background: transparent;
    color: var(--text);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  kbd {
    display: inline-block;
    min-width: 20px;
    padding: 2px 6px;
    border: 1px solid var(--line);
    border-bottom-width: 2px;
    font-family: var(--fontMono);
    font-size: 12px;
    text-align: center;
  }
  .credits {
    font-size: 12px;
    line-height: 1.6;
    color: var(--muted);
  }
  .credits a {
    color: var(--link);
  }
</style>
