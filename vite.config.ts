import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Vite root is web/ (index.html + public/ assets). Output goes where Express serves static files.
export default defineConfig({
  root: r('./web'),
  plugins: [svelte()],
  resolve: { alias: { $lib: r('./web/src/lib'), $shared: r('./shared') } },
  build: { outDir: r('./build/public'), emptyOutDir: true },
});
