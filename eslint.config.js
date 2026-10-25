import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier/flat';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

const svelteFiles = ['web/**/*.svelte', 'web/**/*.svelte.ts'];
// Scope svelte's file-less config entries (plugin setup, rules) to web/ so src/ is unaffected.
const scoped = (configs) => configs.map((c) => ({ ...c, files: c.files ?? svelteFiles }));

export default tseslint.config(
  { ignores: ['build/**'] },
  {
    files: ['{src,shared,web}/**/*.{ts,svelte}'],
    extends: [js.configs.recommended, tseslint.configs.recommended, prettier],
    languageOptions: { globals: globals.node, parserOptions: { sourceType: 'module' } },
  },
  ...scoped(svelte.configs.recommended),
  ...scoped(svelte.configs.prettier),
  {
    files: svelteFiles,
    languageOptions: { parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.svelte'] } },
    rules: {
      // SvelteKit-only (wants resolve() from $app/paths); this app uses its own router.
      'svelte/no-navigation-without-resolve': 'off',
    },
  },
  {
    files: ['{web,shared}/**/*.{ts,svelte}'],
    languageOptions: { globals: globals.browser },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
);
