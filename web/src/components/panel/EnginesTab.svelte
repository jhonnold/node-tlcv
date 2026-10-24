<script lang="ts">
  import EngineCard from '../EngineCard.svelte';
  import { getGameStore } from '$lib/game.svelte';
  import { DASH } from '$lib/format';
  import type { EngineView } from '$lib/engines';
  import { EMPTY_PV } from '$lib/pv';

  type Props = { flipped: boolean };
  const { flipped }: Props = $props();
  const game = getGameStore();

  const top = $derived(flipped ? 'white' : 'black');
  const bottom = $derived(flipped ? 'black' : 'white');
  const hasKibitzer = $derived(!!game.game?.kibitzerLiveData || game.moves.some((m) => m.kibitzer));
  // Stays mounted once shown (U2 §5): the kibitzer card is never swapped for a different component.
  const emptyKibitzer = $derived<EngineView>({
    role: 'kibitzer',
    name: game.game?.kibitzerLiveData?.name ?? 'Kibitzer',
    status: '',
    scoreValue: null,
    score: DASH,
    depth: DASH,
    nodes: DASH,
    nps: DASH,
    time: DASH,
    pv: EMPTY_PV,
    pvFen: null,
  });
</script>

{#if game.engines}
  <div class="engines">
    <EngineCard engine={game.engines[top]} compact thumb={84} {flipped} />
    {#if hasKibitzer}
      <EngineCard engine={game.engines.kibitzer ?? emptyKibitzer} compact thumb={84} {flipped} />
    {/if}
    <EngineCard engine={game.engines[bottom]} compact thumb={84} {flipped} />
  </div>
{:else}
  <p class="empty">Waiting for game data…</p>
{/if}

<style>
  .engines {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
  }
  .empty {
    padding: 14px;
    color: var(--muted);
  }
</style>
