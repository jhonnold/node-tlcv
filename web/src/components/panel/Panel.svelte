<script module lang="ts">
  export type TabId = 'engines' | 'moves' | 'chat' | 'graphs' | 'standings' | 'games' | 'info';
  export type PanelTabs = 'all' | 'mobile';
</script>

<script lang="ts">
  import { getGameStore } from '$lib/game.svelte';
  import { loadReplayGame } from '$lib/replay';
  import type { ViewerSource } from '$lib/url';
  import ChatTab from './ChatTab.svelte';
  import EnginesTab from './EnginesTab.svelte';
  import GamesTab from './GamesTab.svelte';
  import GraphsTab from './GraphsTab.svelte';
  import StandingsTab from './StandingsTab.svelte';
  import InfoTab from './InfoTab.svelte';
  import MovesTab from './MovesTab.svelte';
  import ReplayBanner from './ReplayBanner.svelte';

  type Props = {
    source: ViewerSource;
    tabs: PanelTabs;
    initialTab?: TabId;
    height?: string;
    bordered?: boolean;
    flipped?: boolean;
  };
  const { source, tabs, initialTab, height = '100%', bordered = true, flipped = false }: Props = $props();

  const game = getGameStore();
  const ALL: TabId[] = ['moves', 'chat', 'graphs', 'standings', 'games', 'info'];
  const SETS: Record<PanelTabs, TabId[]> = { all: ALL, mobile: ['engines', ...ALL] };
  const LABEL: Record<TabId, string> = {
    engines: 'Engines',
    moves: 'Moves',
    chat: 'Chat',
    graphs: 'Graphs',
    standings: 'Standings',
    games: 'Games',
    info: 'Info',
  };
  // Chat is hidden on archives and during any replay.
  const ids = $derived(SETS[tabs].filter((id) => id !== 'chat' || (source.kind === 'live' && !game.isReplay)));
  let picked = $state<TabId | null>(null);
  const active = $derived.by(() => {
    const order: (TabId | null | undefined)[] = [picked, initialTab, source.kind === 'archive' ? 'games' : null];
    for (const t of order) if (t && ids.includes(t)) return t;
    return ids[0];
  });
  let body = $state<HTMLElement>();
  const uid = $props.id();
  function pick(id: TabId): void {
    picked = id;
    if (body) body.scrollTop = 0; // before the DOM swap, so MovesTab's own auto-scroll wins
  }
  // Replays start and end here. The store's generation drops a load that a newer Replay or a Watch overtook.
  // Panel-local owner of busy/err: `mine` is the generation of this Panel's latest Replay.
  let mine = 0;
  let busy = $state<number | null>(null);
  let err = $state('');
  async function startReplay(n: number): Promise<void> {
    const gen = game.beginReplay();
    mine = gen;
    // busy disables the Replay button, which drops focus to BODY: remember whether the list had it.
    const hadFocus = body?.contains(document.activeElement) ?? false;
    busy = n;
    err = '';
    try {
      const meta = await loadReplayGame(source, n);
      if (!game.loadReplay(meta, n, gen)) return; // superseded: busy and err belong to the newer request
      // Only from Games, and focus stays on the moved-to tab.
      if (active === 'games') {
        pick('moves');
        if (hadFocus && document.activeElement === document.body) document.getElementById(`${uid}-tab-moves`)?.focus();
      }
    } catch {
      if (mine === gen && game.replayGen === gen) err = `Couldn't load game ${n}.`;
    } finally {
      if (mine === gen) busy = null;
    }
  }
  function backToLive(): void {
    game.exitReplay(); // bumps the generation, so a pending load can't apply
    mine = game.replayGen;
    busy = null;
    err = '';
  }
  // An exitReplay from outside Panel bumps the store's generation: a Replay pending here then ends at once.
  $effect(() => {
    if (busy !== null && game.replayGen !== mine) busy = null;
  });
</script>

<section class="panel" class:mobile={tabs === 'mobile'} class:bordered aria-label="Game panels" style:height>
  <div class="tabbar" role="tablist" aria-label="Panel tabs">
    {#each ids as id (id)}
      <button
        type="button"
        role="tab"
        id="{uid}-tab-{id}"
        aria-selected={id === active}
        aria-controls="{uid}-body"
        onclick={() => pick(id)}>{LABEL[id]}</button
      >
    {/each}
  </div>
  <ReplayBanner {source} onBack={backToLive} />
  <div class="body" id="{uid}-body" role="tabpanel" aria-labelledby="{uid}-tab-{active}" bind:this={body}>
    {#if active === 'engines'}<EnginesTab {flipped} />
    {:else if active === 'moves'}<MovesTab {source} scroller={body} />
    {:else if active === 'chat'}<ChatTab scroller={body} />
    {:else if active === 'graphs'}<GraphsTab />
    {:else if active === 'standings'}<StandingsTab {source} />
    {:else if active === 'games'}<GamesTab {source} {busy} {err} onReplay={startReplay} onWatch={backToLive} />
    {:else if active === 'info'}<InfoTab {source} />{/if}
  </div>
</section>

<style>
  .panel {
    --pTabH: 34px;
    --pSegH: 30px;
    --pCtlH: 36px;
    --pIconBtn: 32px;
    --pRowH: 40px;
    --pChartH: 220px;
    --pTabPad: 8px;
    width: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--surface);
    color: var(--text);
    font-family: var(--fontUi);
  }
  .panel.mobile {
    --pTabH: 44px;
    --pSegH: 40px;
    --pCtlH: 44px;
    --pIconBtn: 44px;
    --pRowH: 44px;
    --pChartH: 180px;
    --pTabPad: 12px;
  }
  .panel.bordered {
    border: 1px solid var(--line);
  }
  .tabbar {
    flex-shrink: 0;
    display: flex;
    gap: 2px;
    padding: 6px;
    border-bottom: 1px solid var(--line);
    overflow-x: auto;
  }
  .tabbar button {
    flex-shrink: 0;
    height: var(--pTabH);
    padding: 0 var(--pTabPad);
    border: 0;
    background: transparent;
    color: var(--muted);
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
  }
  .tabbar button[aria-selected='true'] {
    background: var(--tabSel);
    color: var(--text);
  }
  .body {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }
</style>
