import { logger, normalizeSite, siteSlug } from './util/index.js';
import { Broadcast, username } from './broadcast.js';
import { saveTournamentResults, loadTournamentResults, invalidateTournament } from './services/tournament-results.js';
import { Command, PROVES_LIVENESS, splitOnCommand } from './protocol.js';
import { commandsProcessed, chatMessages } from './metrics.js';
import { parseResults, parseGames, mergeGames, hasTotalGames } from './services/result-parser.js';
import { isBoardCommand } from './board-service.js';
import type { BoardCommand, CommandTokens, ConfigItem } from './board-service.js';
import type { BroadcastDelta, GameDelta } from '../shared/types.js';

// Broadcast-level commands only; the per-game ones belong to BoardService (see `isBoardCommand`).
type CommandConfig = {
  [key in Exclude<Command, BoardCommand>]: ConfigItem;
};

type DirtyKey = 'spectators' | 'menu';

export type GameServiceResult = {
  update: BroadcastDelta | null;
  chat: string[];
  /** Whether the batch held anything proving the session still feeds us — see `PROVES_LIVENESS`. */
  sawLiveData: boolean;
};

class GameService {
  private commandConfig: CommandConfig;
  private broadcast: Broadcast;
  private gamesParseTimer: ReturnType<typeof setTimeout> | null = null;
  // Slug the accumulated games table belongs to, so a repeated SITE announcement doesn't
  // re-hydrate and a genuine tournament change does reset.
  private hydratedSlug: string | null = null;
  private dirty = new Set<DirtyKey>();

  constructor(broadcast: Broadcast) {
    this.broadcast = broadcast;

    this.commandConfig = {
      [Command.SITE]: { fn: this.onSite.bind(this), split: false },
      [Command.CTRESET]: { fn: this.onCTReset.bind(this), split: false },
      [Command.CT]: { fn: this.onCT.bind(this), split: false },
      [Command.PONG]: { fn: () => {}, split: false },
      [Command.ADDUSER]: { fn: this.onAddUser.bind(this), split: false },
      [Command.DELUSER]: { fn: this.onDelUser.bind(this), split: false },
      [Command.CHAT]: { fn: this.onChat.bind(this), split: false },
      [Command.MENU]: { fn: this.onMenu.bind(this), split: true },
      // Recognized but intentionally ignored — connection-time handshake/config
      // lines the viewer derives nothing from (see docs/protocol.md "No-op protocol commands").
      [Command.LOGON]: { fn: () => {}, split: false },
      [Command.FEATURE]: { fn: () => {}, split: false },
      [Command.MSG]: { fn: this.onServerMessage.bind(this), split: false },
    };
  }

  /**
   * Out-of-band server notice. The one that matters is the logout announcement —
   * TLCS keeps answering our PINGs afterwards, so without acting on this the
   * broadcast silently sits dead until the process is restarted.
   */
  private onServerMessage(tokens: CommandTokens): void {
    const [, text] = tokens;

    logger.warn(`Server message: ${text}`, { port: this.broadcast.port });
    if (/no longer connected/i.test(text)) this.broadcast.relogin('server-notice');
  }

  private async onSite(tokens: CommandTokens): Promise<void> {
    const previousSite = this.broadcast.site;

    this.broadcast.site = normalizeSite(tokens.slice(1).join(' '));
    for (const board of this.broadcast.boards.values()) board.markSiteDirty();

    logger.info(`Updated game ${this.broadcast.game.name} - Site: ${this.broadcast.site}`, {
      port: this.broadcast.port,
    });

    // SITE is re-announced once per game, so only a genuine tournament change is worth
    // acting on — dropping the caches on every announcement forces a full archive
    // re-scan per finished game.
    const slug = siteSlug(this.broadcast.site);
    if (slug === this.hydratedSlug) return;

    // The old slug has moved out of the live set (it is archived now) and a new
    // pgns/<slug>/ folder may appear, so everything derived from either is stale.
    if (previousSite) invalidateTournament(siteSlug(previousSite));
    invalidateTournament(slug);

    // Drop the previous tournament's accumulated table, then seed from
    // pgns/<slug>/tournament-results.json so a restart mid-tournament keeps games the
    // server's ~300-game window has already scrolled past.
    if (this.hydratedSlug !== null) {
      this.broadcast.results = '';
      this.broadcast.parsedResults = null;
      this.broadcast.parsedGames = null;
    }

    const stored = await loadTournamentResults(slug);
    // Live records win: a CT dump can land before SITE (reloadResults() fires at construction).
    const merged = mergeGames(stored?.parsedGames ?? [], this.broadcast.parsedGames ?? []);
    this.broadcast.parsedGames = merged.length ? merged : null;
    this.hydratedSlug = slug;
  }

