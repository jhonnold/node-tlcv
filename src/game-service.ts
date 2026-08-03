import { ChessGame } from './chess-game.js';
import { logger, normalizeSite, siteSlug } from './util/index.js';
import { Broadcast, username } from './broadcast.js';
import { getWebhookManager } from './broadcast-manager.js';
import { fetchOpening, fetchTablebase } from './services/lichess.js';
import type { OpeningResult } from './services/lichess.js';
import { savePgn } from './services/pgn.js';
import { saveGameMeta } from './services/game-meta.js';
import { saveTournamentResults, loadTournamentResults, invalidateTournament } from './services/tournament-results.js';
import { Command, splitOnCommand } from './protocol.js';
import { commandsProcessed, chatMessages } from './metrics.js';
import { parseResults, parseGames, mergeGames, hasTotalGames } from './services/result-parser.js';
import { replayUciFromFen } from './util/uci.js';
import { colorName } from '../shared/colors.js';
import type { ColorName } from '../shared/colors.js';
import type { BroadcastDelta, ColorCode, GameDelta, MoveMetaData } from '../shared/types.js';

type CommandTokens = [Command, ...Array<string>];

// A handler returns a chat line to emit, or nothing. Everything else it changed is
// signalled through `dirty`, which drives the delta the batch ends up emitting.
type ConfigItem = {
  fn: (tokens: CommandTokens) => Promise<string | void> | string | void;
  split: boolean;
};

type CommandConfig = {
  [key in Command]: ConfigItem;
};

type DirtyKey = 'liveData' | 'clocks' | 'move' | 'movesPatched' | 'players' | 'site' | 'spectators' | 'menu';

// The subset describing the game itself, as opposed to broadcast-level state.
const GAME_KEYS: DirtyKey[] = ['liveData', 'clocks', 'move', 'movesPatched', 'players', 'site'];

type PvUpdate = {
  depth: number;
  score: number;
  nodes: number;
  pvMoveNumber: number;
  san: string[];
  alg: string[];
  fen: string;
};

export type GameServiceResult = {
  update: BroadcastDelta | null;
  chat: string[];
};

class GameService {
  private commandConfig: CommandConfig;
  private broadcast: Broadcast;
  private game: ChessGame;
  private gamesParseTimer: ReturnType<typeof setTimeout> | null = null;
  // Slug the accumulated games table belongs to, so a repeated SITE announcement doesn't
  // re-hydrate and a genuine tournament change does reset.
  private hydratedSlug: string | null = null;
  private dirty = new Set<DirtyKey>();
  private moveCountBefore = 0;
  // Moves whose meta was patched retroactively this batch, and the position the most
  // recent move was played from (the base a trailing PV replays against).
  private patchedMoves = new Set<MoveMetaData>();
  private fenBeforeLastMove: string | null = null;
  // "Game started" detection: armed for the first game, re-armed after each
  // RESULT. Fires once both colors have been (re)announced for the new game.
  private gameStartArmed = true;
  private startColorsSeen = new Set<ColorName>();

