<script module lang="ts">
  export type TabId = 'engines' | 'moves' | 'chat' | 'graphs' | 'standings' | 'games' | 'info';
  export type PanelTabs = 'all' | 'mobile' | 'noChat' | 'chatFirst' | 'chatOnly';
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
    touch?: boolean; // 44 px touch targets ('mobile' implies it)
  };
  const {
    source,
    tabs,
    initialTab,
    height = '100%',
    bordered = true,
    flipped = false,
    touch = false,
  }: Props = $props();

  const game = getGameStore();
  const ALL: TabId[] = ['moves', 'chat', 'graphs', 'standings', 'games', 'info'];
  const NO_CHAT = ALL.filter((id) => id !== 'chat');
  const SETS: Record<PanelTabs, TabId[]> = {
    all: ALL,
    mobile: ['engines', ...ALL],
    noChat: NO_CHAT,
    chatFirst: ['chat', ...NO_CHAT],
    chatOnly: ['chat'],
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
  // Chat is hidden on archives and during any replay.
  const ids = $derived(SETS[tabs].filter((id) => id !== 'chat' || (source.kind === 'live' && !game.isReplay)));
  // chatOnly: a "Chat" header instead of a tab bar, no ReplayBanner (the noChat Panel beside it shows one),
  // and an empty state while chat is hidden (`ids` is empty, so `active` is undefined).
  const solo = $derived(tabs === 'chatOnly');
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

<section class="panel" class:touch={touch || tabs === 'mobile'} class:bordered aria-label="Game panels" style:height>
  {#if solo}
    <div class="solo"><h2 id="{uid}-solo">Chat</h2></div>
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
    <ReplayBanner {source} onBack={backToLive} />
  {/if}
  <div
    class="body"
    id="{uid}-body"
    role={solo ? 'region' : 'tabpanel'}
    aria-labelledby={solo ? `${uid}-solo` : `${uid}-tab-${active}`}
    bind:this={body}
  >
    {#if active === 'engines'}<EnginesTab {flipped} />
    {:else if active === 'moves'}<MovesTab {source} scroller={body} />
    {:else if active === 'chat'}<ChatTab scroller={body} />
    {:else if active === 'graphs'}<GraphsTab />
    {:else if active === 'standings'}<StandingsTab {source} />
    {:else if active === 'games'}<GamesTab {source} {busy} {err} onReplay={startReplay} onWatch={backToLive} />
    {:else if active === 'info'}<InfoTab {source} />
    {:else if solo}<p class="empty">
        {source.kind === 'archive'
          ? "Chat isn't available for archived games."
          : 'Chat returns when you go back to live.'}
      </p>{/if}
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
  .panel.touch {
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
  .solo {
    flex-shrink: 0;
    height: 46px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    padding: 0 14px;
    border-bottom: 1px solid var(--line);
  }
  .solo h2 {
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
  .empty {
    margin: 0;
    padding: 14px;
    font-size: 13px;
    color: var(--muted);
  }
</style>