  private onCTReset(): void {
    this.broadcast.results = '';
    this.broadcast.parsedResults = null;
    // parsedGames deliberately survives — CTRESET precedes every dump, and the dump only
    // carries the most recent ~300 games. onCT merges the new batch into what we have.

    if (this.gamesParseTimer) {
      clearTimeout(this.gamesParseTimer);
      this.gamesParseTimer = null;
    }
  }

  private onCT(tokens: CommandTokens): void {
    this.broadcast.results += `${tokens[1]}\n`;

    if (hasTotalGames(tokens[1])) {
      this.broadcast.parsedResults = parseResults(this.broadcast.results);
    }

    // Debounce games parsing — games data arrives after the result table
    // and the end of the stream is detected by a 100ms gap
    if (this.gamesParseTimer) clearTimeout(this.gamesParseTimer);
    this.gamesParseTimer = setTimeout(() => {
      const games = parseGames(this.broadcast.results);
      if (games.length > 0) {
        // Derive from the raw batch, not the merged list — `games` is in dump order (newest
        // first) while the merged list spans the whole tournament.
        this.broadcast.currentGameNumber = games[0].gameNumber + 1;
        this.broadcast.parsedGames = mergeGames(this.broadcast.parsedGames, games);

        // Persist the latest standings + schedule (fixed filename, overwritten each dump).
        // Fire-and-forget: saveTournamentResults catches all errors internally.
        saveTournamentResults(this.broadcast.toStoredResults());
      }
      this.gamesParseTimer = null;
    }, 100);
  }

  private onAddUser(tokens: CommandTokens): void {
    if (username === tokens[1] || this.broadcast.spectators.has(tokens[1])) return;

    this.broadcast.spectators.add(tokens[1]);
    this.dirty.add('spectators');
  }

  private onDelUser(tokens: CommandTokens): void {
    if (this.broadcast.spectators.delete(tokens[1])) this.dirty.add('spectators');
  }

  private onChat(tokens: CommandTokens): string | void {
    chatMessages.inc({ port: String(this.broadcast.port) });
    // Disable connection messages. TODO: Make this configurable
    if (tokens[1].endsWith('has arrived!') || tokens[1].endsWith('has left!')) return;

    this.broadcast.pushChat(tokens[1]);
    return tokens[1];
  }

  private onMenu(tokens: CommandTokens): void {
    let nameIdx = -1;
    let valueIdx = -1;

    tokens.forEach((v, i) => {
      if (v.startsWith('NAME=')) nameIdx = i;
      if (v.startsWith('URL=')) valueIdx = i;
    });

    if (nameIdx === -1 || valueIdx === -1) return;

    const name = tokens[nameIdx].slice('NAME="'.length, -1).toLowerCase();
    const url = tokens[valueIdx].slice('URL="'.length, -1);

    this.broadcast.menu.set(name, url);

    logger.info(`Updated broadcast ${this.broadcast.port} Menu - Name: ${name}, Value: ${url}`, {
      port: this.broadcast.port,
    });

    this.dirty.add('menu');
  }

  private buildDelta(game: GameDelta | null): BroadcastDelta {
    const delta: BroadcastDelta = {};

    if (game) {
      delta.game = game;
    }

    if (this.dirty.has('spectators')) {
      delta.spectators = Array.from(this.broadcast.spectators);
    }

    if (this.dirty.has('menu')) {
      delta.menu = Object.fromEntries(this.broadcast.menu);
    }

    return delta;
  }

  private categorizeMessages(messages: string[]): [Command, string][] {
    const ready: [Command, string][] = [];

    for (const msg of messages) {
      const parsed = splitOnCommand(msg);
      if (!parsed) {
        logger.warn(`Unable to process ${msg}!`, { port: this.broadcast.port });
        continue;
      }

      ready.push(parsed);
    }

    return ready;
  }

  async onMessages(messages: string[]): Promise<GameServiceResult> {
    // Classic TLCS carries a single game, so every game line goes to board 1.
    const board = this.broadcast.boards.get(1)!;
    this.dirty.clear();
    for (const b of this.broadcast.boards.values()) b.beginBatch();
    const chatEmit: string[] = [];
    let sawLiveData = false;

    for (const [cmd, rest] of this.categorizeMessages(messages)) {
      const commandConfig = isBoardCommand(cmd) ? board.commandConfig[cmd] : this.commandConfig[cmd];
      if (PROVES_LIVENESS[cmd]) sawLiveData = true;

      const chat = await commandConfig.fn(commandConfig.split ? [cmd, ...rest.trim().split(/\s+/)] : [cmd, rest]);

      commandsProcessed.inc({ port: String(this.broadcast.port), command: cmd });

      if (chat) chatEmit.push(chat);
    }

    const gameDelta = board.takeDelta();
    const update = gameDelta || this.dirty.size > 0 ? this.buildDelta(gameDelta) : null;

    logger.debug(`Successfully processed ${messages.length} message(s)`, { port: this.broadcast.port });

    return { update, chat: chatEmit, sawLiveData };
  }
}

export default GameService;
