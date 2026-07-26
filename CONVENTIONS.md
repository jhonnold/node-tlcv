# CONVENTIONS.md

Code style, tooling, and project conventions for Node TLCV.

## TypeScript

- **Strict mode** enabled, ESNext target
- Split tsconfigs: `tsconfig.backend.json` (backend + shared), `tsconfig.frontend.json` (frontend + shared)
- **ES modules** (`"type": "module"` in package.json) — use `.js` extensions in backend imports even for `.ts` source files
- Node >= 18 required

## Formatting & Linting

- **Prettier** (120 char width, single quotes, trailing commas, semicolons)
- **ESLint** with auto-fix on `npm run lint`
- Husky + lint-staged pre-commit hooks run `eslint --fix` + `prettier --write` on staged `.ts`/`.scss`/`.css`/`.html` files

## Styles

- SCSS via `sass-loader` (webpack)
- Partials use `@use 'mixins' as *` for mixin access
- `@use` rules must appear before all other rules in a `.scss` file — CSS `@import url()` (e.g. Google Fonts) counts as "other rules", so place font imports in a partial like `_base.scss`, not alongside `@use` statements
- CSS custom properties for runtime theming (see [docs/frontend.md](./docs/frontend.md) for theming details)
- Dual webpack rules: `.css` (third-party: reset-css, mini.css, chessboardjs) vs `.scss` (project styles)

## Build

- Webpack bundles frontend assets (configs in `webpack/`)
- `npm run build` runs `prebuild` (webpack prod) before TypeScript compile
- No test infrastructure — verification is `npm run build` + manual testing