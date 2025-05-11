import { Chess } from 'chess.js';
import fs from 'fs/promises';
import { mkdirp } from 'mkdirp';
import dayjs from 'dayjs';
import slugify from 'slugify';
import { ChessGame, MoveMetaData } from './chess-game';
import { logger, splitOnCommand } from './util/index';
import { Broadcast, username } from './broadcast';
import io from './io';

type Color = 'white' | 'black';

export enum EmitType {
  UPDATE = 'update',
  CHAT = 'new-chat',
}

export enum Command {
  FEN = 'FEN',
  WPLAYER = 'WPLAYER',
  BPLAYER = 'BPLAYER',
  WPV = 'WPV',
  BPV = 'BPV',
  WTIME = 'WTIME',
  BTIME = 'BTIME',
  WMOVE = 'WMOVE',
  BMOVE = 'BMOVE',
  SITE = 'SITE',
  CT = 'CT',
  CTRESET = 'CTRESET',
  PONG = 'PONG',
  ADDUSER = 'ADDUSER',
  DELUSER = 'DELUSER',
  CHAT = 'CHAT',
  MENU = 'MENU',
  RESULT = 'result',
  FMR = 'FMR',
}

type CommandTokens = [Command, ...string[]];
type UpdateResult = [EmitType, boolean, ...unknown[]];
type CommandFn = (_: CommandTokens) => Promise<UpdateResult> | UpdateResult;
interface ConfigItem {
  fn: CommandFn;
  split: boolean;
}

type CommandConfig = Record<Command, ConfigItem>;

