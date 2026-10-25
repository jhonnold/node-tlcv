<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import { getJson, HttpError } from '$lib/http';
  import { navigate } from '$lib/router.svelte';
  import { apiBase } from '$lib/url';
  import type { ViewerSource } from '$lib/url';
  import { GameStore, setGameStore } from '$lib/game.svelte';
  import { loadLatestReplay } from '$lib/replay';
  import { TournamentStore, setTournament } from '$lib/tournament.svelte';
  import { ViewState, setView } from '$lib/view.svelte';
  import type { HeaderInfo } from '$lib/view.svelte';
  import type { ArchiveInfo, BroadcastSummary, LobbyBroadcast } from '$shared/types';
  import ThemeDrawer from '../components/ThemeDrawer.svelte';
  import Header from '../components/viewer/Header.svelte';
  import MobileHeader from '../components/viewer/MobileHeader.svelte';
  import DesktopLayout from '../components/viewer/DesktopLayout.svelte';
  import TabletLayout from '../components/viewer/TabletLayout.svelte';
  import MobileLayout from '../components/viewer/MobileLayout.svelte';
  import FocusView from '../components/viewer/FocusView.svelte';

  type Props = { source: ViewerSource };
  const { source }: Props = $props();

  const game = new GameStore();
  setGameStore(game);
  const view = new ViewState();
  setView(view);
  // App keys Viewer by pagePath(source), so the source never changes for an instance.
  const tournament = new TournamentStore(untrack(() => source));
  setTournament(tournament);
  let site = $state('');
  let others = $state(0);
  const bp = $derived(view.bp);
  const siteName = $derived(game.live?.game.site || site);
  const info = $derived<HeaderInfo>({
    site: siteName,
    game: game.isReplay ? game.replayNumber : tournament.currentGameNumber,
    archive: source.kind === 'archive' || game.isReplay,
    watching: game.live?.spectators.length ?? 0,
    others,
  });
  $effect(() => {
    document.title = siteName ? `${siteName} - CCRL Live` : 'CCRL Live';
  });
  // A new live game: refresh standings and games once the CT dump has landed. Lives here, not in Panel, so focus mode
  // (which unmounts Panel) still refreshes.
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
  // Leaving focus remounts the header: give focus back to its trigger (desktop/tablet button or the mobile ⋮).
  async function exitFocus(): Promise<void> {
    view.focus = false;
    await tick();
    document.querySelector<HTMLElement>('[aria-label="Focus mode"], [aria-label="More options"]')?.focus();
  }

  onMount(() => {
    const ac = new AbortController();
    let disconnect: () => void = () => {};
    getJson<BroadcastSummary | ArchiveInfo>(apiBase(source), ac.signal)
      .then((summary) => {
        if (ac.signal.aborted) return; // no socket may be created after unmount
        site = summary.site;
        if (source.kind === 'live') {
          disconnect = game.connect(source.port);
        } else {
          // Its own catch: a failed game fetch leaves the page up, and only the summary 404 goes home.
          const gen = game.beginReplay();
          loadLatestReplay(source, ac.signal)
            .then((r) => r && game.loadReplay(r.meta, r.gameNumber, gen))
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
    getJson<LobbyBroadcast[]>('/broadcasts', ac.signal)
      .then((list) => (others = list.filter((b) => source.kind !== 'live' || b.port !== source.port).length))
      .catch(() => {});
    return () => {
      ac.abort();
      disconnect();
      tournament.dispose();
    };
  });
</script>

<svelte:window onkeydown={game.onKeydown} />
{#if view.focus}
  <FocusView {info} onexit={() => void exitFocus()} />
{:else}
  <div class="viewer" class:fixed={bp === 'desktop' || bp === 'large'}>
    {#if bp === 'mobile'}
      <MobileHeader {info} />
      <MobileLayout {source} />
    {:else}
      <Header {bp} {info} />
      {#if bp === 'tablet'}
        <TabletLayout {source} />
      {:else}
        <DesktopLayout {source} large={bp === 'large'} />
      {/if}
    {/if}
  </div>
{/if}
<ThemeDrawer open={view.themeOpen} onclose={() => (view.themeOpen = false)} />

<style>
  .viewer {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
  }
  .viewer.fixed {
    height: 100dvh;
    overflow: hidden;
  }
</style>
