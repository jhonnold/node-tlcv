<script lang="ts">
  import { onMount } from 'svelte';
  import { getJson } from '$lib/http';
  import type { AdminBroadcast } from '$shared/types';
  import StubHeader from '../components/StubHeader.svelte';

  let list = $state<AdminBroadcast[]>([]);

  onMount(() => {
    document.title = 'Admin Panel - CCRL Live';
    getJson<AdminBroadcast[]>('/admin/broadcasts')
      .then((d) => (list = d))
      .catch(() => {});
  });
</script>

<StubHeader title="Admin" />
<main>{list.length} broadcasts</main>
