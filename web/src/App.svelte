<script lang="ts">
  import { onMount } from 'svelte';
  import { router, startRouter } from '$lib/router.svelte';
  import { pagePath } from '$lib/url';
  import Lobby from './pages/Lobby.svelte';
  import Viewer from './pages/Viewer.svelte';
  import Admin from './pages/Admin.svelte';

  onMount(startRouter);
  const route = $derived(router.route);
</script>

{#if route.name === 'lobby'}
  <Lobby />
{:else if route.name === 'viewer'}
  {#key pagePath(route.source)}
    <Viewer source={route.source} />
  {/key}
{:else}
  <Admin />
{/if}