  constructor(broadcast: Broadcast) {
    this.broadcast = broadcast;
    this.game = this.broadcast.game;

    this.commandConfig = {
      [Command.FEN]: { fn: this.onFen.bind(this), split: true },
      [Command.WPLAYER]: { fn: this.onPlayer.bind(this), split: false },
      [Command.BPLAYER]: { fn: this.onPlayer.bind(this), split: false },
      [Command.WPV]: { fn: this.onPV.bind(this), split: true },
      [Command.BPV]: { fn: this.onPV.bind(this), split: true },
      [Command.WTIME]: { fn: this.onTime.bind(this), split: true },
      [Command.BTIME]: { fn: this.onTime.bind(this), split: true },
      [Command.WMOVE]: { fn: this.onMove.bind(this), split: true },
      [Command.BMOVE]: { fn: this.onMove.bind(this), split: true },
      [Command.SITE]: { fn: this.onSite.bind(this), split: false },
      [Command.CTRESET]: { fn: this.onCTReset.bind(this), split: false },
      [Command.CT]: { fn: this.onCT.bind(this), split: false },
      [Command.PONG]: { fn: () => {}, split: false },
      [Command.ADDUSER]: { fn: this.onAddUser.bind(this), split: false },
      [Command.DELUSER]: { fn: this.onDelUser.bind(this), split: false },
      [Command.CHAT]: { fn: this.onChat.bind(this), split: false },
      [Command.MENU]: { fn: this.onMenu.bind(this), split: true },
      [Command.RESULT]: { fn: this.onResult.bind(this), split: false },
      [Command.FMR]: { fn: this.onFmr.bind(this), split: false },
      // Recognized but intentionally ignored — connection-time handshake/config
      // lines the viewer derives nothing from (see docs/protocol.md "No-op protocol commands").
      [Command.LOGON]: { fn: () => {}, split: false },
      [Command.FEATURE]: { fn: () => {}, split: false },
      [Command.LEVEL]: { fn: () => {}, split: false },
    };
  }

  private onFmr(tokens: CommandTokens): void {
    const [, fmr] = tokens;

    this.game.fmr = parseInt(fmr);
    logger.debug(`Updated game ${this.game.name} - FMR: ${this.game.fmr}`, {
      port: this.broadcast.port,
    });
  }

  private onFen(tokens: CommandTokens): void {
    const [, ...fenTokens] = tokens;
    const lastToken = fenTokens.slice(-1)[0];

    // Sometimes we don't get castling info
    if (lastToken === 'w' || lastToken === 'b') fenTokens.push('-');

    // Always push on ep square
    fenTokens.push('-');

    this.game.fen = fenTokens.join(' '); // build the fen

    if (!this.game.loaded) {
      this.game.resetFromFen();
      this.dirty.add('move').add('liveData');
      logger.info(`Unloaded game ${this.game.name}, setting to FEN: ${this.game.instance.fen()}`, {
        port: this.broadcast.port,
      });
    } else if (this.game.fen.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq')) {
      // Reset everything on startpos
      this.game.reset();
      this.dirty.add('move').add('liveData');
      logger.info(`Received startpos for game ${this.game.name}, reseting the game.`, { port: this.broadcast.port });
    } else {
      logger.debug(`Set backup FEN for ${this.game.name}: ${this.game.fen}`, { port: this.broadcast.port });
    }
  }

  private onPlayer(tokens: CommandTokens): void {
    const [command, ...rest] = tokens;
    const name = rest.join(' ');

    const color = colorName(command === Command.WPLAYER ? 'w' : 'b');
    this.game[color].reset();
    this.game[color].name = name;
    this.game.liveData.reset(this.game.instance.turn(), this.game.moveNumber);
    logger.info(`Updated game ${this.game.name} - Color: ${color}, Name: ${this.game[color].name}`, {
      port: this.broadcast.port,
    });

    this.dirty.add('players').add('liveData');

    // onPlayer fires once per color. Notify "game started" exactly once, when
    // both colors have been announced for this game (independent of the
    // 100ms-debounced currentGameNumber advance).
    if (this.gameStartArmed) {
      this.startColorsSeen.add(color);
      if (this.startColorsSeen.size === 2) {
        this.gameStartArmed = false;
        this.startColorsSeen.clear();
        getWebhookManager()?.dispatch({
          kind: 'game-started',
          port: this.broadcast.port,
          gameNumber: this.broadcast.currentGameNumber,
          white: this.game.white.name,
          black: this.game.black.name,
          site: this.game.site,
        });
      }
    }
  }

  // WPV/BPV payloads are positional: depth score time nodes pv...
  private parsePvTokens(rest: string[]): {
    depth: number;
    score: number;
    nodes: number;
    usedTime: number;
    pv: string[];
  } {
    const [depthStr, scoreStr, timeStr, nodesStr, ...pv] = rest;

    return {
      depth: parseInt(depthStr),
      score: parseInt(scoreStr) / 100,
      nodes: parseInt(nodesStr),
      usedTime: parseInt(timeStr) * 10,
      pv,
    };
  }

