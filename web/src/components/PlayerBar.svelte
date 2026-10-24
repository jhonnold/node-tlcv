<script lang="ts">
  import { formatDuration } from '$lib/format';

  type Props = {
    side: 'white' | 'black';
    name: string;
    clock: string;
    active: boolean;
    thinkMs?: number | null;
    lastMs?: number | null;
    score?: string | null;
    showScore?: boolean;
    compact?: boolean;
  };
  const {
    side,
    name,
    clock,
    active,
    thinkMs = null,
    lastMs = null,
    score = null,
    showScore = false,
    compact = false,
  }: Props = $props();

  const label = $derived(side === 'white' ? 'White' : 'Black');
  const sub = $derived.by(() => {
    if (thinkMs != null) {
      return compact ? `Thinking ${formatDuration(thinkMs)}` : `${label} · thinking ${formatDuration(thinkMs)}`;
    }
    if (lastMs != null) {
      return compact ? `Last ${formatDuration(lastMs)}` : `${label} · last move ${formatDuration(lastMs)}`;
    }
    return label;
  });
</script>

<div class="player {side}" class:compact class:active>
  <!-- Disc colours are theme-invariant (Player.dc.html:43-44). -->
  <span class="disc" aria-hidden="true"></span>
  <div class="who">
    <span class="name">{name}</span>
    <span class="sub"
      >{#if active}<span class="dot"></span>{/if}<span>{sub}</span></span
    >
  </div>
  {#if showScore && score}<span class="score">{score}</span>{/if}
  <span class="clock" role="timer" aria-label="{side} clock {clock}">{clock}</span>
</div>

<style>
  .player {
    --c: var(--engW);
    width: 100%;
    height: 56px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 8px 0 12px;
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--text);
    font-family: var(--fontUi);
  }
  .player.black {
    --c: var(--engB);
  }
  .player.compact {
    height: 48px;
    padding-right: 6px;
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
    font-size: 15px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .compact .name {
    font-size: 14px;
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
  .score {
    font-family: var(--fontMono);
    font-size: 13px;
    font-weight: 600;
    color: var(--c);
  }
  .clock {
    min-width: 92px;
    height: 38px;
    box-sizing: border-box;
    padding: 0 10px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--surface2);
    color: var(--text);
    font-family: var(--fontMono);
    font-size: 20px;
    font-weight: 600;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }
  .compact .clock {
    min-width: 76px;
    height: 34px;
    font-size: 17px;
  }
  .active .clock {
    background: var(--invBg);
    color: var(--invText);
  }
</style>
