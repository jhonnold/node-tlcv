# Frontend Architecture

The frontend is a Svelte 5 single-page app (runes mode) in `web/`, bundled by Vite into `build/public/`. Express serves those static files plus one HTML shell for every page route (`src/routes/spa.ts`). All data comes from a JSON REST API and, for live games, Socket.IO.

## Build and layout

| Path | Role |
|------|------|
| `vite.config.ts` | Vite root `web/`, Svelte plugin, aliases `$lib` → `web/src/lib` and `$shared` → `shared/`, output `build/public` (emptied on every build) |
| `web/svelte.config.js` | `vitePreprocess`, `runes: true` |
| `web/tsconfig.json` | Bundler resolution, DOM libs, `noEmit`, includes `../shared`. Type-checked by `npm run check` (`svelte-check --fail-on-warnings`), not by `tsc` |
| `web/index.html` | Shell: Google Fonts (Archivo, JetBrains Mono), Google Analytics, `<div id="app">`, `/src/main.ts` |
| `web/public/` | Copied as-is: `img/pieces/<set>/<piece>.svg`, `audio/Move.mp3`, `audio/Capture.mp3`, `favicon.ico` |
| `web/src/main.ts` | Imports `styles/tokens.css`, runs `initTheme()`, mounts `App.svelte` |

`npm run prebuild` is `vite build`; `npm run dev-public` is `vite build --watch`. There is no Vite dev server: Express always serves the app, so run `npm run dev-server` alongside.

## Pages and routing

| Path | Page | Server guard before the shell is sent |
|------|------|------|
| `/` | `pages/Lobby.svelte` | — |
| `/:port` | `pages/Viewer.svelte` (live) | redirect to `/` if no broadcast uses that port |
| `/archive/:slug` | `pages/Viewer.svelte` (archive) | redirect to `/` unless the slug matches `SAFE_SLUG` and the archive loads |
| `/admin` | `pages/Admin.svelte` | 503 without `TLCV_PASSWORD`, then HTTP basic auth (user `admin`) |

- `lib/url.ts` `parsePath()` maps a pathname to a route. `lib/router.svelte.ts` keeps the route in `$state`, listens to `popstate`, and intercepts plain left-clicks on same-origin `<a>` elements (modified clicks, `target`, `download` and `#hash` links are left to the browser).
- Unknown paths: the client rewrites the URL to `/` and shows the lobby; the server's catch-all also redirects to `/`.
- Links to `/admin` are never intercepted: the browser always does a full load, so the basic-auth challenge runs.
- `App.svelte` keys `Viewer` by `pagePath(source)`, so switching broadcast or archive remounts the page.
- Client-side navigation skips the server guards, so `Viewer` fetches its summary (`/broadcasts/:port` or `/archives/:slug`) and navigates home on a 404.
- `lib/http.ts` (`getJson`, `getText`, `postJson`, `del`) throws `HttpError` with the status. A redirected GET (the catch-all) counts as a 404.

## State

| Module | Holds |
|--------|-------|
| `lib/game.svelte.ts` `GameStore` | One per Viewer (context `setGameStore` / `getGameStore`). Live data from Socket.IO (`connect(port)` returns the disconnect function), the replayed game, the navigation cursor and arrow-key handler, and derived views (players, engines, arrows, eval, FEN, position label). |
| `lib/tournament.svelte.ts` `TournamentStore` | One per Viewer (context `setTournament` / `getTournament`). Fetches `<base>/games` and `<base>/results` in its constructor; a 404 means "none yet" (`null`). `refreshSoon()` re-fetches 5 s later (Viewer calls it when a new live game starts); `dispose()` aborts. |
| `lib/view.svelte.ts` `ViewState` | One per Viewer (context `setView` / `getView`). Breakpoint `bp` from two `MediaQuery` thresholds (768 / 1280 px): mobile, tablet, desktop. Fields `flipped`, `focus`, `themeOpen`, `boardPref`; only `boardPref` persists (`board-width`, written by `commitBoardPref()` when a resize drag ends). |
| `lib/theme/theme.svelte.ts` `theme` | Module singleton: preset, base preset, board palette, piece set, custom overrides. |
| `lib/sounds.svelte.ts` `sound` | Move sounds, off until enabled; `Capture.mp3` for SAN containing `x`, else `Move.mp3`. |
| `lib/router.svelte.ts` `router` | The current route. |

localStorage keys (`KEYS` in `lib/storage.ts`; every access is wrapped in try/catch): `theme`, `tlcv.themeBase`, `tlcv.customTheme`, `tlcv.pieceSet`, `tlcv.boardPalette`, `soundEnabled`, `tlcv.net-username`, `board-width`.

## Components (`web/src/components/`)