  private applyPvToMeta(meta: MoveMetaData, { depth, score, nodes, pvMoveNumber, san, alg, fen }: PvUpdate): void {
    meta.depth = depth;
    meta.score = score;
    meta.nodes = nodes;
    meta.pv = san.length ? [...san] : null;
    meta.pvFen = fen;
    meta.pvMoveNumber = pvMoveNumber;
    meta.pvFollowup = alg[1] || null;
    meta.pvAlg = alg[0] || null;

    this.game.instance.setComment(`(${san.join(' ')}) ${score.toFixed(2)}/${depth} ${meta.time ?? 0}`);
  }

  // A PV for the non-thinking color may be that engine's final flush for the move it
  // just played (see the "optional trailing XPV flush" in docs/protocol.md). If so,
  // patch the recorded move's meta rather than dropping the line.
  private applyTrailingPv(colorCode: ColorCode, rest: string[]): void {
    const lastMove = this.game.moveMeta[this.game.moveMeta.length - 1];
    if (!lastMove || lastMove.color !== colorCode || !this.fenBeforeLastMove) return;

    const { depth, score, nodes, pv } = this.parsePvTokens(rest);
    if (!Number.isFinite(depth) || !Number.isFinite(score) || !Number.isFinite(nodes)) return;

    // A shallower line is a stale iteration, not the final flush.
    if (depth < (lastMove.depth ?? 0)) return;

    // The trailing PV describes the search that produced the move just played, so it
    // replays from the position that move was made from.
    const playout = replayUciFromFen(this.fenBeforeLastMove, pv);
    // The PV must open with the move actually played; otherwise it belongs to a
    // different position and must not overwrite this move's meta.
    if (!playout || playout.san[0] !== lastMove.move) return;

    this.applyPvToMeta(lastMove, { depth, score, nodes, pvMoveNumber: lastMove.number, ...playout });

    logger.info(
      `Updated game ${this.game.name} - Trailing PV for move ${lastMove.number}: Color: ${colorCode}, Depth: ${depth}, Score: ${score}, Nodes: ${nodes}`,
      { port: this.broadcast.port },
    );

    this.patchedMoves.add(lastMove);
    this.dirty.add('movesPatched');
  }

  private onPV(tokens: CommandTokens): void {
    const [command, ...rest] = tokens;

    const color: ColorCode = command === Command.WPV ? 'w' : 'b';

    // Discard PV updates for the non-thinking color (handles stale post-move flush, issue #9),
    // unless it is the trailing flush for the move that color just played.
    if (color !== this.game.liveData.color) {
      this.applyTrailingPv(color, rest);
      return;
    }

    const parsed = this.parsePvTokens(rest);
    this.game.liveData.depth = parsed.depth;
    this.game.liveData.score = parsed.score;
    this.game.liveData.nodes = parsed.nodes;
    this.game.liveData.usedTime = parsed.usedTime;

    const playout = replayUciFromFen(this.game.instance.fen(), parsed.pv);
    if (playout) {
      this.game.liveData.pv = playout.san;
      this.game.liveData.pvAlg = playout.alg;
      this.game.liveData.pvFen = playout.fen;
    }

    // 20-60 PV lines land per move per broadcast, so these stay off the default level.
    logger.debug(
      `Updated game ${this.game.name} - Color: ${color}, Depth: ${this.game.liveData.depth}, Score: ${this.game.liveData.score}, Nodes: ${this.game.liveData.nodes}, UsedTime: ${this.game.liveData.usedTime}`,
      { port: this.broadcast.port },
    );
    logger.debug(
      `Updated game ${this.game.name} - Color: ${color}, PVFen: ${
        this.game.liveData.pvFen
      }, PV: ${this.game.liveData.pv.join(' ')}`,
      {
        port: this.broadcast.port,
      },
    );

    this.dirty.add('liveData');
  }

