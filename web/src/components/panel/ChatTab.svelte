<script lang="ts">
  import { getGameStore } from '$lib/game.svelte';
  import { chatPayload, nameColor, parseChatLine } from '$lib/chat';
  import { KEYS, readString, writeString } from '$lib/storage';

  type Props = { scroller: HTMLElement | undefined };
  const { scroller }: Props = $props();
  const game = getGameStore();
  const uid = $props.id();

  const spectators = $derived([...(game.live?.spectators ?? [])].sort((a, b) => a.localeCompare(b)));
  let specOpen = $state(false);
  const lines = $derived(game.chat.map(parseChatLine));

  let nick = $state(readString(KEYS.username) ?? '');
  let msg = $state('');
  // onchange fires on blur or Enter (chat/index.ts:95-100).
  function saveNick(): void {
    writeString(KEYS.username, nick.trim());
    game.send('nick', nick.trim() || 'Anonymous');
  }
  function send(): void {
    if (!msg.trim()) return;
    game.send('chat', chatPayload(nick.trim(), msg));
    msg = '';
  }

  // Stick to the bottom only if the reader was already there (chat/index.ts:48-79).
  let atBottom = true; // plain, not state
  $effect.pre(() => {
    void lines.length;
    const sc = scroller;
    atBottom = !sc || sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 50;
  });
  $effect(() => {
    void lines.length;
    const sc = scroller;
    if (sc && atBottom) sc.scrollTop = sc.scrollHeight;
  });
</script>

{#if game.live}
  <div class="spec">
    <button type="button" class="spec-toggle" aria-expanded={specOpen} onclick={() => (specOpen = !specOpen)}>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        ><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path
          d="M23 21v-2a4 4 0 0 0-3-3.87"
        ></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg
      >
      <span class="spec-count">{spectators.length} spectator{spectators.length === 1 ? '' : 's'}</span>
      <span class="spec-state">{specOpen ? 'Hide' : 'Show'}</span>
    </button>
    {#if specOpen}
      <ul class="spectators">
        {#each spectators as sp, i (i)}
          <li>{sp}</li>
        {/each}
      </ul>
    {/if}
  </div>
  <ol class="messages" aria-label="Chat messages">
    {#each lines as l, i (i)}
      <li>
        {#if l.name}<span class="name" style:color={nameColor(l.name)}>{l.name}</span>{/if}
        <!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitised by DOMPurify in lib/chat.ts -->
        <p class="text">{@html l.html}</p>
      </li>
    {/each}
  </ol>
{:else}
  <p class="empty">Connecting…</p>
{/if}

<form
  class="send"
  onsubmit={(e) => {
    e.preventDefault();
    send();
  }}
>
  <div class="row">
    <label for="{uid}-nick" class="label-text">Chatting as</label>
    <input id="{uid}-nick" class="ctl" placeholder="Anonymous" bind:value={nick} onchange={saveNick} />
  </div>
  <div class="row">
    <label for="{uid}-msg" class="sr-only">Message</label>
    <input id="{uid}-msg" class="ctl msg" placeholder="Say something about the game…" bind:value={msg} />
    <button type="submit" class="submit" aria-label="Send message" disabled={!game.connected}>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        ><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg
      >Send
    </button>
  </div>
</form>

<style>
  .spec {
    padding: 10px 14px;
    border-bottom: 1px solid var(--line);
  }
  .spec-toggle {
    width: 100%;
    min-height: var(--pCtlH);
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--text);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .spec-count {
    flex: 1;
    text-align: left;
  }
  .spec-state {
    font-size: 12px;
    font-weight: 500;
    color: var(--muted);
  }
  .spectators {
    list-style: none;
    margin: 8px 0 2px;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .spectators li {
    padding: 3px 8px;
    background: var(--surface2);
    font-size: 12px;
    color: var(--muted);
  }
  .messages {
    flex: 1;
    list-style: none;
    margin: 0;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .messages li {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .name {
    font-size: 13px;
    font-weight: 600;
  }
  .text {
    margin: 0;
    font-size: 14px;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }
  .text :global(a) {
    color: var(--link);
  }
  .text :global(code) {
    font-family: var(--fontMono);
    background: var(--surface2);
    padding: 0 3px;
  }
  .empty {
    padding: 14px;
    color: var(--muted);
  }
  .send {
    position: sticky;
    bottom: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 14px 14px;
    background: var(--surface);
    border-top: 1px solid var(--line);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .label-text {
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
  .ctl {
    flex: 1;
    min-width: 0;
    height: var(--pCtlH);
    box-sizing: border-box;
    padding: 0 10px;
    border: 1px solid var(--line);
    background: var(--surface2);
    color: var(--text);
    font-size: 13px;
  }
  .ctl.msg {
    padding: 0 12px;
    font-size: 14px;
  }
  .submit {
    height: var(--pCtlH);
    padding: 0 14px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 0;
    background: var(--invBg);
    color: var(--invText);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }
  .submit:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
