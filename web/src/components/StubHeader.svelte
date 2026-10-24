<script lang="ts">
  import ThemeDrawer from './ThemeDrawer.svelte';

  const { title }: { title: string } = $props();
  let themeOpen = $state(false);
</script>

<header>
  <a href="/" class="brand">CCRL Live</a>
  <span class="title">{title}</span>
  <button type="button" class="theme" aria-label="Theme" title="Theme" onclick={() => (themeOpen = true)}
    ><svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      ><circle cx="13.5" cy="6.5" r=".5"></circle><circle cx="17.5" cy="10.5" r=".5"></circle><circle
        cx="8.5"
        cy="7.5"
        r=".5"
      ></circle><circle cx="6.5" cy="12.5" r=".5"></circle><path
        d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"
      ></path></svg
    ></button
  >
</header>
<ThemeDrawer open={themeOpen} onclose={() => (themeOpen = false)} />

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
  .theme {
    margin-left: auto;
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    border: 0;
    background: transparent;
    color: var(--muted);
  }
  .theme:hover {
    color: var(--text);
  }
</style>
