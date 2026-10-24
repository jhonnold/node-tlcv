<script lang="ts">
  import { onMount } from 'svelte';
  import { getJson, HttpError } from '$lib/http';
  import { navigate } from '$lib/router.svelte';
  import { apiBase } from '$lib/url';
  import type { ViewerSource } from '$lib/url';
  import type { ArchiveInfo, BroadcastSummary } from '$shared/types';
  import StubHeader from '../components/StubHeader.svelte';

  const { source }: { source: ViewerSource } = $props();
  let site = $state('');

  onMount(() => {
    getJson<BroadcastSummary | ArchiveInfo>(apiBase(source))
      .then((info) => {
        site = info.site;
        document.title = info.site ? `${info.site} - CCRL Live` : 'CCRL Live';
      })
      .catch((e: unknown) => {
        // Client-side navigation skips the server's page guards, so a missing source goes home here.
        if (e instanceof HttpError && e.status === 404) navigate('/', { replace: true });
      });
  });
</script>

<StubHeader title={source.kind === 'live' ? `Live · ${source.port}` : `Archive · ${source.slug}`} />
<main>{site}</main>
