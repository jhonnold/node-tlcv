# Plans

Dated records of past work: designs, implementation plans and post-mortems,
one per change, named `YYYY-MM-DD-<topic>.md` (`issue-130-plan.md` and
`issue-132-plan.md` are named after their GitHub issues instead).

**These are history, not documentation.** Except for the backlog named at
the end of this page, each file describes the code as it was when it was
written and is not kept up to date. Many were written against the pre-Svelte
frontend, which the Svelte 5 + Vite app in `web/` has since replaced:

- EJS templates in `views/` (`views/pages/*.ejs`, `views/partials/*.ejs`),
  rendered by Express
- jQuery-based browser TypeScript in `public/js/`
- SCSS partials in `public/css/`
- the webpack build (`webpack/`, `tsconfig.frontend.json`)
- the old `*/json` and `*/meta` data routes, e.g. `/:port/games/json`,
  `/:port/result-table/json`, `/:port/games/:n/meta` and their
  `/archive/:slug/…` twins, now the REST API under `/broadcasts` and
  `/archives`
- the `POST /admin/new` and `POST /admin/close` admin actions, now
  `POST /admin/broadcasts` and `DELETE /admin/broadcasts/:connection`

The other files that refer to that stack start with a **Historical (pre-Svelte
frontend)** note, placed after the YAML front matter where there is one.

For the current architecture, read [AGENTS.md](../../AGENTS.md) and
[docs/frontend.md](../frontend.md) (pages, components, state, REST API and
Socket.IO events).

The one living document here is
[2026-05-25-node-tlcv-improvement-ideas.md](2026-05-25-node-tlcv-improvement-ideas.md),
a backlog of candidate improvements whose paths and statuses are kept current.