| Component | Purpose |
|-----------|---------|
| `Board.svelte` | chessboardjs wrapper. Props `fen`, `size` (rendered at a multiple of 8 px), `flipped`, `coords`, `lastMove`, `arrows` (SVG overlay), `animate`, `label`. Used for the main board, PV thumbnails, lobby cards and the theme preview. |
| `EvalBar.svelte` | Vertical or horizontal eval bar; `score` is White's view. |
| `PlayerBar.svelte` | Name, status and clock (`role="timer"`); `compact` and `showScore` variants. |
| `EngineCard.svelte` | Engine or kibitzer card; `compact` and `thumb` (PV-end board) variants. |
| `BrandMark.svelte`, `SiteHeader.svelte` | Logo; the header of Lobby and Admin. |
| `ThemeDrawer.svelte` (+ `theme/drawer.ts`) | Native modal `<dialog>`: presets, piece set, board palettes, colour rows, Reset to preset, Done. |
| `panel/Panel.svelte` | Tab bar + `ReplayBanner`; starts and ends replays. Tab sets: `all` (Moves, Chat, Graphs, Standings, Games, Info; desktop) and `mobile` (adds Engines; tablet and mobile). Chat is hidden on archives and during replays; archives open on Games on desktop. |
| `panel/*Tab.svelte` | Moves, Chat, Graphs (Chart.js), Standings, Games, Info, Engines. |
| `panel/ReplayBanner.svelte` | "Replaying game N"; Back to live on live pages only. |
| `lobby/*` | `FeaturedCard`, `LiveCard`, `SiteFooter`; helpers in `lobby.ts` (30 s poll). |
| `admin/*` | `BroadcastsSection`, `KibitzersSection`, `WebhooksSection`; helpers in `forms.ts`; styles in `admin.css`. |
| `viewer/Header.svelte` | Tablet/desktop header (same height, padding and brand as `SiteHeader`): brand, site, "Game N", LIVE/ARCHIVE badge, watching count, Focus/Flip/Sound/Theme buttons |
| `viewer/MobileHeader.svelte` | Mobile header with Flip and the ⋮ menu (Focus mode, Move sounds, Theme & pieces, All broadcasts) |
| `viewer/DesktopLayout.svelte` | Desktop grid (≥1280 px): engine cards, board column, and a Panel with every tab (Moves included). The board fits the window height, the panel takes the remaining width |
| `viewer/TabletLayout.svelte` | Tablet layout: board, eval bar, engine cards, nav row, kibitzer strip and the mobile-tab Panel |
| `viewer/MobileLayout.svelte` | Mobile layout: board, horizontal eval bar, nav row and the Panel |
| `viewer/NavControls.svelte` | First/prev/next/latest, position label, Following live / Back to live |
| `viewer/ResizeHandle.svelte` | Desktop board-size drag handle (pointer only; stored in `board-width`) |
| `viewer/FocusView.svelte` | Focus mode (Esc exits) |
| `viewer/ModeLine.svelte` | Tablet/mobile header sub-line: LIVE or ARCHIVE, then "· Game N · M watching" (no watching count on archives) |
| `viewer/ArrowLegend.svelte` | Legend for the PV arrow colours: White, Black and, when present, the kibitzer |
| `viewer/KibitzerStrip.svelte` | Tablet kibitzer summary strip (name and score) |
| `viewer/OpeningLine.svelte` | Opening name and ECO, plus the tablebase result; `row` and `short` variants |
| `viewer/Icon.svelte` | Inline SVG icon set (`IconName`) used by the viewer headers and nav |

Plain-TS logic in `web/src/lib/`: `arrows.ts` (PV arrows), `chat.ts` (line parsing, markdown + DOMPurify), `chessboard.ts` + `jquery-global.ts` (chessboardjs bootstrap), `clocks.ts`, `color.ts` (arrow colour blending), `delta.ts` (Socket.IO delta merge), `engines.ts` (engine card views), `fen.ts`, `format.ts` (scores, counts, times), `games.ts` (Games tab rows), `graphs.ts` (series + Chart.js config), `moves.ts` (move grid), `positions.ts` (SAN → FEN list), `pv.ts`, `replay.ts`, `standings.ts` (crosstable), `storage.ts`, `url.ts`.

## Theming

- Tokens (`TOKEN_KEYS`, `lib/theme/presets.ts`): `bg`, `surface`, `surface2`, `line`, `line2`, `text`, `muted`, `faint`, `invBg`, `invText`, `liveBg`, `liveText`, `engW`, `engB`, `engK`, `evalW`, `evalB`, `link`, `sel`, `tabSel`, `posBg`, `boardLight`, `boardDark`, `boardHl`, `arrowW`, `arrowB`, `arrowK`. Presets: `PRESETS.dark` (Nord) and `PRESETS.light`.
- Board palettes (`BOARD_PALETTES`: nord, steel, walnut, green) and piece sets (`lib/theme/piece-sets.ts`: classic, livius, meridian, meridian_shaded) are chosen independently of the preset.
- `theme.svelte.ts` writes every token as `--<key>` on `<html>` and sets `color-scheme`. `styles/tokens.css` holds the dark preset and the nord board as the pre-JS fallback and **must stay in sync** with `PRESETS.dark` and `BOARD_PALETTES.nord`.
- Components use scoped `<style>` blocks that read only `var(--token)` (except deliberately theme-invariant colours: player discs, text on live-coloured badges and buttons, PV arrow outline, which say so in a comment), plus `var(--fontUi)` / `var(--fontMono)`. A new colour needs a token in `TOKEN_KEYS`, both presets, and (for dark) `tokens.css`.
- With nothing stored, the preset follows `prefers-color-scheme` and is not persisted. Editing a colour switches to `custom`: overrides go to `tlcv.customTheme` (written 150 ms after the last change) and the preset they derive from to `tlcv.themeBase`. A stored custom theme with unknown keys (pre-Svelte themes) is dropped along with `tlcv.themeBase`.

