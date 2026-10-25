<script lang="ts">
  import type { EngineView } from '$lib/engines';
  import { DASH } from '$lib/format';

  type Props = { engine: EngineView };
  const { engine }: Props = $props();
</script>

<div class="strip" aria-label="Kibitzer {engine.name}, score {engine.score}">
  <span class="swatch" aria-hidden="true"></span>
  <span class="name">{engine.name}</span>
  <span class="tag">KIBITZER</span>
  <span class="score">{engine.score}</span>
  <span class="depth">{engine.depth === DASH ? DASH : 'd' + engine.depth}</span>
  <span class="pv"><strong>{engine.pv.first}</strong> {engine.pv.rest}</span>
</div>

<style>
  .strip {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    padding: 0 12px;
    border: 1px solid var(--line);
    background: var(--surface);
  }
  .swatch {
    width: 10px;
    height: 10px;
    flex-shrink: 0;
    background: var(--engK);
  }
  .name {
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
  }
  .tag {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--muted);
    white-space: nowrap;
  }
  .score {
    font-family: var(--fontMono);
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
  }
  .depth {
    font-family: var(--fontMono);
    font-size: 12px;
    color: var(--muted);
    white-space: nowrap;
  }
  .pv {
    flex: 1;
    min-width: 0;
    font-family: var(--fontMono);
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pv strong {
    color: var(--engK);
    font-weight: 600;
  }
</style>