  private onTime(tokens: CommandTokens): void {
    const [command, ...rest] = tokens;

    const color = colorName(command === Command.WTIME ? 'w' : 'b');
    this.game[color].clockTime = parseInt(rest[0]) * 10;

    logger.debug(`Updated game ${this.game.name} - Color: ${color}, ClockTime: ${this.game[color].clockTime}`, {
      port: this.broadcast.port,
    });

    this.dirty.add('clocks');
  }

  private async onMove(tokens: CommandTokens): Promise<void> {
    const [command, ...rest] = tokens;

    const code: ColorCode = command === Command.WMOVE ? 'w' : 'b';
    const nextColorCode: ColorCode = code === 'w' ? 'b' : 'w';
    const color = colorName(code);
    const notColor = colorName(nextColorCode);

    this.game.moveNumber = parseInt(rest[0].replace('.', ''));
    const nextPvMoveNumber = code === 'w' ? this.game.moveNumber : this.game.moveNumber + 1;

    try {
      const fenBefore = this.game.instance.fen();
      const move = this.game.instance.move(rest[1], { strict: false });
      this.fenBeforeLastMove = fenBefore;
      this.game.uciHistory.push(`${move.from}${move.to}`);

      this.game[color].lastMove = move;
      logger.info(`Updated game ${this.game.name} - Color: ${color}, Last Move: ${this.game[color].lastMove?.san}`, {
        port: this.broadcast.port,
      });

      const meta: MoveMetaData = {
        color: code,
        number: this.game.moveNumber,
        move: move.san,
        depth: null,
        score: null,
        nodes: null,
        time:
          this.game[color].startTime > 0
            ? Math.round((new Date().getTime() - this.game[color].startTime) / 1000)
            : null,
        pv: null,
        pvFen: null,
        pvMoveNumber: null,
        pvFollowup: null,
        pvAlg: null,
        kibitzer: null,
      };
      this.game.moveMeta.push(meta);

      if (this.game.liveData.depth > 0) {
        meta.kibitzer = this.broadcast.kibitzerManager?.snapshotForMove(this.broadcast.port) ?? null;
        this.applyPvToMeta(meta, {
          depth: this.game.liveData.depth,
          score: this.game.liveData.score,
          nodes: this.game.liveData.nodes,
          pvMoveNumber: this.game.liveData.pvMoveNumber,
          san: this.game.liveData.pv,
          alg: this.game.liveData.pvAlg,
          fen: this.game.liveData.pvFen,
        });
      } else {
        this.game.instance.setComment('(Book)');
      }

      // Reset liveData for the next thinker
      this.game.liveData.reset(nextColorCode, nextPvMoveNumber);
    } catch {
      logger.warn(
        `Failed to parse ${rest[1]} for game ${this.game.name}, fen ${this.game.instance.fen()}! Loading from FEN...`,
        { port: this.broadcast.port },
      );
      this.game.resetFromFen();
    }

    // start the timer for the other side
    this.game[notColor].startTime = new Date().getTime();
    this.dirty.add('clocks');

    this.broadcast.kibitzerManager?.onPositionChange(this.broadcast.port, this.game.instance.fen());

    const skipOpening = this.game.openingLookupDisabled || this.game.startFen !== null;

    const [openingResult, tablebase] = await Promise.all([
      skipOpening
        ? Promise.resolve<OpeningResult>({ failed: false, opening: null })
        : fetchOpening(this.game.name, this.game.uciHistory),
      fetchTablebase(this.game.name, this.game.fen, this.game.instance.turn()),
    ]);

    if (openingResult.failed) {
      this.game.openingLookupDisabled = true;
    } else if (openingResult.opening) {
      this.game.opening = openingResult.opening;
    }
    this.game.tablebase = tablebase;

    this.dirty.add('move').add('liveData');
  }

