<script lang="ts">
  import { getGameStore } from '$lib/game.svelte';
  import BoardRow from './BoardRow.svelte';

  const game = getGameStore();
</script>

<ul class="boards" aria-label="Boards">
  {#each game.live?.summaries ?? [] as s (s.board)}
    <li>
      <BoardRow summary={s} selected={s.board === game.live?.board} onpick={() => game.switchBoard(s.board)} />
    </li>
  {/each}
</ul>

<style>
  .boards {
    list-style: none;
    margin: 0;
    padding: 0;
  }
</style>
