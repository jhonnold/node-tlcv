<script lang="ts">
  import { del, postJson } from '$lib/http';
  import type { KibitzerStatus } from '$shared/types';
  import {
    blankKibitzer,
    kibitzerBody,
    kibitzerFromStatus,
    type KibitzerForm,
    type Mutate,
    targetLabel,
  } from './forms';

  type Props = { items: KibitzerStatus[]; busy: boolean; mutate: Mutate };
  const { items, busy, mutate }: Props = $props();
  let form = $state<KibitzerForm>(blankKibitzer());
  let editingId = $state<string | null>(null);
  let pathInput: HTMLInputElement;
  const ssh = $derived(form.type === 'ssh');

  function edit(k: KibitzerStatus) {
    editingId = k.id;
    form = kibitzerFromStatus(k);
    pathInput.focus();
  }
  function reset() {
    editingId = null;
    form = blankKibitzer();
  }
  async function submit(e: SubmitEvent) {
    e.preventDefault();
    const id = editingId;
    const body = kibitzerBody(form);
    // The API has no PUT, so an edit is delete-then-add, as in admin.ts:102-123.
    const ok = await mutate(id ? 'Saving the kibitzer' : 'Adding the kibitzer', async () => {
      if (id) await del(`/admin/kibitzers/${encodeURIComponent(id)}`);
      await postJson('/admin/kibitzers', body);
    });
    if (ok) reset();
    // The delete may have succeeded before the add failed. Then the form stays filled in as a plain add.
    else if (editingId && !items.some((k) => k.id === editingId)) editingId = null;
  }
  function remove(k: KibitzerStatus) {
    if (editingId === k.id) reset();
    void mutate('Removing the kibitzer', () => del(`/admin/kibitzers/${encodeURIComponent(k.id)}`));
  }
</script>

<section id="kibitzers" class="card" aria-labelledby="kibitzers-h">
  <div class="card-head"><h2 id="kibitzers-h">Kibitzers</h2></div>
  {#if items.length}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Engine</th>
            <th scope="col">Type</th>
            <th scope="col" class="num">Priority</th>
            <th scope="col" class="num">Threads</th>
            <th scope="col" class="num">Hash</th>
            <th scope="col">Analysing</th>
            <th scope="col">Status</th>
            <th scope="col" class="num"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {#each items as k (k.id)}
            <tr>
              <td data-label="Engine">{k.engineName}</td>
              <td class="mono dim" data-label="Type">{k.type}</td>
              <td class="num mono" data-label="Priority">{k.priority}</td>
              <td class="num mono" data-label="Threads">{k.threads}</td>
              <td class="num mono" data-label="Hash">{k.hash} MB</td>
              <td class="dim" data-label="Analysing">{targetLabel(k)}</td>
              <td data-label="Status"
                ><span class="status" class:ready={k.ready}>{k.ready ? 'Ready' : 'Not ready'}</span></td
              >
              <td class="actions" data-label="Actions">
                <button type="button" class="btn" disabled={busy} onclick={() => edit(k)}>Edit</button>
                <button type="button" class="btn danger" disabled={busy} onclick={() => remove(k)}>Remove</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <p class="empty">No kibitzers configured.</p>
  {/if}
  <form onsubmit={submit}>
    <div class="form-head">
      <h3>{editingId ? 'Edit kibitzer' : 'Add kibitzer'}</h3>
      <div class="segmented" role="group" aria-label="Transport">
        <button type="button" aria-pressed={form.type === 'local'} onclick={() => (form.type = 'local')}>Local</button>
        <button type="button" aria-pressed={form.type === 'ssh'} onclick={() => (form.type = 'ssh')}>SSH</button>
      </div>
    </div>
    <div class="grid kib">
      <div class="field span2">
        <label for="k-path">Engine path</label>
        <input
          id="k-path"
          class="mono"
          placeholder="stockfish"
          required={ssh}
          bind:this={pathInput}
          bind:value={form.enginePath}
        />
      </div>
      <div class="field">
        <label for="k-pri">Priority</label>
        <input id="k-pri" type="number" min="1" required bind:value={form.priority} />
      </div>
      <div class="pair">
        <div class="field">
          <label for="k-thr">Threads</label>
          <input id="k-thr" type="number" min="1" bind:value={form.threads} />
        </div>
        <div class="field">
          <label for="k-hash">Hash (MB)</label>
          <input id="k-hash" type="number" min="1" bind:value={form.hash} />
        </div>
      </div>
      {#if ssh}
        <div class="field">
          <label for="k-host">SSH host</label>
          <input id="k-host" placeholder="example.com" required bind:value={form.host} />
        </div>
        <div class="field">
          <label for="k-port">Port</label>
          <input id="k-port" type="number" bind:value={form.port} />
        </div>
        <div class="field">
          <label for="k-user">Username</label>
          <input id="k-user" required bind:value={form.username} />
        </div>
        <div class="field">
          <label for="k-key">Private key path</label>
          <input
            id="k-key"
            class="mono"
            placeholder="/home/user/.ssh/id_rsa"
            required
            bind:value={form.privateKeyPath}
          />
        </div>
      {/if}
    </div>
    <div class="form-actions">
      <button type="button" class="btn secondary" onclick={reset}>Cancel</button>
      <button type="submit" class="btn primary" disabled={busy}>{editingId ? 'Save kibitzer' : 'Add kibitzer'}</button>
    </div>
  </form>
</section>