  private async onSite(tokens: CommandTokens): Promise<void> {
    const previousSite = this.game.site;

    this.game.site = normalizeSite(tokens.slice(1).join(' '));
    this.dirty.add('site');

    logger.info(`Updated game ${this.game.name} - Site: ${this.game.site}`, { port: this.broadcast.port });

    // SITE is re-announced once per game, so only a genuine tournament change is worth
    // acting on — dropping the caches on every announcement forces a full archive
    // re-scan per finished game.
    const slug = siteSlug(this.game.site);
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

  private async onResult(tokens: CommandTokens): Promise<string> {
    const message = `[Server] - Game ${this.broadcast.currentGameNumber}: ${this.game.white.name} - ${
      this.game.black.name
    } (${tokens[1].trim()})`;
    this.broadcast.pushChat(message);

    const result = tokens[1].trim();
    this.game.instance.header('Result', result);

    await savePgn(this.game, this.broadcast.port, this.broadcast.currentGameNumber);
    await saveGameMeta(this.game, this.broadcast.port, this.broadcast.currentGameNumber, result);

    getWebhookManager()?.dispatch({
      kind: 'game-finished',
      port: this.broadcast.port,
      gameNumber: this.broadcast.currentGameNumber,
      white: this.game.white.name,
      black: this.game.black.name,
      site: this.game.site,
      result,
      opening: this.game.opening,
    });

    // Re-arm "game started" detection for the next game.
    this.gameStartArmed = true;
    this.startColorsSeen.clear();

    this.broadcast.reloadResults();

    return message;
  }

  private buildGameDelta(): GameDelta {
    const d = this.dirty;
    const gameDelta: GameDelta = {};

    if (d.has('players')) {
      gameDelta.white = this.game.white.toJSON();
      gameDelta.black = this.game.black.toJSON();
      gameDelta.startFen = this.game.startFen;
      gameDelta.resetMoves = true;
    }

    if (d.has('clocks')) {
      gameDelta.white = this.game.white.toJSON();
      gameDelta.black = this.game.black.toJSON();
    }

    if (d.has('site')) {
      gameDelta.site = this.game.site;
    }

    if (d.has('move')) {
      gameDelta.fen = this.game.instance.fen();
      gameDelta.stm = this.game.instance.turn();
      gameDelta.opening = this.game.opening;
      gameDelta.tablebase = this.game.tablebase;

      const newMoves = this.game.moveMeta.slice(this.moveCountBefore);
      if (newMoves.length > 0) {
        gameDelta.newMoves = newMoves;
      }

      // If moveMeta was cleared (resetFromFen / reset), signal a reset
      if (this.game.moveMeta.length < this.moveCountBefore) {
        gameDelta.resetMoves = true;
        gameDelta.startFen = this.game.startFen;
      }
    }

    if (d.has('movesPatched')) {
      // Filtering moveMeta by identity drops entries a reset() discarded mid-batch.
      const updatedMoves = this.game.moveMeta.filter((m) => this.patchedMoves.has(m));
      if (updatedMoves.length > 0) {
        gameDelta.updatedMoves = updatedMoves;
      }
    }

    if (d.has('liveData') || d.has('move') || d.has('players')) {
      gameDelta.liveData = this.game.liveData.toJSON();
    }

    return gameDelta;
  }

  private buildDelta(): BroadcastDelta {
    const delta: BroadcastDelta = {};

    if (GAME_KEYS.some((key) => this.dirty.has(key))) {
      delta.game = this.buildGameDelta();
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
    this.dirty.clear();
    this.moveCountBefore = this.game.moveMeta.length;
    this.patchedMoves.clear();
    const chatEmit: string[] = [];

    for (const [cmd, rest] of this.categorizeMessages(messages)) {
      const commandConfig = this.commandConfig[cmd];

      const chat = await commandConfig.fn(commandConfig.split ? [cmd, ...rest.trim().split(/\s+/)] : [cmd, rest]);

      commandsProcessed.inc({ port: String(this.broadcast.port), command: cmd });

      if (chat) chatEmit.push(chat);
    }

    const update = this.dirty.size > 0 ? this.buildDelta() : null;

    logger.debug(`Successfully processed ${messages.length} message(s)`, { port: this.broadcast.port });

    return { update, chat: chatEmit };
  }
}

export default GameService;
