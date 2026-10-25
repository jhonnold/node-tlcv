# CONVENTIONS.md

Code style, tooling, and project conventions for Node TLCV.

## TypeScript

- **Strict mode**, ESNext target (`tsconfig.base.json`)
- `tsconfig.backend.json` (backend + shared, compiled by `tsc` into `build/`) and `web/tsconfig.json` (frontend + shared, bundler resolution, type-checked by `svelte-check`)
- **ES modules** (`"type": "module"`): use `.js` extensions in backend (`src/`, `shared/`) imports even for `.ts` sources. Inside `web/`, imports have no extension; use the `$lib/…` and `$shared/…` aliases
- Node `^20.19.0 || >=22.12.0` (`engines` in package.json; required by Vite)

## Formatting & Linting

- **Prettier 3** with `prettier-plugin-svelte` (120 char width, single quotes, trailing commas, semicolons); `npm run format` covers `{src,shared,web}/**/*.{ts,svelte,css,html}`
- **ESLint** flat config (`eslint.config.js`): typescript-eslint plus eslint-plugin-svelte for `web/`; `npm run lint` auto-fixes. Rules that bite: `svelte/require-each-key` (key every `{#each}`), `svelte/prefer-svelte-reactivity` (no plain `new Set/Map/Date/URL` in `.svelte` / `.svelte.ts`), `svelte/no-at-html-tags` (only the sanitised chat HTML is exempt)
- **svelte-check** (`npm run check`) fails on warnings, including a11y warnings
- Husky + lint-staged pre-commit: `eslint --fix` + `prettier --write` on staged `.ts` / `.svelte`, `prettier --write` on `.css` / `.html` (under `src/`, `shared/`, `web/`)

## Svelte

- Svelte 5 runes only (`runes: true` in `web/svelte.config.js`)
- Props: `type Props = { … }; const { … }: Props = $props();`
- Don't read a prop at the top level of a script (`state_referenced_locally`): use `$derived`, a closure, or `untrack`
- Shared state lives in `.svelte.ts` modules: per-page stores are classes provided with `createContext` (`GameStore`, `TournamentStore`); app-wide state is a module singleton (`theme`, `sound`, `router`)
- localStorage only through `lib/storage.ts` (`KEYS` + helpers that never throw)

## Styles

- Scoped `<style>` per component; colours only via `var(--token)`, fonts via `var(--fontUi)` / `var(--fontMono)` (see [docs/frontend.md](./docs/frontend.md) for the token set)
- Square corners and flat surfaces: no `border-radius`, no `box-shadow`
- Global CSS only in `web/src/styles/tokens.css` (token fallback, reset, base) and the admin page's `components/admin/admin.css`

## Build

- `npm run build` runs `prebuild` (`vite build` → `build/public`) and then `tsc -p tsconfig.backend.json` (→ `build/src`)
- No test infrastructure — verification is `npm run build`, `npm run check`, `npm run lint`, plus manual testing
