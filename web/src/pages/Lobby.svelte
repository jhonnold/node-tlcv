<script lang="ts">
  import { onMount } from 'svelte';
  import { getJson } from '$lib/http';
  import type { ArchiveSummary, LobbyBroadcast } from '$shared/types';
  import StubHeader from '../components/StubHeader.svelte';

  let live = $state<LobbyBroadcast[]>([]);
  let archives = $state<ArchiveSummary[]>([]);

  onMount(() => {
    document.title = 'CCRL Live';
    getJson<LobbyBroadcast[]>('/broadcasts')
      .then((d) => (live = d))
      .catch(() => {});
    getJson<ArchiveSummary[]>('/archives')
      .then((d) => (archives = d))
      .catch(() => {});
  });
</script>

<StubHeader title="Broadcasts" />

<ul>
  {#each live as b (b.port)}
    <li><a href="/{b.port}">{b.site || b.port}: {b.white} vs {b.black}</a></li>
  {/each}
</ul>
<ul>
  {#each archives as a (a.slug)}
    <li><a href="/archive/{a.slug}">{a.slug}</a></li>
  {/each}
</ul>
<a href="/admin">Admin</a>
