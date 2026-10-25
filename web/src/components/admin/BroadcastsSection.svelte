<script lang="ts">
  import { del, postJson } from '$lib/http';
  import type { AdminBroadcast } from '$shared/types';
  import type { Mutate } from './forms';

  type Props = { items: AdminBroadcast[]; history: string[]; busy: boolean; mutate: Mutate };
  const { items, history, busy, mutate }: Props = $props();
  let connection = $state('');
  let ephemeral = $state(false);

  function close(b: AdminBroadcast) {
    void mutate(`Closing ${b.connection}`, () => del(`/admin/broadcasts/${encodeURIComponent(b.connection)}`));
  }

  async function add(e: SubmitEvent) {
    e.preventDefault();
    const c = connection.trim();
    if (!c) return;
    const ok = await mutate('Adding the broadcast', () => postJson('/admin/broadcasts', { connection: c, ephemeral }));
    if (ok) {
      connection = '';
      ephemeral = false;
    }
  }
</script>

<section id="broadcasts" class="card" aria-labelledby="broadcasts-h">
  <div class="card-head"><h2 id="broadcasts-h">Broadcasts</h2></div>
  {#if items.length}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Site</th>
            <th scope="col">Host</th>
            <th scope="col">Port</th>
            <th scope="col">Ephemeral</th>
            <th scope="col" class="num">Viewers</th>
            <th scope="col" class="num"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {#each items as b (b.connection)}
            <tr>
              <td data-label="Site">{b.site || '—'}</td>
              <td class="mono dim" data-label="Host">{b.host}</td>
              <td class="mono" data-label="Port">{b.port}</td>
              <td class="dim" data-label="Ephemeral">{b.ephemeral ? 'Yes' : '—'}</td>
              <td class="num mono" data-label="Viewers">{b.viewerCount}</td>
              <td class="actions" data-label="Actions">
                <button
                  type="button"
                  class="btn danger"
                  aria-label="Close {b.site || b.connection}"
                  disabled={busy}
                  onclick={() => close(b)}>Close</button
                >
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <p class="empty">No broadcasts running.</p>
  {/if}
  <form class="inline" onsubmit={add}>
    <div class="field">
      <label for="b-conn">Connection</label>
      <input
        id="b-conn"
        class="mono"
        required
        autocomplete="off"
        list="b-history"
        placeholder="GrahamCCRL.dyndns.org:16000"
        bind:value={connection}
      />
    </div>
    <datalist id="b-history">
      {#each history as c (c)}<option value={c}></option>{/each}
    </datalist>
    <label class="check"><input type="checkbox" bind:checked={ephemeral} />Ephemeral local port</label>
    <button type="submit" class="btn primary" disabled={busy}>Add broadcast</button>
  </form>
</section>
