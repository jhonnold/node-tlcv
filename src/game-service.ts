import { Chess } from 'chess.js';
import { ChessGame } from './chess-game.js';
import { logger, siteSlug } from './util/index.js';
import { Broadcast, username } from './broadcast.js';
import { getWebhookManager } from './broadcast-manager.js';
import { fetchOpening, fetchTablebase } from './services/lichess.js';
import type { OpeningResult } from './services/lichess.js';
import { savePgn } from './services/pgn.js';
import { saveGameMeta, invalidate as invalidateMetaCache } from './services/game-meta.js';
import {
  saveTournamentResults,
  loadTournamentResults,
  invalidateArchiveCache,
  invalidateListingCache,
} from './services/tournament-results.js';
import { invalidate as invalidatePgnCache } from './services/pgn-cache.js';
import { Command, splitOnCommand } from './protocol.js';
import { EmitType } from './socket-io-adapter.js';
import { commandsProcessed, chatMessages } from './metrics.js';
import { parseResults, parseGames, mergeGames } from './services/result-parser.js';
import { menuToObject } from './broadcast-state.js';
import { replayUci } from './util/uci.js';
import type { BroadcastDelta, ColorCode, GameDelta, MoveMetaData } from '../shared/types.js';

type Color = 'white' | 'black';

type CommandTokens = [Command, ...Array<string>];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UpdateResult = [EmitType, boolean, ...Array<any>];

type ConfigItem = {
  fn: (tokens: CommandTokens) => Promise<UpdateResult> | UpdateResult;
  split: boolean;
};

type CommandConfig = {
  [key in Command]: ConfigItem;
};

type DirtyFlags = {
  liveData: boolean;
  clocks: boolean;
  move: boolean;
  movesPatched: boolean;
  players: boolean;
  site: boolean;
  spectators: boolean;
  menu: boolean;
};

