<script lang="ts">
  import { onMount } from 'svelte';
  import { getJson } from '$lib/http';
  import { copyFen } from '$lib/fen'; // generic clipboard helper (Clipboard API + execCommand fallback)
  import type { AdminBroadcast, KibitzerStatus, WebhookStatus } from '$shared/types';
  import SiteHeader from '../components/SiteHeader.svelte';
  import BroadcastsSection from '../components/admin/BroadcastsSection.svelte';
  import KibitzersSection from '../components/admin/KibitzersSection.svelte';
  import WebhooksSection from '../components/admin/WebhooksSection.svelte';
  import { describeError, type Mutate } from '../components/admin/forms';
  import '../components/admin/admin.css';

  let broadcasts = $state<AdminBroadcast[]>([]);
  let kibitzers = $state<KibitzerStatus[]>([]);
  let webhooks = $state<WebhookStatus[]>([]);
  let history = $state<string[]>([]);
  let loaded = $state(false);
  let busy = $state(false);
  let error = $state<string | null>(null);
  let active = $state(location.hash.slice(1) || 'broadcasts');
  let copied = $state(false);
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  const metricsUrl = `${location.origin}/admin/metrics`;

  async function refresh(): Promise<void> {
    const [b, k, w, h] = await Promise.all([
      getJson<AdminBroadcast[]>('/admin/broadcasts'),
      getJson<KibitzerStatus[]>('/admin/kibitzers'),
      getJson<WebhookStatus[]>('/admin/webhooks'),
      getJson<string[]>('/admin/connection-history'),
    ]);
    broadcasts = b;
    kibitzers = k;
    webhooks = w;
    history = h;
    loaded = true;
  }
  // One mutation at a time; always refetch afterwards (even on failure: a delete-then-add edit may be half done).
  const mutate: Mutate = async (label, action) => {
    if (busy) return false;
    busy = true;
    error = null;
    let ok = true;
    try {
      await action();
    } catch (e) {
      ok = false;
      error = describeError(label, e);
    }
    try {
      await refresh();
    } catch (e) {
      error ??= describeError('Refreshing the lists', e);
    }
    busy = false;
    return ok;
  };
  async function copyMetrics(): Promise<void> {
    if (!(await copyFen(metricsUrl))) return;
    copied = true;
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => (copied = false), 1500);
  }
  const nav = $derived([
    { id: 'broadcasts', label: 'Broadcasts', count: broadcasts.length },
    { id: 'kibitzers', label: 'Kibitzers', count: kibitzers.length },
    { id: 'webhooks', label: 'Webhooks', count: webhooks.length },
    { id: 'metrics', label: 'Metrics', count: null },
  ]);
  onMount(() => {
    document.title = 'Admin Panel - CCRL Live';
    refresh().catch((e) => (error = describeError('Loading the admin data', e)));
    return () => clearTimeout(copyTimer);
  });
</script>

<SiteHeader badge="ADMIN"><span class="who">Signed in as admin</span></SiteHeader>

<div class="admin-page">
  <div class="layout">
    <nav aria-label="Admin sections">
      {#each nav as n (n.id)}
        <a
          href="#{n.id}"
          class:active={active === n.id}
          aria-current={active === n.id ? 'true' : undefined}
          onclick={() => (active = n.id)}
          >{n.label}{#if n.count != null}<span class="count">{n.count}</span>{/if}</a
        >
      {/each}
    </nav>
    <main>
      <h1>Admin</h1>
      {#if error}
        <div class="alert" role="alert">
          <span>{error}</span>
          <button type="button" class="btn" onclick={() => (error = null)}>Dismiss</button>
        </div>
      {/if}
      {#if loaded}
        <BroadcastsSection items={broadcasts} {history} {busy} {mutate} />
        <KibitzersSection items={kibitzers} {busy} {mutate} />
        <WebhooksSection items={webhooks} {busy} {mutate} />
        <section id="metrics" class="card metrics" aria-labelledby="metrics-h">
          <div>
            <h2 id="metrics-h">Metrics</h2>
            <p>Prometheus scrape endpoint, behind the same basic auth.</p>
          </div>
          <code>GET /admin/metrics</code>
          <button type="button" class="btn" onclick={copyMetrics}>{copied ? 'Copied' : 'Copy URL'}</button>
        </section>
      {/if}
    </main>
  </div>
</div>

<style>
  .who {
    font-size: 13px;
    color: var(--muted);
  }
  @media (max-width: 479px) {
    .who {
      display: none;
    }
  }
</style>
