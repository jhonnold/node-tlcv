<script lang="ts">
  import { onMount } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';
  import { getJson } from '$lib/http';
  import type { ArchiveSummary, LobbyBroadcast } from '$shared/types';
  import SiteHeader from '../components/SiteHeader.svelte';
  import FeaturedCard from '../components/lobby/FeaturedCard.svelte';
  import LiveCard from '../components/lobby/LiveCard.svelte';
  import SiteFooter from '../components/lobby/SiteFooter.svelte';
  import { formatArchiveDate, matchesQuery, plural, POLL_MS } from '../components/lobby/lobby';

  let live = $state<LobbyBroadcast[] | null>(null); // null until the first response: no empty-state flash
  let archives = $state<ArchiveSummary[]>([]);
  let query = $state('');
  let loadError = $state(false);
  const narrow = new MediaQuery('(max-width: 767px)');
  const mobile = $derived(narrow.current);
  let pageWidth = $state(document.documentElement.clientWidth); // usable width (excludes a classic scrollbar)
  const featured = $derived(live?.[0] ?? null); // server sorts by viewerCount desc
  const rest = $derived(live?.slice(1) ?? []);
  const featuredSize = $derived(mobile ? Math.min(380, pageWidth - 66) : 380); // 16 main + 1 border + 16 card padding, per side
  const q = $derived(query.trim().toLowerCase());
  const shown = $derived(archives.filter((a) => matchesQuery(a.site, a.slug, q)));

  onMount(() => {
    document.title = 'Live Broadcasts - CCRL Live';
    const ctrl = new AbortController();
    let inflight = false; // a slow server never stacks polls
    const load = () => {
      if (inflight) return;
      inflight = true;
      Promise.all([
        getJson<LobbyBroadcast[]>('/broadcasts', ctrl.signal)
          .then((d) => {
            live = d;
            loadError = false;
          })
          .catch(() => {
            if (live === null) loadError = true; // only before the first success: keep polling, show the retry line
          }),
        getJson<ArchiveSummary[]>('/archives', ctrl.signal)
          .then((d) => (archives = d))
          .catch(() => {}),
      ]).finally(() => (inflight = false));
    };
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      clearInterval(timer);
      ctrl.abort();
    };
  });
</script>

<div class="page" class:mobile bind:clientWidth={pageWidth}>
  <SiteHeader />
  <main>
    <div class="title-row">
      <h1>Live now</h1>
      {#if live}<span class="live-count">{plural(live.length, 'broadcast')}{mobile ? '' : ' · updates every 30 s'}</span
        >{/if}
    </div>

    {#if featured}
      {#key featured.port}
        <FeaturedCard b={featured} {mobile} size={featuredSize} />
      {/key}
      {#if rest.length}
        <ul class="live-grid">
          {#each rest as b (b.port)}
            <li><LiveCard {b} {mobile} /></li>
          {/each}
        </ul>
      {/if}
    {:else if loadError}
      <p class="load-error">Couldn't load broadcasts — retrying</p>
    {:else if live}
      <div class="empty">
        <h2>No broadcasts available</h2>
        <p>Check back later for live chess broadcasts.</p>
      </div>
    {/if}

    {#if archives.length}
      <section class="archive" aria-labelledby="archive-h">
        <div class="archive-head">
          <h2 id="archive-h">Previous broadcasts</h2>
          <label for="archive-filter" class="sr-only">Search archive</label>
          <input id="archive-filter" type="search" placeholder="Search events…" autocomplete="off" bind:value={query} />
        </div>
        {#if shown.length}
          <ul class="archive-grid">
            {#each shown as a (a.slug)}
              <li>
                <a class="archive-card" href="/archive/{a.slug}">
                  <span class="site">{a.site || a.slug}</span>
                  <span class="meta">
                    <span>{plural(a.gameCount, 'game')}</span>
                    <span class="date">{formatArchiveDate(a.updated)}</span>
                  </span>
                </a>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="archive-none">No events match “{query.trim()}”.</p>
        {/if}
      </section>
    {/if}
  </main>
  <SiteFooter {mobile} />
</div>

<style>
  .page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  main {
    width: 100%;
    max-width: 1344px;
    margin: 0 auto;
    padding: 32px 32px 48px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .title-row {
    display: flex;
    align-items: baseline;
    gap: 14px;
  }
  h1 {
    font-size: 30px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .live-count {
    font-size: 14px;
    color: var(--muted);
  }
  .live-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 20px;
  }
  .load-error {
    color: var(--muted);
    font-size: 14px;
  }
  .empty {
    padding: 48px 24px;
    border: 1px solid var(--line);
    background: var(--surface);
    text-align: center;
  }
  .empty h2 {
    font-size: 18px;
    font-weight: 700;
  }
  .empty p {
    margin-top: 6px;
    color: var(--muted);
  }
  .archive {
    margin-top: 24px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .archive-head {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .archive-head h2 {
    flex: 1;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  #archive-filter {
    width: 280px;
    height: 40px;
    padding: 0 12px;
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--text);
    font-size: 14px;
  }
  .archive-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }
  .archive-card {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--text);
    text-decoration: none;
  }
  .archive-card:hover {
    border-color: var(--faint);
  }
  .archive-card .site {
    font-size: 14px;
    font-weight: 600;
  }
  .meta {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: var(--muted);
  }
  .archive-none {
    color: var(--muted);
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  @media (max-width: 1279px) {
    .live-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .archive-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
  @media (max-width: 1023px) {
    .archive-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  /* Mobile (<768) */
  .mobile main {
    padding: 20px 16px 32px;
    gap: 16px;
  }
  .mobile .title-row {
    justify-content: space-between;
  }
  .mobile h1 {
    font-size: 24px;
  }
  .mobile .live-count {
    font-size: 13px;
  }
  .mobile .live-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .mobile .archive {
    margin-top: 20px;
    gap: 16px;
  }
  .mobile .archive-head {
    flex-direction: column;
    align-items: stretch;
  }
  .mobile .archive-head h2 {
    font-size: 20px;
  }
  .mobile #archive-filter {
    width: 100%;
    height: 44px;
    font-size: 15px;
  }
  .mobile .archive-grid {
    display: block;
    border: 1px solid var(--line);
    background: var(--surface);
  }
  .mobile .archive-grid li {
    border-bottom: 1px solid var(--line2);
  }
  .mobile .archive-grid li:last-child {
    border-bottom: 0;
  }
  .mobile .archive-card {
    min-height: 56px;
    justify-content: center;
    gap: 2px;
    padding: 8px 14px;
    border: 0;
  }
  .mobile .meta {
    display: block;
  }
  .mobile .date:not(:empty)::before {
    content: ' · ';
  }
</style>
