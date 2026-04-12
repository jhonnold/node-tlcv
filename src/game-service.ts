import { Chess } from 'chess.js';
import { ChessGame } from './chess-game.js';
import { logger, siteSlug } from './util/index.js';
import { Broadcast, username } from './broadcast.js';
import { fetchOpening, fetchTablebase } from './services/lichess.js';
import { savePgn } from './services/pgn.js';
import { saveGameMeta, invalidate as invalidateMetaCache } from './services/game-meta.js';
import { invalidate as invalidatePgnCache } from './services/pgn-cache.js';
import { Command, splitOnCommand } from './protocol.js';
import { EmitType } from './socket-io-adapter.js';
import { commandsProcessed, chatMessages } from './metrics.js';
import { parseResults, parseGames } from './services/result-parser.js';
import type { BroadcastDelta, ColorCode, GameDelta } from '../shared/types.js';

type Color = 'white' | 'black';

type CommandTokens = [Command, ...Array<string>];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UpdateResult = [EmitType, boolean, ...Array<any>];

type ConfigItem = {
  fn: (tokens: CommandTokens) => Promise<UpdateResult> | UpdateResult;
  split: boolean;
  lowPrio: boolean;
};

type CommandConfig = {
  [key in Command]: ConfigItem;
};

type DirtyFlags = {
  liveData: boolean;
  clocks: boolean;
  move: boolean;
  players: boolean;
  site: boolean;
  spectators: boolean;
  menu: boolean;
};

function freshFlags(): DirtyFlags {
  return { liveData: false, clocks: false, move: false, players: false, site: false, spectators: false, menu: false };
}

export type GameServiceResult = {
  update: BroadcastDelta | null;
  chat: string[];
};

class GameService {
  private commandConfig: CommandConfig;
  private broadcast: Broadcast;
  private game: ChessGame;
  private gamesParseTimer: ReturnType<typeof setTimeout> | null = null;
  private dirty: DirtyFlags = freshFlags();
  private moveCountBefore = 0;

