<script lang="ts">
  import { DASH } from '$lib/format';
  import type { WebhookStatus } from '$shared/types';
  import {
    blankWebhook,
    maskUrl,
    type Mutate,
    removeEntry,
    saveEntry,
    typeLabel,
    webhookBody,
    webhookFromStatus,
    type WebhookForm,
  } from './forms';

  type Props = { items: WebhookStatus[]; busy: boolean; mutate: Mutate };
  const { items, busy, mutate }: Props = $props();
  let form = $state<WebhookForm>(blankWebhook());
  let editingId = $state<string | null>(null);
  let nameInput: HTMLInputElement;

  function edit(w: WebhookStatus) {
    editingId = w.id;
    form = webhookFromStatus(w);
    nameInput.focus();
  }
  function reset() {
    editingId = null;
    form = blankWebhook();
  }
  async function submit(e: SubmitEvent) {
    e.preventDefault();
    const ok = await saveEntry(mutate, '/admin/webhooks', 'webhook', editingId, webhookBody(form));
    if (ok) reset();
    // The delete may have succeeded before the add failed. Then the form stays filled in as a plain add.
    else if (editingId && !items.some((w) => w.id === editingId)) editingId = null;
  }
  function remove(w: WebhookStatus) {
    if (editingId === w.id) reset();
    void removeEntry(mutate, '/admin/webhooks', 'webhook', w.id);
  }
</script>

<section id="webhooks" class="card" aria-labelledby="webhooks-h">
  <div class="card-head"><h2 id="webhooks-h">Webhooks</h2></div>
  {#if items.length}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Type</th>
            <th scope="col">URL</th>
            <th scope="col">Ports</th>
            <th scope="col">Events</th>
            <th scope="col" class="num"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {#each items as w (w.id)}
            <tr>
              <td data-label="Name">{w.name || DASH}</td>
              <td class="dim" data-label="Type">{typeLabel(w.type)}</td>
              <td class="mono dim" data-label="URL">{maskUrl(w.url)}</td>
              <td class="dim" data-label="Ports">{w.ports.length ? w.ports.join(', ') : 'all'}</td>
              <td data-label="Events">
                <span class="chips">
                  {#each w.events as ev (ev)}<span class="chip">{ev}</span>{/each}
                </span>
              </td>
              <td class="actions" data-label="Actions">
                <button type="button" class="btn" disabled={busy} onclick={() => edit(w)}>Edit</button>
                <button type="button" class="btn danger" disabled={busy} onclick={() => remove(w)}>Remove</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <p class="empty">No webhooks configured.</p>
  {/if}
  <form onsubmit={submit}>
    <h3>{editingId ? 'Edit webhook' : 'Add webhook'}</h3>
    <div class="grid hook">
      <div class="field">
        <label for="w-type">Type</label>
        <select id="w-type" bind:value={form.type}>
          <option value="discord">Discord</option>
        </select>
      </div>
      <div class="field">
        <label for="w-name">Name</label>
        <input id="w-name" placeholder="My Discord channel" bind:this={nameInput} bind:value={form.name} />
      </div>
      <div class="field">
        <label for="w-url">URL</label>
        <input
          id="w-url"
          class="mono"
          required
          placeholder="https://discord.com/api/webhooks/…"
          bind:value={form.url}
        />
      </div>
      <div class="field span2">
        <label for="w-ports">Ports</label>
        <input id="w-ports" placeholder="Blank for all, or e.g. 16063, 16064" bind:value={form.ports} />
      </div>
      <fieldset>
        <legend>Events</legend>
        <div class="checks">
          <label class="check"><input type="checkbox" bind:checked={form.started} />Game started</label>
          <label class="check"><input type="checkbox" bind:checked={form.finished} />Game finished</label>
        </div>
      </fieldset>
    </div>
    <div class="form-actions">
      <button type="button" class="btn secondary" onclick={reset}>Cancel</button>
      <button type="submit" class="btn primary" disabled={busy}>{editingId ? 'Save webhook' : 'Add webhook'}</button>
    </div>
  </form>
</section>
