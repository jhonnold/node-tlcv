<script lang="ts">
  import { onMount, tick } from 'svelte';
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
  const hashSection = () => location.hash.slice(1) || 'broadcasts';
  let active = $state(hashSection());
  let copied = $state(false);
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  const metricsUrl = `${location.origin}/admin/metrics`;

  // Each list loads on its own: a failing list keeps its old value and is reported, the rest still render.
  async function refresh(): Promise<string | null> {
    const [b, k, w, h] = await Promise.allSettled([
      getJson<AdminBroadcast[]>('/admin/broadcasts'),
      getJson<KibitzerStatus[]>('/admin/kibitzers'),
      getJson<WebhookStatus[]>('/admin/webhooks'),
      getJson<string[]>('/admin/connection-history'),
    ]);
    const errs: string[] = [];
    const take = <T,>(r: PromiseSettledResult<T>, what: string, keep: T): T => {
      if (r.status === 'fulfilled') return r.value;
      errs.push(describeError(`Loading ${what}`, r.reason));
      return keep;
    };
    broadcasts = take(b, 'the broadcasts', broadcasts);
    kibitzers = take(k, 'the kibitzers', kibitzers);
    webhooks = take(w, 'the webhooks', webhooks);
    history = take(h, 'the connection history', history);
    loaded = true;
    return errs.length ? errs.join(' ') : null;
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
    const refreshError = await refresh();
    error = [error, refreshError].filter(Boolean).join(' ') || null;
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
    // Back/Forward and nav clicks both change the hash, so this one listener keeps the nav highlight right.
    const onHash = () => (active = hashSection());
    window.addEventListener('hashchange', onHash);
    void refresh().then(async (e) => {
      error = e;
      if (location.hash) {
        await tick(); // the sections render after the first fetch, so the target only exists now
        document.getElementById(location.hash.slice(1))?.scrollIntoView();
      }
    });
    return () => {
      clearTimeout(copyTimer);
      window.removeEventListener('hashchange', onHash);
    };
  });
</script>

<SiteHeader badge="ADMIN"><span class="who">Signed in as admin</span></SiteHeader>

<div class="admin-page">
  <div class="layout">
    <nav aria-label="Admin sections">
      {#each nav as n (n.id)}
        <a href="#{n.id}" class:active={active === n.id} aria-current={active === n.id ? 'true' : undefined}
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
