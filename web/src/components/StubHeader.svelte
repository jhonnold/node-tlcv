<script lang="ts">
  const { title }: { title: string } = $props();
</script>

<header>
  <a href="/" class="brand">CCRL Live</a>
  <span class="title">{title}</span>
</header>

<style>
  header {
    height: 56px;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 0 20px;
    background: var(--surface);
    border-bottom: 1px solid var(--line);
  }
  .brand {
    color: var(--text);
    font-weight: 700;
    text-decoration: none;
  }
  .title {
    color: var(--muted);
  }
</style>