function freshFlags(): DirtyFlags {
  return {
    liveData: false,
    clocks: false,
    move: false,
    movesPatched: false,
    players: false,
    site: false,
    spectators: false,
    menu: false,
  };
}

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
  private dirty: DirtyFlags = freshFlags();
  private moveCountBefore = 0;
  // Moves whose meta was patched retroactively this batch, and the position the most
  // recent move was played from (the base a trailing PV replays against).
  private patchedMoves = new Set<MoveMetaData>();
  private fenBeforeLastMove: string | null = null;
  // "Game started" detection: armed for the first game, re-armed after each
  // RESULT. Fires once both colors have been (re)announced for the new game.
  private gameStartArmed = true;
  private startColorsSeen = new Set<Color>();

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
      [Command.PONG]: { fn: () => [EmitType.UPDATE, false], split: false },
      [Command.ADDUSER]: { fn: this.onAddUser.bind(this), split: false },
      [Command.DELUSER]: { fn: this.onDelUser.bind(this), split: false },
      [Command.CHAT]: { fn: this.onChat.bind(this), split: false },
      [Command.MENU]: { fn: this.onMenu.bind(this), split: true },
      [Command.RESULT]: { fn: this.onResult.bind(this), split: false },
      [Command.FMR]: { fn: this.onFmr.bind(this), split: false },
      // Recognized but intentionally ignored — connection-time handshake/config
      // lines the viewer derives nothing from (see docs/protocol.md "No-op protocol commands").
      [Command.LOGON]: { fn: () => [EmitType.UPDATE, false], split: false },
      [Command.FEATURE]: { fn: () => [EmitType.UPDATE, false], split: false },
      [Command.LEVEL]: { fn: () => [EmitType.UPDATE, false], split: false },
    };
  }

  private onFmr(tokens: CommandTokens): UpdateResult {
    const [, fmr] = tokens;

    this.game.fmr = parseInt(fmr);
    logger.info(`Updated game ${this.game.name} - FMR: ${this.game.fmr}`, {
      port: this.broadcast.port,
    });

    return [EmitType.UPDATE, false];
  }

  private onFen(tokens: CommandTokens): UpdateResult {
    const [, ...fenTokens] = tokens;
    const lastToken = fenTokens.slice(-1)[0];

    // Sometimes we don't get castling info
    if (lastToken === 'w' || lastToken === 'b') fenTokens.push('-');

    // Always push on ep square
    fenTokens.push('-');

    this.game.fen = fenTokens.join(' '); // build the fen

    if (!this.game.loaded) {
      this.game.resetFromFen();
      this.dirty.move = true;
      this.dirty.liveData = true;
      logger.info(`Unloaded game ${this.game.name}, setting to FEN: ${this.game.instance.fen()}`, {
        port: this.broadcast.port,
      });
    } else if (this.game.fen.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq')) {
      // Reset everything on startpos
      this.game.reset();
      this.dirty.move = true;
      this.dirty.liveData = true;
      logger.info(`Received startpos for game ${this.game.name}, reseting the game.`, { port: this.broadcast.port });
    } else {
      logger.info(`Set backup FEN for ${this.game.name}: ${this.game.fen}`, { port: this.broadcast.port });
    }

    return [EmitType.UPDATE, false];
  }

  private onPlayer(tokens: CommandTokens): UpdateResult {
    const [command, ...rest] = tokens;
    const name = rest.join(' ');

    const color: Color = command === Command.WPLAYER ? 'white' : 'black';
    this.game[color].reset();
    this.game[color].name = name;
    this.game.liveData.reset(this.game.instance.turn(), this.game.moveNumber);
    logger.info(`Updated game ${this.game.name} - Color: ${color}, Name: ${this.game[color].name}`, {
      port: this.broadcast.port,
    });

    this.dirty.players = true;
    this.dirty.liveData = true;

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

    return [EmitType.UPDATE, false];
  }

  private playoutPV(pv: string[]): { san: string[]; alg: string[]; fen: string } | null {
    return replayUci(new Chess(this.game.instance.fen()), pv);
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
    const playout = replayUci(new Chess(this.fenBeforeLastMove), pv);
    // The PV must open with the move actually played; otherwise it belongs to a
    // different position and must not overwrite this move's meta.
    if (!playout || playout.san[0] !== lastMove.move) return;

    this.applyPvToMeta(lastMove, { depth, score, nodes, pvMoveNumber: lastMove.number, ...playout });

    logger.info(
      `Updated game ${this.game.name} - Trailing PV for move ${lastMove.number}: Color: ${colorCode}, Depth: ${depth}, Score: ${score}, Nodes: ${nodes}`,
      { port: this.broadcast.port },
    );

    this.patchedMoves.add(lastMove);
    this.dirty.movesPatched = true;
  }

  private onPV(tokens: CommandTokens): UpdateResult {
    const [command, ...rest] = tokens;

    const colorCode: ColorCode = command === Command.WPV ? 'w' : 'b';

    // Discard PV updates for the non-thinking color (handles stale post-move flush, issue #9),
    // unless it is the trailing flush for the move that color just played.
    if (colorCode !== this.game.liveData.color) {
      this.applyTrailingPv(colorCode, rest);
      return [EmitType.UPDATE, false];
    }

    const parsed = this.parsePvTokens(rest);
    this.game.liveData.depth = parsed.depth;
    this.game.liveData.score = parsed.score;
    this.game.liveData.nodes = parsed.nodes;
    this.game.liveData.usedTime = parsed.usedTime;

    const playout = this.playoutPV(parsed.pv);
    if (playout) {
      this.game.liveData.pv = playout.san;
      this.game.liveData.pvAlg = playout.alg;
      this.game.liveData.pvFen = playout.fen;
    }

    logger.info(
      `Updated game ${this.game.name} - Color: ${colorCode}, Depth: ${this.game.liveData.depth}, Score: ${this.game.liveData.score}, Nodes: ${this.game.liveData.nodes}, UsedTime: ${this.game.liveData.usedTime}`,
      { port: this.broadcast.port },
    );
    logger.info(
      `Updated game ${this.game.name} - Color: ${colorCode}, PVFen: ${
        this.game.liveData.pvFen
      }, PV: ${this.game.liveData.pv.join(' ')}`,
      {
        port: this.broadcast.port,
      },
    );

    this.dirty.liveData = true;
    return [EmitType.UPDATE, false];
  }

  private onTime(tokens: CommandTokens): UpdateResult {
    const [command, ...rest] = tokens;

    const color: Color = command === Command.WTIME ? 'white' : 'black';
    this.game[color].clockTime = parseInt(rest[0]) * 10;

    logger.info(`Updated game ${this.game.name} - Color: ${color}, ClockTime: ${this.game[color].clockTime}`, {
      port: this.broadcast.port,
    });

    this.dirty.clocks = true;
    return [EmitType.UPDATE, false];
  }

  private async onMove(tokens: CommandTokens): Promise<UpdateResult> {
    const [command, ...rest] = tokens;

    const color: Color = command === Command.WMOVE ? 'white' : 'black';
    const notColor: Color = command === Command.WMOVE ? 'black' : 'white';
    const nextColorCode: ColorCode = command === Command.WMOVE ? 'b' : 'w';

    this.game.moveNumber = parseInt(rest[0].replace('.', ''));
    const nextPvMoveNumber = color === 'white' ? this.game.moveNumber : this.game.moveNumber + 1;

    try {
      const fenBefore = this.game.instance.fen();
      const move = this.game.instance.move(rest[1], { strict: false });
      const colorCode: ColorCode = color === 'white' ? 'w' : 'b';
      this.fenBeforeLastMove = fenBefore;

      this.game[color].lastMove = move;
      logger.info(`Updated game ${this.game.name} - Color: ${color}, Last Move: ${this.game[color].lastMove?.san}`, {
        port: this.broadcast.port,
      });

      const meta: MoveMetaData = {
        color: colorCode,
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
    this.dirty.clocks = true;

    this.broadcast.kibitzerManager?.onPositionChange(this.broadcast.port, this.game.instance.fen());

    const skipOpening = this.game.openingLookupDisabled || this.game.startFen !== null;

    const [openingResult, tablebase] = await Promise.all([
      skipOpening
        ? Promise.resolve<OpeningResult>({ failed: false, opening: null })
        : fetchOpening(this.game.name, this.game.instance),
      fetchTablebase(this.game.name, this.game.fen, this.game.instance.turn()),
    ]);

    if (openingResult.failed) {
      this.game.openingLookupDisabled = true;
    } else if (openingResult.opening) {
      this.game.opening = openingResult.opening;
    }
    this.game.tablebase = tablebase;

    this.dirty.move = true;
    this.dirty.liveData = true;
    return [EmitType.UPDATE, false];
  }

  private async onSite(tokens: CommandTokens): Promise<UpdateResult> {
    const site = tokens.slice(1).join(' ');

    if (this.game.site) {
      const oldSlug = siteSlug(this.game.site);
      invalidatePgnCache(oldSlug);
      invalidateMetaCache(oldSlug);
      invalidateArchiveCache(oldSlug);
    }
    this.game.site = site.replace('GrahamCCRL.dyndns.org\\', '').replace(/\.[\w]+$/, '');

    // A site change moves the old slug out of the live set (it becomes archived) and a
    // new pgns/<slug>/ folder may appear, so the homepage listing scan must re-run.
    invalidateListingCache();

    const slug = siteSlug(this.game.site);
    if (slug !== this.hydratedSlug) {
      // A different tournament — drop the previous one's accumulated table, then seed from
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

    logger.info(`Updated game ${this.game.name} - Site: ${this.game.site}`, { port: this.broadcast.port });

    this.dirty.site = true;
    return [EmitType.UPDATE, false];
  }

  private onCTReset(): UpdateResult {
    this.broadcast.results = '';
    this.broadcast.parsedResults = null;
    // parsedGames deliberately survives — CTRESET precedes every dump, and the dump only
    // carries the most recent ~300 games. onCT merges the new batch into what we have.

    if (this.gamesParseTimer) {
      clearTimeout(this.gamesParseTimer);
      this.gamesParseTimer = null;
    }

    return [EmitType.UPDATE, false];
  }

  private onCT(tokens: CommandTokens): UpdateResult {
    this.broadcast.results += `${tokens[1]}\n`;

    if (/total\s+games\s*=/i.test(tokens[1])) {
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
        saveTournamentResults(this.broadcast);
      }
      this.gamesParseTimer = null;
    }, 100);

    return [EmitType.UPDATE, false];
  }

  private onAddUser(tokens: CommandTokens): UpdateResult {
    if (username === tokens[1] || this.broadcast.spectators.has(tokens[1])) return [EmitType.UPDATE, false];

    this.broadcast.spectators.add(tokens[1]);
    this.dirty.spectators = true;
    return [EmitType.UPDATE, false];
  }

  private onDelUser(tokens: CommandTokens): UpdateResult {
    const result = this.broadcast.spectators.delete(tokens[1]);

    if (result) this.dirty.spectators = true;
    return [EmitType.UPDATE, false];
  }

  private onChat(tokens: CommandTokens): UpdateResult {
    chatMessages.inc({ port: String(this.broadcast.port) });
    // Disable connection messages. TODO: Make this configurable
    if (tokens[1].endsWith('has arrived!') || tokens[1].endsWith('has left!')) return [EmitType.CHAT, false];

    this.pushChat(tokens[1]);
    return [EmitType.CHAT, true, tokens[1]];
  }

  // Bound the retained chat buffer (toJSON only trims the emitted tail).
  private pushChat(message: string): void {
    if (this.broadcast.chat.length >= 2000) {
      this.broadcast.chat.splice(0, this.broadcast.chat.length - 1999);
    }
    this.broadcast.chat.push(message);
  }

  private onMenu(tokens: CommandTokens): UpdateResult {
    let nameIdx = -1;
    let valueIdx = -1;

    tokens.forEach((v, i) => {
      if (v.startsWith('NAME=')) nameIdx = i;
      if (v.startsWith('URL=')) valueIdx = i;
    });

    if (nameIdx === -1 || valueIdx === -1) return [EmitType.UPDATE, false];

    const name = tokens[nameIdx].slice('NAME="'.length, -1).toLowerCase();
    const url = tokens[valueIdx].slice('URL="'.length, -1);

    this.broadcast.menu.set(name, url);

    logger.info(`Updated broadcast ${this.broadcast.port} Menu - Name: ${name}, Value: ${url}`, {
      port: this.broadcast.port,
    });

    this.dirty.menu = true;
    return [EmitType.UPDATE, false];
  }

  private async onResult(tokens: CommandTokens): Promise<UpdateResult> {
    const message = `[Server] - Game ${this.broadcast.currentGameNumber}: ${this.game.white.name} - ${
      this.game.black.name
    } (${tokens[1].trim()})`;
    this.pushChat(message);

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

    return [EmitType.CHAT, true, message];
  }

  private hasDirty(): boolean {
    const d = this.dirty;
    return d.liveData || d.clocks || d.move || d.movesPatched || d.players || d.site || d.spectators || d.menu;
  }

  private buildGameDelta(): GameDelta {
    const d = this.dirty;
    const gameDelta: GameDelta = {};

    if (d.players) {
      gameDelta.white = this.game.white.toJSON();
      gameDelta.black = this.game.black.toJSON();
      gameDelta.startFen = this.game.startFen;
      gameDelta.resetMoves = true;
    }

    if (d.clocks) {
      gameDelta.white = this.game.white.toJSON();
      gameDelta.black = this.game.black.toJSON();
    }

    if (d.site) {
      gameDelta.site = this.game.site;
    }

    if (d.move) {
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

    if (d.movesPatched) {
      // Filtering moveMeta by identity drops entries a reset() discarded mid-batch.
      const updatedMoves = this.game.moveMeta.filter((m) => this.patchedMoves.has(m));
      if (updatedMoves.length > 0) {
        gameDelta.updatedMoves = updatedMoves;
      }
    }

    if (d.liveData || d.move || d.players) {
      gameDelta.liveData = this.game.liveData.toJSON();
    }

    return gameDelta;
  }

  private buildDelta(): BroadcastDelta {
    const delta: BroadcastDelta = {};
    const d = this.dirty;

    if (d.liveData || d.clocks || d.move || d.movesPatched || d.players || d.site) {
      delta.game = this.buildGameDelta();
    }

    if (d.spectators) {
      delta.spectators = Array.from(this.broadcast.spectators);
    }

    if (d.menu) {
      delta.menu = menuToObject(this.broadcast.menu);
    }

    return delta;
  }

  private categorizeMessages(messages: string[]): [Command, string][] {
    const ready: [Command, string][] = [];

    for (const msg of messages) {
      const [cmd, rest] = splitOnCommand(msg);
      if (!this.commandConfig[cmd]) {
        logger.warn(`Unable to process ${cmd}!`, { port: this.broadcast.port });
        continue;
      }

      ready.push([cmd, rest]);
    }

    return ready;
  }

  async onMessages(messages: string[]): Promise<GameServiceResult> {
    this.dirty = freshFlags();
    this.moveCountBefore = this.game.moveMeta.length;
    this.patchedMoves.clear();
    const chatEmit: string[] = [];

    for (const [cmd, rest] of this.categorizeMessages(messages)) {
      const commandConfig = this.commandConfig[cmd];

      const [emit, updated, ...updateData] = await commandConfig.fn(
        commandConfig.split ? [cmd, ...rest.trim().split(/\s+/)] : [cmd, rest],
      );

      commandsProcessed.inc({ port: String(this.broadcast.port), command: cmd });

      if (updated && emit === EmitType.CHAT) {
        chatEmit.push(updateData[0]);
      }
    }

    const update = this.hasDirty() ? this.buildDelta() : null;

    logger.info(`Successfully processed ${messages.length} message(s)`, { port: this.broadcast.port });

    return { update, chat: chatEmit };
  }
}

export default GameService;
