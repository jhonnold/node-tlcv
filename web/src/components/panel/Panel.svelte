<script module lang="ts">
  export type TabId = 'engines' | 'moves' | 'chat' | 'graphs' | 'standings' | 'games' | 'info';
  export type PanelTabs = 'all' | 'noMoves' | 'movesOnly' | 'mobile';
</script>

<script lang="ts">
  import { getGameStore } from '$lib/game.svelte';
  import { getTournament } from '$lib/tournament.svelte';
  import type { ViewerSource } from '$lib/url';
  import ChatTab from './ChatTab.svelte';
  import EnginesTab from './EnginesTab.svelte';
  import GraphsTab from './GraphsTab.svelte';
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
  const tournament = getTournament();
  const SETS: Record<PanelTabs, TabId[]> = {
    mobile: ['engines', 'moves', 'chat', 'graphs', 'standings', 'games', 'info'],
    noMoves: ['chat', 'graphs', 'standings', 'games', 'info'],
    movesOnly: ['moves'],
    all: ['moves', 'chat', 'graphs', 'standings', 'games', 'info'],
  };
  const LABEL: Record<TabId, string> = {
    engines: 'Engines',
    moves: 'Moves',
    chat: 'Chat',
    graphs: 'Graphs',
    standings: 'Standings',
    games: 'Games',
    info: 'Info',
  };
  // Chat is hidden on archives and during any replay (decision 4, decision 5).
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

  // A new live game: refresh standings and games once the CT dump has landed.
  let prevPair = '';
  let prevLen = -1;
  $effect(() => {
    const g = game.live?.game;
    if (!g) return;
    const pair = `${g.white.name}|${g.black.name}`;
    if (prevLen >= 0 && (pair !== prevPair || g.moves.length < prevLen)) tournament.refreshSoon();
    prevPair = pair;
    prevLen = g.moves.length;
  });
</script>

<section class="panel" class:mobile={tabs === 'mobile'} class:bordered aria-label="Game panels" style:height>
  {#if tabs === 'movesOnly'}
    <div class="title"><h2>Moves</h2></div>
  {:else}
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
    <ReplayBanner {source} />
  {/if}
  <div
    class="body"
    id="{uid}-body"
    role="tabpanel"
    aria-label={tabs === 'movesOnly' ? 'Moves' : undefined}
    aria-labelledby={tabs === 'movesOnly' ? undefined : `${uid}-tab-${active}`}
    bind:this={body}
  >
    {#if active === 'engines'}<EnginesTab {flipped} />
    {:else if active === 'moves'}<MovesTab {source} scroller={body} />
    {:else if active === 'chat'}<ChatTab scroller={body} />
    {:else if active === 'graphs'}<GraphsTab />
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
  }
  .panel.bordered {
    border: 1px solid var(--line);
  }
  .title {
    flex-shrink: 0;
    height: 46px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    padding: 0 14px;
    border-bottom: 1px solid var(--line);
  }
  .title h2 {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
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
    padding: 0 12px;
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
