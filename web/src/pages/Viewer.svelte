<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import { getJson, HttpError } from '$lib/http';
  import { navigate } from '$lib/router.svelte';
  import { apiBase } from '$lib/url';
  import type { ViewerSource } from '$lib/url';
  import { GameStore, setGameStore } from '$lib/game.svelte';
  import { loadLatestReplay } from '$lib/replay';
  import { setPreset, theme } from '$lib/theme/theme.svelte';
  import { TournamentStore, setTournament } from '$lib/tournament.svelte';
  import { sound, toggleSound } from '$lib/sounds.svelte';
  import type { ArchiveInfo, BroadcastSummary } from '$shared/types';
  import StubHeader from '../components/StubHeader.svelte';
  import Board from '../components/Board.svelte';
  import EngineCard from '../components/EngineCard.svelte';
  import EvalBar from '../components/EvalBar.svelte';
  import PlayerBar from '../components/PlayerBar.svelte';
  import Panel, { type PanelTabs, type TabId } from '../components/panel/Panel.svelte';

  const { source }: { source: ViewerSource } = $props();
  let site = $state('');

  const game = new GameStore();
  setGameStore(game);
  const tournament = new TournamentStore(untrack(() => source));
  setTournament(tournament);
  // Harness-only: ?tabs=all|noMoves|movesOnly|mobile  &tab=<TabId>  &h=<css height>
  const q = new URLSearchParams(location.search);
  const PANEL_SETS: PanelTabs[] = ['all', 'noMoves', 'movesOnly', 'mobile'];
  const panelTabs: PanelTabs = PANEL_SETS.find((t) => t === q.get('tabs')) ?? 'all';
  const panelTab = (q.get('tab') ?? undefined) as TabId | undefined;
  const panelHeight = q.get('h') ?? (panelTabs === 'mobile' ? 'auto' : '760px');

  let flipped = $state(false);
  let colWidth = $state(0);
  const boardSize = $derived(Math.min(560, colWidth - 20));
  const top = $derived(flipped ? 'white' : 'black');
  const bottom = $derived(flipped ? 'black' : 'white');

  // Mount/unmount a Board repeatedly; the check script compares jQuery handler counts around it.
  let churnOn = $state(false);
  let churnRuns = $state(0);
  async function churn(): Promise<void> {
    for (let i = 0; i < 20; i += 1) {
      churnOn = true;
      await tick();
      churnOn = false;
      await tick();
    }
    churnRuns += 1;
  }

  onMount(() => {
    const ac = new AbortController();
    let disconnect: () => void = () => {};
    getJson<BroadcastSummary | ArchiveInfo>(apiBase(source), ac.signal)
      .then((info) => {
        if (ac.signal.aborted) return; // no socket may be created after unmount
        site = info.site;
        document.title = info.site ? `${info.site} - CCRL Live` : 'CCRL Live';
        if (source.kind === 'live') {
          disconnect = game.connect(source.port);
        } else {
          // Its own catch: a failed game fetch leaves the page up, and only the summary 404 goes home.
          loadLatestReplay(source, ac.signal)
            .then((r) => r && game.loadReplay(r.meta, r.gameNumber))
            .catch(() => {
              // Load failure or abort: the page stays as it is.
            });
        }
      })
      .catch((e: unknown) => {
        if ((e as Error).name === 'AbortError') return;
        // Client-side navigation skips the server's page guards, so a missing source goes home here.
        if (e instanceof HttpError && e.status === 404) navigate('/', { replace: true });
      });
    return () => {
      ac.abort();
      disconnect();
      tournament.dispose();
    };
  });
</script>

<svelte:window onkeydown={game.onKeydown} />
<StubHeader title={source.kind === 'live' ? `Live · ${source.port}` : `Archive · ${source.slug}`} />

<main class="harness">
  <p class="meta">
    {site} · {game.isReplay ? 'replay' : game.connected ? 'connected' : 'offline'} · ply {game.index}/{game.length}
  </p>
  <button type="button" onclick={() => setPreset(theme.base === 'dark' ? 'light' : 'dark')}>Toggle theme</button>
  <section class="panel-col">
    <Panel
      {source}
      tabs={panelTabs}
      initialTab={panelTab}
      height={panelHeight}
      {flipped}
      bordered={panelTabs !== 'mobile'}
    />
  </section>
  {#if game.engines && game.players}
    <section class="engines">
      <EngineCard engine={game.engines[top]} thumb={80} {flipped} />
      {#if game.engines.kibitzer}
        <EngineCard engine={game.engines.kibitzer} thumb={80} {flipped} />
      {/if}
      <EngineCard engine={game.engines[bottom]} thumb={80} {flipped} />
    </section>
    <section class="board-col" bind:clientWidth={colWidth}>
      <PlayerBar side={top} {...game.players[top]} />
      <div class="board-row">
        <EvalBar score={game.evalScore} {flipped} />
        {#if boardSize > 0}
          <Board
            fen={game.fen}
            size={boardSize}
            {flipped}
            lastMove={game.lastMove}
            arrows={game.arrows}
            label="Main board"
          />
        {/if}
      </div>
      <PlayerBar side={bottom} {...game.players[bottom]} />
      <div class="nav">
        <button type="button" onclick={game.first}>First</button>
        <button type="button" onclick={game.prev}>Prev</button>
        <button type="button" onclick={game.next}>Next</button>
        <button type="button" onclick={game.latest}>Latest</button>
        <span class="label">{game.label}</span>
        <button type="button" onclick={() => (flipped = !flipped)}>Flip</button>
        <button type="button" onclick={toggleSound}>Sound: {sound.enabled ? 'on' : 'off'}</button>
      </div>

      <h2>Compact variants</h2>
      <PlayerBar side="white" {...game.players.white} compact showScore />
      <EvalBar orientation="horizontal" thickness={6} bordered={false} score={game.evalScore} />
      <PlayerBar side="black" {...game.players.black} compact showScore />
      <EngineCard engine={game.engines.white} compact />
      <EngineCard engine={game.engines.black} compact />
      <Board fen={game.fen} size={152} coords={false} label="Mini board" />
      <div class="nav">
        <button type="button" onclick={churn}>Churn</button>
        <span class="churn">{churnRuns}</span>
      </div>
      {#if churnOn}
        <Board fen={game.fen} size={120} coords={false} label="Churn board" />
      {/if}
    </section>
  {/if}
</main>

<style>
  .harness {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    padding: 20px;
  }
  .meta {
    flex-basis: 100%;
    color: var(--muted);
    font-family: var(--fontMono);
  }
  .engines {
    width: 340px;
    max-width: 100%;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .panel-col {
    width: 440px;
    max-width: 100%;
  }
  .board-col {
    flex: 1;
    min-width: 0;
    max-width: 600px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .board-row {
    display: flex;
    gap: 8px;
  }
  .nav {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
  }
  .label {
    flex: 1;
    font-family: var(--fontMono);
    color: var(--muted);
  }
</style>
