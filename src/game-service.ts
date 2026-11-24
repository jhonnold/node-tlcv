import { logger, normalizeSite, siteSlug } from './util/index.js';
import { Broadcast, username } from './broadcast.js';
import { saveTournamentResults, loadTournamentResults, invalidateTournament } from './services/tournament-results.js';
import { Command, PROVES_LIVENESS, parseLine } from './protocol.js';
import type { ParsedLine } from './protocol.js';
import { commandsProcessed, chatMessages } from './metrics.js';
import { parseResults, parseGames, mergeGames, hasTotalGames } from './services/result-parser.js';
import { isBoardCommand } from './board-service.js';
import type BoardService from './board-service.js';
import type { BoardCommand, CommandTokens, ConfigItem } from './board-service.js';
import type { BroadcastDelta, GameDelta } from '../shared/types.js';

// Broadcast-level commands only; the per-game ones belong to BoardService (see `isBoardCommand`).
// BOARD never reaches dispatch: parseLine() unwraps it into its inner game line.
type CommandConfig = {
  [key in Exclude<Command, BoardCommand | Command.BOARD>]: ConfigItem;
};

function toTokens(cmd: Command, arg: string, split: boolean): CommandTokens {
  return split ? [cmd, ...arg.trim().split(/\s+/)] : [cmd, arg];
}

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
      [Command.LOGON]: { fn: this.onLogon.bind(this), split: false },
      // Recognized but intentionally ignored — a connection-time config line the viewer
      // derives nothing from (see docs/protocol.md "No-op protocol commands").
      [Command.FEATURE]: { fn: () => {}, split: false },
      [Command.MSG]: { fn: this.onServerMessage.bind(this), split: false },
      [Command.MULTIGAME]: { fn: (tokens) => this.broadcast.onMultigameReply(tokens[1]), split: false },
      [Command.BOARDS]: { fn: this.onBoards.bind(this), split: true },
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

  private onLogon(tokens: CommandTokens): void {
    if (tokens[1] === 'SUCCESSFUL') this.broadcast.onLogonSuccessful();
  }

  // TLCS-MG `BOARDS: 1 2 3`: every board that exists. New ids are new boards (never removed in v1).
  private onBoards(tokens: CommandTokens): void {
    if (this.broadcast.multigameMode !== 'mg') {
      logger.debug(`Dropping BOARDS outside TLCS-MG mode`, { port: this.broadcast.port });
      return;
    }

    for (const token of tokens.slice(1)) {
      const id = Number(token);
      if (Number.isInteger(id) && id > 0) this.broadcast.ensureBoard(id);
    }
  }

  /**
   * The board a game line is for, or null to drop it. Bare lines are board 1's until TLCS-MG
   * mode, where only `BOARD <id>` lines carry games. A wrapped line outside `mg` means the
   * opt-in reply was lost; the retry brings a fresh snapshot.
   */
  private boardFor(id: number | null): BoardService | null {
    const mg = this.broadcast.multigameMode === 'mg';

    if (id === null) {
      if (!mg) return this.broadcast.boards.get(1)!;
      logger.debug('Dropping a bare game line in TLCS-MG mode', { port: this.broadcast.port });
      return null;
    }

    if (!mg) {
      logger.debug(`Dropping a BOARD ${id} line outside TLCS-MG mode`, { port: this.broadcast.port });
      return null;
    }

    if (!this.broadcast.boards.has(id)) {
      logger.warn(`BOARD ${id} is not in any BOARDS list yet, adding it`, { port: this.broadcast.port });
    }
    return this.broadcast.ensureBoard(id);
  }

  /** Waits for every board's queued game lines, then rethrows the first failure. */
  private async settle(queued: Map<BoardService, Promise<void>>): Promise<void> {
    if (!queued.size) return;

    const results = await Promise.allSettled(queued.values());
    queued.clear();
    for (const r of results) if (r.status === 'rejected') throw r.reason;
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

  private categorizeMessages(messages: string[]): ParsedLine[] {
    const ready: ParsedLine[] = [];

    for (const msg of messages) {
      const parsed = parseLine(msg);
      // A BOARD line must wrap a game line (spec §5); anything else is as unknown as a bad token.
      if (!parsed || (parsed.board !== null && !isBoardCommand(parsed.command))) {
        logger.warn(`Unable to process ${msg}!`, { port: this.broadcast.port });
        continue;
      }

      ready.push(parsed);
    }

    return ready;
  }

  async onMessages(messages: string[]): Promise<GameServiceResult> {
    this.dirty.clear();
    for (const b of this.broadcast.boards.values()) b.beginBatch();
    const chatEmit: string[] = [];
    let sawLiveData = false;
    // Game lines are queued per board: in order within a board, boards concurrently (a result
    // awaits its saves). A broadcast line first waits for every queued line — SITE
    // must not overtake a result's save, MULTIGAME/BOARDS change where later lines go — and
    // the lines after it queue behind it.
    const queued = new Map<BoardService, Promise<void>>();

    for (const { board: boardId, command: cmd, arg } of this.categorizeMessages(messages)) {
      if (isBoardCommand(cmd)) {
        const board = this.boardFor(boardId);
        if (!board) continue;

        const { fn, split } = board.commandConfig[cmd];
        const tokens = toTokens(cmd, arg, split);
        const previous = queued.get(board) ?? Promise.resolve();
        queued.set(
          board,
          previous.then(async () => {
            const chat = await fn(tokens);
            if (chat) chatEmit.push(chat);
          }),
        );
      } else {
        await this.settle(queued);

        const { fn, split } = this.commandConfig[cmd];
        const chat = await fn(toTokens(cmd, arg, split));
        if (chat) chatEmit.push(chat);
      }

      if (PROVES_LIVENESS[cmd]) sawLiveData = true;
      commandsProcessed.inc({ port: String(this.broadcast.port), command: cmd });
    }

    await this.settle(queued);
    // One Lichess lookup per board, for the position its game is left in, rather than one per move.
    await Promise.all([...this.broadcast.boards.values()].map((b) => b.lookUpPosition()));

    // Only board 1 reaches browsers for now; boards >= 2 are tracked and archived silently.
    const gameDelta = this.broadcast.boards.get(1)!.takeDelta();
    const update = gameDelta || this.dirty.size > 0 ? this.buildDelta(gameDelta) : null;

    logger.debug(`Successfully processed ${messages.length} message(s)`, { port: this.broadcast.port });

    return { update, chat: chatEmit, sawLiveData };
  }
}

export default GameService;
