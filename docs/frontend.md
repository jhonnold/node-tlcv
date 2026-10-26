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
- `lib/http.ts` (`getJson`, `postJson`, `del`) throws `HttpError` with the status. A redirected GET (the catch-all) counts as a 404.

## State

| Module | Holds |
|--------|-------|
| `lib/game.svelte.ts` `GameStore` | One per Viewer (context `setGameStore` / `getGameStore`). Live data from Socket.IO (`connect(port)` returns the disconnect function), the replayed game, the navigation cursor and arrow-key handler, and derived views (players, engines, arrows, eval, FEN, position label). |
| `lib/tournament.svelte.ts` `TournamentStore` | One per Viewer (context `setTournament` / `getTournament`). Fetches `<base>/games` and `<base>/results` in its constructor; a 404 means "none yet" (`null`). `refreshSoon()` re-fetches 5 s later (Viewer calls it when a new live game starts); `dispose()` aborts. |
| `lib/view.svelte.ts` `ViewState` | One per Viewer (context `setView` / `getView`). Breakpoint `bp` from two `MediaQuery` thresholds (768 / 1280 px): mobile, tablet, desktop. Fields `flipped`, `focus`, `themeOpen`, `boardPref`; only `boardPref` persists (`board-width`, written by `commitBoardPref()` when a resize drag ends). Helpers in the same file: `floor8`, `clamp`, `clampBoard` and `MIN_BOARD` (board sizing), `kibitzerView` (the kibitzer card's data) and `gameText` ("Game N"). |
| `lib/theme/theme.svelte.ts` `theme` | Module singleton: preset, base preset, board palette, piece set, custom overrides. |
| `lib/sounds.svelte.ts` `sound` | Move sounds, off until enabled; `Capture.mp3` for SAN containing `x`, else `Move.mp3`. |
| `lib/router.svelte.ts` `router` | The current route. |

localStorage keys (`KEYS` in `lib/storage.ts`; every access is wrapped in try/catch): `theme`, `tlcv.themeBase`, `tlcv.customTheme`, `tlcv.pieceSet`, `tlcv.boardPalette`, `soundEnabled`, `tlcv.net-username`, `board-width`.

## Viewer layouts

One layout tree per breakpoint (`ViewState.bp`: mobile < 768 px, tablet 768–1279 px, desktop ≥ 1280 px); each has exactly one `Board` labelled "Main board". Focus mode replaces it.

- **Desktop (≥ 1280 px)**: `Header` (56 px: brand mark and "CCRL Live" wordmark; Focus, Flip, Sound, Theme) over `DesktopLayout`, a centred grid `meta board table` / `chat board table`. The meta cell is `EventCard`. The chat column is always `Panel tabs="chatOnly"`, which on archives and replays shows its empty-state line. The board column is a `PlayerBar`, the eval bar and board, and a `PlayerBar`. The table column is the top short engine card, `NavControls`, `Panel tabs="noChat"`, the kibitzer short card and the bottom short engine card. Sizing is fluid with t = clamp((w − 1440) / 480, 0, 1): page padding 20 → 24 px, eval bar 12 → 14 px, PV-end boards 72 → 80 px, chat column 240–400 px, table column ≤ 520 px. The board, table and meta/chat columns share one height.
- **Desktop board resize**: `ResizeHandle` reports `onresize(px, from)`, with `from` the board size at pointerdown. `DesktopLayout` maps the drag piecewise, so the handle stays under the pointer whether the grid is left-anchored or centred at the 520 px table cap. The size is clamped with `clampBoard(…, max)` and `MIN_BOARD`, and persisted as `board-width` on release.
- **Tablet (768–1279 px)**: `Header` with the event info (56 px: brand mark only, a 44 px link named "CCRL Live — all broadcasts"; the site `<h1>`, ellipsised, over `EventLine` — the LIVE/ARCHIVE badge and "Game N · M watching", as in `MobileHeader`; Focus, Flip, Sound, Theme at 44 px) over `TabletLayout`, a grid `board table` / `tabs tabs`. There is no `EventCard` on tablet: the opening is in the Moves header and the Info tab, the tablebase in the Info tab. The board is the largest multiple of 8 px that leaves the table column at least 304 px and keeps the board column (board and two player bars) inside the window under the header; the table column takes the rest up to 360 px, then the grid centres. The table column holds the top short card, then the kibitzer short card with `NavControls`, then the bottom short card. The short cards there have no PV-end board (`thumb` 0). `Panel tabs="chatFirst" touch` spans the full width below, 480–640 px tall (`clamp(480px, 100dvh − 88px, 640px)`). The page scrolls and there is no resize handle.
- **Mobile (< 768 px)**: `MobileHeader` (52 px: brand link, site, LIVE/ARCHIVE · Game N · M watching, Flip) over `MobileLayout`, a single scrolling column: short engine card for the top side, `PlayerBar`, the full-width board (8 px grid; on landscape phones no taller than the screen less header and nav bar), 6 px horizontal `EvalBar`, `PlayerBar`, short engine card for the bottom side, the kibitzer short card when the game has one, then `Panel tabs="chatFirst" touch` (`max(420px, 100svh − 56px)` tall, so it fills the screen above the nav bar). `MobileNavBar` sticks to the bottom (56 px): the ≡ "More options" menu (Focus mode, Move sounds, Theme & pieces, All broadcasts; opens upward), Start, Previous, a wide middle button (`Live · 20… Qb6` while following, `20… Qb6 · live` when behind; returns to live), Next, Latest. Every control is at least 44×44 px. There is no Engines tab.

## Components (`web/src/components/`)

| Component | Purpose |
|-----------|---------|
| `Board.svelte` | chessboardjs wrapper. Props `fen`, `size` (rendered at a multiple of 8 px), `flipped`, `coords`, `lastMove`, `arrows` (SVG overlay), `animate`, `label`. Used for the main board, PV thumbnails, lobby cards and the theme preview. |
| `EvalBar.svelte` | Vertical or horizontal eval bar; `score` is White's view. |
| `PlayerBar.svelte` | Name, status (Thinking / Last + duration) and clock (`role="timer"`); one 48 px look. |
| `EngineCard.svelte` | Single short card: row 1 colour square, score (`+M7`), WDL (`[214w, 774d, 12l]`, White's view, omitted when absent), then on the kibitzer card only the engine name (ellipsis) and a "Kibitzer" role label unless the name is that `Kibitzer` fallback (the White/Black names are in the player bars); row 2 stats `d34/51 · nodes · nps/s · hashfull · tbhits`, parts dropped when absent (`seldepth` after `/`, `hashfull` as a percent); no status or time, since the player bar and the board arrow carry those; the `aria-label` still gives role, name and score; the PV clamped to 2 lines (full PV in `title`), so the height is constant; an optional PV-end board (`thumb` px) whose click copies the FEN. |
| `BrandMark.svelte`, `SiteHeader.svelte` | Logo; the header of Lobby and Admin. |
| `ThemeDrawer.svelte` (+ `theme/drawer.ts`) | Native modal `<dialog>`: presets, piece set, board palettes, colour rows, Reset to preset, Done. |
| `panel/Panel.svelte` | Tab bar + `ReplayBanner`; starts and ends replays. Tab sets: `noChat` (Moves, Graphs, Standings, Games, Info); `chatFirst` (Chat first, opens on Chat when live); `chatOnly` (no tab bar or header; the panel is labelled "Chat"). In Chat, the spectator row sticks to the top of the scrolling body. `touch` gives 44 px controls through the `--p*` size variables, including `--pSegH` and `--pBtnH`. Chat is hidden on archives and during replays; archives open on Games. |
| `panel/*Tab.svelte` | Moves, Chat, Graphs (Chart.js), Standings, Games, Info. |
| `panel/ReplayBanner.svelte` | "Replaying game N"; Back to live on live pages only. |
| `lobby/*` | `LiveCard`, `SiteFooter`; helpers in `lobby.ts` (30 s poll). |
| `admin/*` | `BroadcastsSection`, `KibitzersSection`, `WebhooksSection`; helpers in `forms.ts`; styles in `admin.css`. |
| `viewer/Header.svelte` | Tablet/desktop header (56 px, 20 px padding). Desktop: brand mark and wordmark; Focus, Flip, Sound, Theme. Tablet: brand mark only, site `<h1>` (ellipsis) over `EventLine`, then the same buttons at 44 px. |
| `viewer/EventCard.svelte` | Desktop meta box (`section[aria-label="Event"]`): LIVE badge + N watching, or ARCHIVE; site `<h1>`; Game N; opening (bold ECO) · Tablebase. |
| `viewer/MobileHeader.svelte` | Mobile header (52 px): brand link, site over `EventLine`, Flip. |
| `viewer/EventLine.svelte` | The headers' second line, shared by `MobileHeader` and the tablet `Header`: LIVE badge (ARCHIVE on archives and replays), then "Game N · M watching" (no watching count on archives and replays). `tablet` widens the gap to 8 px. |
| `viewer/MobileNavBar.svelte` | Mobile sticky bottom bar (56 px): ≡ "More options" menu (Focus mode, Move sounds, Theme & pieces, All broadcasts; opens upward, roving focus, Esc returns to the button), Start / Previous / Live / Next / Latest. |
| `viewer/DesktopLayout.svelte` | Desktop grid (≥ 1280 px); see "Viewer layouts". |
| `viewer/TabletLayout.svelte` | Tablet grid (768–1279 px); see "Viewer layouts". |
| `viewer/MobileLayout.svelte` | Mobile column (< 768 px); see "Viewer layouts". |
| `viewer/NavControls.svelte` | Desktop/tablet table-column nav block: four equal buttons (40/44 px) over a position label and Following live / Back to live. |
| `viewer/ResizeHandle.svelte` | Desktop board-size drag handle (pointer only); reports `onresize(px, from)`; stored in `board-width`. |
| `viewer/FocusView.svelte` | Focus mode (Esc exits) |
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
- **Score orientation.** TLCS engine scores (`MoveMetaData.score`, `liveData.score`) are from the side to move's view; `whiteScore()` in `lib/format.ts` is the one place they become White's view. Kibitzer scores are already White's: never pass them through `whiteScore()`. `formatScore(score)` shows `+M` / `-M` from |score| ≥ 990 (`MATE_SCORE_THRESHOLD`), with the distance appended when the score encodes one (`+M7`: TLCS mate is ±(100000 − moves)/100 pawns, i.e. ±999.9x, so 1000 would miss it; kibitzer mates are ±10000 and read plain).
- **Graph tabs.** `graphs.ts` `GRAPH_TYPES`: Eval, Depth, Nodes, NPS, Time, WDL (expected score, White's view, fixed 0–100 with a dashed 50 midline) and TB hits. The Depth graph adds a dotted seldepth dataset per side (dataset order: white, black, kibitzer, whiteSel, blackSel; `Series.plies`/`raw` index the same order). Stored WINFO fields are read only by these graphs and `EngineCard`.
- **Replay generations.** `GameStore.beginReplay()` returns a generation; `loadReplay(meta, n, gen)` applies only if no `beginReplay()` / `exitReplay()` happened since. Start every replay fetch with `beginReplay()`, so a slow response can't override a newer Replay, Back to live or Watch.
- **Chat trim.** The server keeps 2000 lines and sends the last 1000 on join (`src/broadcast.ts`). The client trims to the last 2000 once it holds more than 2200, so the keyed list isn't re-indexed on every message.
- **Chat is real.** Only the `chat` event reaches TLCS; `join` and `nick` stay local. Tests must never send chat to a real broadcast.
- **Keyboard.** ←/→/↑/↓ move through the game (`GameStore.onKeydown`); ignored while an input, textarea, select or contenteditable has focus, and with Alt/Ctrl/Meta. Panel tabs have no arrow-key handling on purpose, so the arrows always drive the board.
- **`{@html}`** appears only in `ChatTab.svelte`, for HTML sanitised by DOMPurify with a tag allowlist (`lib/chat.ts`).
