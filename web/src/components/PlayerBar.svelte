<script lang="ts">
  import { formatDuration } from '$lib/format';

  type Props = {
    side: 'white' | 'black';
    name: string;
    clock: string;
    active: boolean;
    thinkMs?: number | null;
    lastMs?: number | null;
  };
  const { side, name, clock, active, thinkMs = null, lastMs = null }: Props = $props();

  const label = $derived(side === 'white' ? 'White' : 'Black');
  const sub = $derived.by(() => {
    if (thinkMs != null) return `Thinking ${formatDuration(thinkMs)}`;
    if (lastMs != null) return `Last ${formatDuration(lastMs)}`;
    return label;
  });
</script>

<div class="player {side}" class:active>
  <!-- Disc colours are theme-invariant (Player.dc.html:43-44). -->
  <span class="disc" aria-hidden="true"></span>
  <div class="who">
    <span class="name">{name}</span>
    <span class="sub"
      >{#if active}<span class="dot"></span>{/if}<span>{sub}</span></span
    >
  </div>
  <span class="clock" role="timer" aria-label="{side} clock {clock}">{clock}</span>
</div>

<style>
  .player {
    --c: var(--engW);
    width: 100%;
    height: 48px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 6px 0 12px;
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--text);
    font-family: var(--fontUi);
  }
  .player.black {
    --c: var(--engB);
  }
  .disc {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    box-sizing: border-box;
    background: #eceff4;
    border: 1.5px solid #b4bccb;
  }
  .player.black .disc {
    background: #2e3440;
    border-color: #81a1c1;
  }
  .who {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }
  .name {
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sub {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--muted);
    white-space: nowrap;
  }
  .dot {
    width: 6px;
    height: 6px;
    background: var(--c);
  }
  .clock {
    min-width: 76px;
    height: 34px;
    box-sizing: border-box;
    padding: 0 10px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--surface2);
    color: var(--text);
    font-family: var(--fontMono);
    font-size: 17px;
    font-weight: 600;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }
  .active .clock {
    background: var(--invBg);
    color: var(--invText);
  }
</style>