class Handler {
  private commandConfig: CommandConfig;
  private broadcast: Broadcast;
  private game: ChessGame;
  private updateFlag: boolean;

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
    };

    this.updateFlag = false;
    setInterval(() => {
      if (this.updateFlag) io.to(String(this.broadcast.port)).emit(EmitType.UPDATE, this.broadcast.toJSON());
    }, 100);
  }

  private onFmr(tokens: CommandTokens): UpdateResult {
    const [, fmr] = tokens;

    this.game.fmr = parseInt(fmr, 10);
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
      logger.info(`Unloaded game ${this.game.name}, setting to FEN: ${this.game.instance.fen()}`, {
        port: this.broadcast.port,
      });
    } else if (this.game.fen.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq')) {
      // Reset everything on startpos
      this.game.reset();
      logger.info(`Received startpos for game ${this.game.name}, reseting the game.`, { port: this.broadcast.port });
    } else {
      logger.info(`Set backup FEN for ${this.game.name}: ${this.game.fen}`, { port: this.broadcast.port });
    }

    // Never update on the FEN since we maintain our own state
    return [EmitType.UPDATE, false];
  }

  private onPlayer(tokens: CommandTokens): UpdateResult {
    const [command, ...rest] = tokens;
    const name = rest.join(' ');

    const color: Color = command === Command.WPLAYER ? 'white' : 'black';
    this.game[color].reset();
    this.game[color].name = name;
    logger.info(`Updated game ${this.game.name} - Color: ${color}, Name: ${this.game[color].name}`, {
      port: this.broadcast.port,
    });

    return [EmitType.UPDATE, true];
  }

  private onPV(tokens: CommandTokens): UpdateResult {
    const [command, ...rest] = tokens;

    const color: Color = command === Command.WPV ? 'white' : 'black';

    this.game[color].depth = parseInt(rest[0], 10);
    this.game[color].score = parseInt(rest[1], 10) / 100;
    this.game[color].nodes = parseInt(rest[3], 10);
    this.game[color].usedTime = parseInt(rest[2], 10) * 10;

    const pv = rest.slice(4);

    const pvPlayout = new Chess();
    const parsed = [];
    const pvAlg = [];

    try {
      pvPlayout.loadPgn(this.game.instance.pgn(), { strict: false });

      // If the PV is not for the current STM then we undo the last move
      // and attempt to parse the PV from that position. This will happen when
      // the final pv is sent after the best move was sent. (See issue #9)
      if (!color.startsWith(pvPlayout.turn())) pvPlayout.undo();

      // eslint-disable-next-line no-restricted-syntax
      for (const alg of pv) {
        try {
          const move = pvPlayout.move(alg, { strict: false });

          parsed.push(move.san);
          pvAlg.push(`${move.from}${move.to}`);
        } catch {
          break; // failed to parse a move
        }
      }
    } catch (error) {
      logger.warn(`Unable to parse PV: ${error}`);
    }

    // Only if we could parse at least 1 do
    if (parsed.length) {
      this.game[color].pv = parsed;
      this.game[color].pvAlg = pvAlg;
      this.game[color].pvFen = pvPlayout.fen();
    }

    logger.info(
      `Updated game ${this.game.name} - Color: ${color}, Depth: ${this.game[color].depth}, Score: ${this.game[color].score}, Nodes: ${this.game[color].nodes}, UsedTime: ${this.game[color].usedTime}`,
      { port: this.broadcast.port },
    );
    logger.info(
      `Updated game ${this.game.name} - Color: ${color}, PVFen: ${this.game[color].pvFen}, PV: ${this.game[
        color
      ].pv.join(' ')}`,
      {
        port: this.broadcast.port,
      },
    );

    return [EmitType.UPDATE, true];
  }

  private onTime(tokens: CommandTokens): UpdateResult {
    const [command, ...rest] = tokens;

    const color: Color = command === Command.WTIME ? 'white' : 'black';
    this.game[color].clockTime = parseInt(rest[0], 10) * 10;

    logger.info(`Updated game ${this.game.name} - Color: ${color}, ClockTime: ${this.game[color].clockTime}`, {
      port: this.broadcast.port,
    });
    return [EmitType.UPDATE, true];
  }

  private async onMove(tokens: CommandTokens): Promise<UpdateResult> {
    const [command, ...rest] = tokens;

    const color: Color = command === Command.WMOVE ? 'white' : 'black';
    const notColor: Color = command === Command.WMOVE ? 'black' : 'white';

    this.game.moveNumber = parseInt(rest[0].replace('.', ''), 10);
    if (color === 'white') this.game.black.pvMoveNumber = this.game.moveNumber;
    else this.game.white.pvMoveNumber = this.game.moveNumber + 1;

    try {
      const move = this.game.instance.move(rest[1], { strict: false });

      this.game[color].lastMove = move;
      logger.info(`Updated game ${this.game.name} - Color: ${color}, Last Move: ${this.game[color].lastMove?.san}`, {
        port: this.broadcast.port,
      });

      if (this.game[color].depth > 0) {
        // Setup metadata
        const moveMeta: MoveMetaData = {
          number: this.game.moveNumber,
          move: move.san,
          depth: this.game[color].depth,
          score: this.game[color].score,
          nodes: this.game[color].nodes,
        };
        this.game[color].moves.push(moveMeta);

        // Set the PGN comment for this move
        const comment = `(${this.game[color].pv.join(' ')}) ${this.game[color].score.toFixed(2)}/${
          this.game[color].depth
        } ${Math.round((new Date().getTime() - this.game[color].startTime) / 1000)}`;
        this.game.instance.setComment(comment);
      } else {
        this.game.instance.setComment('(Book)');
      }
    } catch {
      logger.warn(
        `Failed to parse ${rest[1]} for game ${this.game.name}, fen ${this.game.instance.fen()}! Loading from FEN...`,
        { port: this.broadcast.port },
      );
      this.game.resetFromFen();
    }

    // start the timer for the other side
    this.game[notColor].startTime = new Date().getTime();
    await Promise.all([this.game.setOpening(), this.game.setTablebase()]);

    return [EmitType.UPDATE, true];
  }

  private onSite(tokens: CommandTokens): UpdateResult {
    const site = tokens.slice(1).join(' ');

    this.game.site = site.replace('GrahamCCRL.dyndns.org\\', '').replace(/\.[\w]+$/, '');

    logger.info(`Updated game ${this.game.name} - Site: ${this.game.site}`, { port: this.broadcast.port });
    return [EmitType.UPDATE, true];
  }

  private onCTReset(): UpdateResult {
    this.broadcast.results = '';

    return [EmitType.UPDATE, false];
  }

  private onCT(tokens: CommandTokens): UpdateResult {
    this.broadcast.results += `${tokens[1]}\n`;

    return [EmitType.UPDATE, false];
  }

  private onAddUser(tokens: CommandTokens): UpdateResult {
    if (username === tokens[1] || this.broadcast.spectators.has(tokens[1])) return [EmitType.UPDATE, false];

    this.broadcast.spectators.add(tokens[1]);
    return [EmitType.UPDATE, true];
  }

  private onDelUser(tokens: CommandTokens): UpdateResult {
    const result = this.broadcast.spectators.delete(tokens[1]);

    return [EmitType.UPDATE, result];
  }

  private onChat(tokens: CommandTokens): UpdateResult {
    // Disable connection messages. TODO: Make this configurable
    if (tokens[0].endsWith('has arrived!') || tokens[0].endsWith('has left!')) return [EmitType.CHAT, false];

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

    const name = tokens[nameIdx].slice(6, -1).toLowerCase(); // chop NAME="
    const url = tokens[valueIdx].slice(5, -1); // chop URL="

    this.broadcast.menu.set(name, url);

    logger.info(`Updated broadcast ${this.broadcast.port} Menu - Name: ${name}, Value: ${url}`, {
      port: this.broadcast.port,
    });
    return [EmitType.UPDATE, true];
  }

  private async onResult(tokens: CommandTokens): Promise<UpdateResult> {
    const message = `[Server] - ${this.game.white.name} - ${this.game.black.name} (${tokens[1].trim()})`;
    this.broadcast.chat.push(message);

    this.game.instance.header('Result', tokens[1].trim());

    const { white, black, site } = this.game;
    const pgn = this.game.instance.pgn();

    const siteSlug = slugify(site, '_');
    const dirname = `pgns/${siteSlug}`;

    const date = dayjs().format('YYYYMMDD_HHmm');
    const filename = slugify(`${date}_${white.name}_vs_${black.name}`, '_');
    const filepath = `${dirname}/${filename}.pgn`;

    try {
      await mkdirp(dirname);
      await fs.writeFile(filepath, pgn);
    } catch (error) {
      logger.error(`Unable to write to ${filepath}! - ${error}`, { port: this.broadcast.port });
    }

    this.broadcast.reloadResults();

    return [EmitType.CHAT, true, message];
  }

  async onMessage(message: string): Promise<void> {
    const [cmd, rest] = splitOnCommand(message);
    const commandConfig = this.commandConfig[cmd];
    if (!commandConfig) {
      logger.info(`Nothing to do for command ${cmd}`, { port: this.broadcast.port });
      return;
    }

    const [emit, updated, ...updateData] = await commandConfig.fn(
      commandConfig.split ? [cmd, ...rest.trim().split(/\s+/)] : [cmd, rest],
    );

    logger.debug(`Successfully processed message for command ${cmd}`, { port: this.broadcast.port });

    if (!updated) return;

    if (emit === EmitType.CHAT) {
      io.to(String(this.broadcast.port)).emit(EmitType.CHAT, updateData[0]);
    } else if (emit === EmitType.UPDATE) {
      this.updateFlag = true;
    }
  }
}

export default Handler;