## REST API

Public (`src/routes/index.ts`). Missing resources answer `404 {"error": …}`.

| Route | Returns |
|-------|---------|
| `GET /broadcasts` | `LobbyBroadcast[]`, most viewers first |
| `GET /broadcasts/:port` | `BroadcastSummary` |
| `GET /broadcasts/:port/results` | `ParsedResults` (404 until the first results arrive) |
| `GET /broadcasts/:port/games` | `GameRecord[]` with `pgnUrl` / `metaUrl` (404 until known) |
| `GET /broadcasts/:port/games/:n` | `StoredGameMeta` |
| `GET /broadcasts/:port/pgn` | current game PGN, `text/plain` |
| `GET /archives` | `ArchiveSummary[]`, excluding tournaments that are live |
| `GET /archives/:slug` | `ArchiveInfo` |
| `GET /archives/:slug/results`, `/games`, `/games/:n` | as for broadcasts, except `/games` always answers 200 |

Kept for external links: `GET /:port/pgn` and `GET /:port/result-table` (`text/plain`), and `GET /pgns/` (static files plus a directory listing of `PGNS_DIR`).

Admin (`src/routes/admin.ts`; 503 without `TLCV_PASSWORD`, then basic auth). Mutations answer 200, or 400 on failure. The UI's "Edit" is delete + add.

| Route | Purpose |
|-------|---------|
| `GET /admin/broadcasts` | `AdminBroadcast[]` (with `viewerCount`) |
| `POST /admin/broadcasts` | `{ connection: "host:port", ephemeral? }` |
| `DELETE /admin/broadcasts/:connection` | URL-encoded `host:port` |
| `GET` / `POST /admin/kibitzers`, `DELETE /admin/kibitzers/:id` | `KibitzerStatus[]`; local or SSH transport |
| `GET` / `POST /admin/webhooks`, `DELETE /admin/webhooks/:id` | `WebhookStatus[]`; Discord only |
| `GET /admin/connection-history` | previously used connections that are not active |
| `GET /admin/metrics` | Prometheus exposition |

## Socket.IO

| Event | Direction | Payload |
|-------|-----------|---------|
| `join` | client → server | `{ port, user }`; the server answers with `state` |
| `state` | server → client | `SerializedBroadcast` (game, spectators, chat history) |
| `update` | server → client | `BroadcastDelta` (game delta, `spectators`); a new game arrives as a delta with `resetMoves` |
| `new-chat` | server → client | `string[]` |
| `chat` | client → server | message text; relayed to TLCS as `CHAT: …` |
| `nick` | client → server | new name; stays in node-tlcv (spectator list only) |

## Gotchas

- **chessboardjs needs a global `$`.** `lib/jquery-global.ts` sets `window.$` / `window.jQuery` and must load before chessboardjs; `lib/chessboard.ts` (the only module importing chessboardjs) does this.
- **Board leaks without `createBoard()`.** chessboardjs's `destroy()` leaves un-namespaced `$(window)` / `$('body')` handlers. `createBoard()` diffs jQuery's handler registry around the build and removes the added handlers on destroy. Always build boards through it (`Board.svelte` does).
- **Score orientation.** TLCS engine scores (`MoveMetaData.score`, `liveData.score`) are from the side to move's view; `whiteScore()` in `lib/format.ts` is the one place they become White's view. Kibitzer scores are already White's: never pass them through `whiteScore()`. `formatScore()` shows `+M` / `-M` from |score| ≥ 1000.
- **Replay generations.** `GameStore.beginReplay()` returns a generation; `loadReplay(meta, n, gen)` applies only if no `beginReplay()` / `exitReplay()` happened since. Start every replay fetch with `beginReplay()`, so a slow response can't override a newer Replay, Back to live or Watch.
- **Chat trim.** The server keeps 2000 lines and sends the last 1000 on join (`src/broadcast.ts`). The client trims to the last 2000 once it holds more than 2200, so the keyed list isn't re-indexed on every message.
- **Chat is real.** Only the `chat` event reaches TLCS; `join` and `nick` stay local. Tests must never send chat to a real broadcast.
- **Keyboard.** ←/→/↑/↓ move through the game (`GameStore.onKeydown`); ignored while an input, textarea, select or contenteditable has focus, and with Alt/Ctrl/Meta. Panel tabs have no arrow-key handling on purpose, so the arrows always drive the board.
- **`{@html}`** appears only in `ChatTab.svelte`, for HTML sanitised by DOMPurify with a tag allowlist (`lib/chat.ts`).