  constructor(broadcast: Broadcast) {
    this.broadcast = broadcast;
    this.game = this.broadcast.game;

    this.commandConfig = {
      [Command.FEN]: { fn: this.onFen.bind(this), split: true, lowPrio: false },
      [Command.WPLAYER]: { fn: this.onPlayer.bind(this), split: false, lowPrio: false },
      [Command.BPLAYER]: { fn: this.onPlayer.bind(this), split: false, lowPrio: false },
      [Command.WPV]: { fn: this.onPV.bind(this), split: true, lowPrio: false },
      [Command.BPV]: { fn: this.onPV.bind(this), split: true, lowPrio: false },
      [Command.WTIME]: { fn: this.onTime.bind(this), split: true, lowPrio: false },
      [Command.BTIME]: { fn: this.onTime.bind(this), split: true, lowPrio: false },
      [Command.WMOVE]: { fn: this.onMove.bind(this), split: true, lowPrio: false },
      [Command.BMOVE]: { fn: this.onMove.bind(this), split: true, lowPrio: false },
      [Command.SITE]: { fn: this.onSite.bind(this), split: false, lowPrio: false },
      [Command.CTRESET]: { fn: this.onCTReset.bind(this), split: false, lowPrio: false },
      [Command.CT]: { fn: this.onCT.bind(this), split: false, lowPrio: false },
      [Command.PONG]: { fn: () => [EmitType.UPDATE, false], split: false, lowPrio: false },
      [Command.ADDUSER]: { fn: this.onAddUser.bind(this), split: false, lowPrio: false },
      [Command.DELUSER]: { fn: this.onDelUser.bind(this), split: false, lowPrio: false },
      [Command.CHAT]: { fn: this.onChat.bind(this), split: false, lowPrio: false },
      [Command.MENU]: { fn: this.onMenu.bind(this), split: true, lowPrio: false },
      [Command.RESULT]: { fn: this.onResult.bind(this), split: false, lowPrio: false },
      [Command.FMR]: { fn: this.onFmr.bind(this), split: false, lowPrio: false },
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
    return [EmitType.UPDATE, false];
  }

  private playoutPV(pv: string[]): { san: string[]; alg: string[]; fen: string } | null {
    const pvPlayout = new Chess();
    pvPlayout.loadPgn(this.game.instance.pgn());

    const san: string[] = [];
    const alg: string[] = [];

    for (const move of pv) {
      try {
        const result = pvPlayout.move(move, { strict: false });
        san.push(result.san);
        alg.push(`${result.from}${result.to}`);
      } catch {
        break;
      }
    }

    return san.length ? { san, alg, fen: pvPlayout.fen() } : null;
  }

  private onPV(tokens: CommandTokens): UpdateResult {
    const [command, ...rest] = tokens;

    const colorCode: ColorCode = command === Command.WPV ? 'w' : 'b';

    // Discard PV updates for the non-thinking color (handles stale post-move flush, issue #9)
    if (colorCode !== this.game.liveData.color) return [EmitType.UPDATE, false];

    const [depthStr, scoreStr, timeStr, nodesStr, ...pv] = rest;
    this.game.liveData.depth = parseInt(depthStr);
    this.game.liveData.score = parseInt(scoreStr) / 100;
    this.game.liveData.nodes = parseInt(nodesStr);
    this.game.liveData.usedTime = parseInt(timeStr) * 10;

    const playout = this.playoutPV(pv);
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
      const move = this.game.instance.move(rest[1], { strict: false });
      const colorCode: ColorCode = color === 'white' ? 'w' : 'b';

      this.game[color].lastMove = move;
      logger.info(`Updated game ${this.game.name} - Color: ${color}, Last Move: ${this.game[color].lastMove?.san}`, {
        port: this.broadcast.port,
      });

      if (this.game.liveData.depth > 0) {
        const kibitzerSnapshot = this.broadcast.kibitzerManager?.snapshotForMove(this.broadcast.port) ?? null;

        this.game.moveMeta.push({
          color: colorCode,
          number: this.game.moveNumber,
          move: move.san,
          depth: this.game.liveData.depth,
          score: this.game.liveData.score,
          nodes: this.game.liveData.nodes,
          time:
            this.game[color].startTime > 0
              ? Math.round((new Date().getTime() - this.game[color].startTime) / 1000)
              : null,
          pv: this.game.liveData.pv.length ? [...this.game.liveData.pv] : null,
          pvFen: this.game.liveData.pvFen,
          pvMoveNumber: this.game.liveData.pvMoveNumber,
          pvFollowup: this.game.liveData.pvAlg[1] || null,
          pvAlg: this.game.liveData.pvAlg[0] || null,
          kibitzer: kibitzerSnapshot,
        });

        // Set the PGN comment for this move
        const comment = `(${this.game.liveData.pv.join(' ')}) ${this.game.liveData.score.toFixed(2)}/${
          this.game.liveData.depth
        } ${Math.round((new Date().getTime() - this.game[color].startTime) / 1000)}`;
        this.game.instance.setComment(comment);
      } else {
        this.game.moveMeta.push({
          color: colorCode,
          number: this.game.moveNumber,
          move: move.san,
          depth: null,
          score: null,
          nodes: null,
          time: null,
          pv: null,
          pvFen: null,
          pvMoveNumber: null,
          pvFollowup: null,
          pvAlg: null,
          kibitzer: null,
        });

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

    const [opening, tablebase] = await Promise.all([
      fetchOpening(this.game.name, this.game.instance),
      fetchTablebase(this.game.name, this.game.fen, this.game.instance.turn()),
    ]);

    if (opening) this.game.opening = opening;
    this.game.tablebase = tablebase;

    this.dirty.move = true;
    this.dirty.liveData = true;
    return [EmitType.UPDATE, false];
  }

  private onSite(tokens: CommandTokens): UpdateResult {
    const site = tokens.slice(1).join(' ');

    if (this.game.site) {
      const oldSlug = siteSlug(this.game.site);
      invalidatePgnCache(oldSlug);
      invalidateMetaCache(oldSlug);
    }
    this.game.site = site.replace('GrahamCCRL.dyndns.org\\', '').replace(/\.[\w]+$/, '');

    logger.info(`Updated game ${this.game.name} - Site: ${this.game.site}`, { port: this.broadcast.port });

    this.dirty.site = true;
    return [EmitType.UPDATE, false];
  }

  private onCTReset(): UpdateResult {
    this.broadcast.results = '';
    this.broadcast.parsedResults = null;
    this.broadcast.parsedGames = null;

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
        this.broadcast.parsedGames = games;
        this.broadcast.currentGameNumber = games[0].gameNumber + 1;
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

    this.broadcast.chat.push(tokens[1]);
    return [EmitType.CHAT, true, tokens[1]];
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
    this.broadcast.chat.push(message);

    const result = tokens[1].trim();
    this.game.instance.header('Result', result);

    await savePgn(this.game, this.broadcast.port, this.broadcast.currentGameNumber);
    await saveGameMeta(this.game, this.broadcast.port, this.broadcast.currentGameNumber, result);

    this.broadcast.reloadResults();

    return [EmitType.CHAT, true, message];
  }

  private hasDirty(): boolean {
    const d = this.dirty;
    return d.liveData || d.clocks || d.move || d.players || d.site || d.spectators || d.menu;
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

    if (d.liveData || d.move || d.players) {
      gameDelta.liveData = this.game.liveData.toJSON();
    }

    return gameDelta;
  }

  private buildDelta(): BroadcastDelta {
    const delta: BroadcastDelta = {};
    const d = this.dirty;

    if (d.liveData || d.clocks || d.move || d.players || d.site) {
      delta.game = this.buildGameDelta();
    }

    if (d.spectators) {
      delta.spectators = Array.from(this.broadcast.spectators);
    }

    if (d.menu) {
      const menu: { [key: string]: string } = {};
      for (const e of this.broadcast.menu.entries()) menu[e[0]] = e[1];
      delta.menu = menu;
    }

    return delta;
  }

  private categorizeMessages(messages: string[]): { highPrio: [Command, string][]; lowPrio: Map<Command, string> } {
    const highPrio: [Command, string][] = [];
    const lowPrio = new Map<Command, string>();

    for (const msg of messages) {
      const [cmd, rest] = splitOnCommand(msg);
      const config = this.commandConfig[cmd] as ConfigItem | undefined;
      if (!config) {
        logger.warn(`Unable to process ${cmd}!`, { port: this.broadcast.port });
        continue;
      }

      if (config.lowPrio) {
        lowPrio.set(cmd, rest);
      } else {
        highPrio.push([cmd, rest]);
      }
    }

    return { highPrio, lowPrio };
  }

  async onMessages(messages: string[]): Promise<GameServiceResult> {
    this.dirty = freshFlags();
    this.moveCountBefore = this.game.moveMeta.length;
    const chatEmit: string[] = [];

    const processLowPrio = this.broadcast.browserCount > 0;
    if (!processLowPrio)
      logger.info('No one viewing broadcast, skipping processing of low-priority messages.', {
        port: this.broadcast.port,
      });

    const { highPrio, lowPrio } = this.categorizeMessages(messages);

    for (const [cmd, rest] of [...highPrio, ...(processLowPrio ? lowPrio : [])]) {
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
