import { Chess } from 'chess.js';
import fs from 'fs/promises';
import { mkdirp } from 'mkdirp';
import dayjs from 'dayjs';
import slugify from 'slugify';
import { ChessGame, MoveMetaData } from './chess-game.js';
import { logger, splitOnCommand } from './util/index.js';
import { Broadcast, SerializedBroadcast, username } from './broadcast.js';
import { io } from './io.js';

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

class Handler {
  private _commandConfig: CommandConfig;

  private _broadcast: Broadcast;

  private _game: ChessGame;

  constructor(broadcast: Broadcast) {
    this._broadcast = broadcast;
    this._game = this._broadcast.game;

    this._commandConfig = {
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

    this._game.fmr = parseInt(fmr);
    logger.info(`Updated game ${this._game.name} - FMR: ${this._game.fmr}`, {
      port: this._broadcast.port,
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

    this._game.fen = fenTokens.join(' '); // build the fen

    if (!this._game.loaded) {
      this._game.resetFromFen();
      logger.info(`Unloaded game ${this._game.name}, setting to FEN: ${this._game.instance.fen()}`, {
        port: this._broadcast.port,
      });
    } else if (this._game.fen.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq')) {
      // Reset everything on startpos
      this._game.reset();
      logger.info(`Received startpos for game ${this._game.name}, reseting the game.`, { port: this._broadcast.port });
    } else {
      logger.info(`Set backup FEN for ${this._game.name}: ${this._game.fen}`, { port: this._broadcast.port });
    }

    // Never update on the FEN since we maintain our own state
    return [EmitType.UPDATE, false];
  }

  private onPlayer(tokens: CommandTokens): UpdateResult {
    const [command, ...rest] = tokens;
    const name = rest.join(' ');

    const color: Color = command === Command.WPLAYER ? 'white' : 'black';
    this._game[color].reset();
    this._game[color].name = name;
    logger.info(`Updated game ${this._game.name} - Color: ${color}, Name: ${this._game[color].name}`, {
      port: this._broadcast.port,
    });

    return [EmitType.UPDATE, true];
  }

  private onPV(tokens: CommandTokens): UpdateResult {
    const [command, ...rest] = tokens;

    const color: Color = command === Command.WPV ? 'white' : 'black';

    this._game[color].depth = parseInt(rest[0]);
    this._game[color].score = parseInt(rest[1]) / 100;
    this._game[color].nodes = parseInt(rest[3]);
    this._game[color].usedTime = parseInt(rest[2]) * 10;

    const pv = rest.slice(4);

    const pvPlayout = new Chess();
    pvPlayout.loadPgn(this._game.instance.pgn());

    const parsed = new Array<string>();
    const pvAlg = new Array<string>();

    // If the PV is not for the current STM then we undo the last move
    // and attempt to parse the PV from that position. This will happen when
    // the final pv is sent after the best move was sent. (See issue #9)
    if (!color.startsWith(pvPlayout.turn())) pvPlayout.undo();

    for (let i = 0; i < pv.length; i++) {
      const alg = pv[i];
      try {
        const move = pvPlayout.move(alg, { strict: false });

        parsed.push(move.san);
        pvAlg.push(`${move.from}${move.to}`);
      } catch (err) {
        break; // failed to parse a move
      }
    }

    // Only if we could parse at least 1 do
    if (parsed.length) {
      this._game[color].pv = parsed;
      this._game[color].pvAlg = pvAlg;
      this._game[color].pvFen = pvPlayout.fen();
    }

    logger.info(
      `Updated game ${this._game.name} - Color: ${color}, Depth: ${this._game[color].depth}, Score: ${this._game[color].score}, Nodes: ${this._game[color].nodes}, UsedTime: ${this._game[color].usedTime}`,
      { port: this._broadcast.port },
    );
    logger.info(
      `Updated game ${this._game.name} - Color: ${color}, PVFen: ${this._game[color].pvFen}, PV: ${this._game[
        color
      ].pv.join(' ')}`,
      {
        port: this._broadcast.port,
      },
    );

    return [EmitType.UPDATE, true];
  }

  private onTime(tokens: CommandTokens): UpdateResult {
    const [command, ...rest] = tokens;

    const color: Color = command === Command.WTIME ? 'white' : 'black';
    this._game[color].clockTime = parseInt(rest[0]) * 10;

    logger.info(`Updated game ${this._game.name} - Color: ${color}, ClockTime: ${this._game[color].clockTime}`, {
      port: this._broadcast.port,
    });
    return [EmitType.UPDATE, true];
  }

  private async onMove(tokens: CommandTokens): Promise<UpdateResult> {
    const [command, ...rest] = tokens;

    const color: Color = command === Command.WMOVE ? 'white' : 'black';
    const notColor: Color = command === Command.WMOVE ? 'black' : 'white';

    this._game.moveNumber = parseInt(rest[0].replace('.', ''));
    if (color === 'white') this._game.black.pvMoveNumber = this._game.moveNumber;
    else this._game.white.pvMoveNumber = this._game.moveNumber + 1;

    try {
      const move = this._game.instance.move(rest[1], { strict: false });

      this._game[color].lastMove = move;
      logger.info(`Updated game ${this._game.name} - Color: ${color}, Last Move: ${this._game[color].lastMove?.san}`, {
        port: this._broadcast.port,
      });

      if (this._game[color].depth > 0) {
        // Setup metadata
        const moveMeta: MoveMetaData = {
          number: this._game.moveNumber,
          move: move.san,
          depth: this._game[color].depth,
          score: this._game[color].score,
          nodes: this._game[color].nodes,
        };
        this._game[color]._moves.push(moveMeta);

        // Set the PGN comment for this move
        const comment = `(${this._game[color].pv.join(' ')}) ${this._game[color].score.toFixed(2)}/${
          this._game[color].depth
        } ${Math.round((new Date().getTime() - this._game[color].startTime) / 1000)}`;
        this._game.instance.setComment(comment);
      } else {
        this._game.instance.setComment('(Book)');
      }
    } catch (err) {
      logger.warn(
        `Failed to parse ${rest[1]} for game ${this._game.name}, fen ${this._game.instance.fen()}! Loading from FEN...`,
        { port: this._broadcast.port },
      );
      this._game.resetFromFen();
    }

    // start the timer for the other side
    this._game[notColor].startTime = new Date().getTime();
    await Promise.all([this._game.setOpening(), this._game.setTablebase()]);

    return [EmitType.UPDATE, true];
  }

  private onSite(tokens: CommandTokens): UpdateResult {
    const site = tokens.slice(1).join(' ');

    this._game.site = site.replace('GrahamCCRL.dyndns.org\\', '').replace(/\.[\w]+$/, '');

    logger.info(`Updated game ${this._game.name} - Site: ${this._game.site}`, { port: this._broadcast.port });
    return [EmitType.UPDATE, true];
  }

  private onCTReset(): UpdateResult {
    this._broadcast.results = '';

    return [EmitType.UPDATE, false];
  }

  private onCT(tokens: CommandTokens): UpdateResult {
    this._broadcast.results += `${tokens[1]}\n`;

    return [EmitType.UPDATE, false];
  }

  private onAddUser(tokens: CommandTokens): UpdateResult {
    if (username === tokens[1] || this._broadcast.spectators.has(tokens[1])) return [EmitType.UPDATE, false];

    this._broadcast.spectators.add(tokens[1]);
    return [EmitType.UPDATE, true];
  }

  private onDelUser(tokens: CommandTokens): UpdateResult {
    const result = this._broadcast.spectators.delete(tokens[1]);

    return [EmitType.UPDATE, result];
  }

  private onChat(tokens: CommandTokens): UpdateResult {
    // Disable connection messages. TODO: Make this configurable
    if (tokens[0].endsWith('has arrived!') || tokens[0].endsWith('has left!')) return [EmitType.CHAT, false];

    this._broadcast.chat.push(tokens[1]);
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

    this._broadcast.menu.set(name, url);

    logger.info(`Updated broadcast ${this._broadcast.port} Menu - Name: ${name}, Value: ${url}`, {
      port: this._broadcast.port,
    });
    return [EmitType.UPDATE, true];
  }

  private async onResult(tokens: CommandTokens): Promise<UpdateResult> {
    const message = `[Server] - ${this._game.white.name} - ${this._game.black.name} (${tokens[1].trim()})`;
    this._broadcast.chat.push(message);

    this._game.instance.header('Result', tokens[1].trim());

    const { white, black, site } = this._game;
    const pgn = this._game.instance.pgn();

    const siteSlug = slugify(site, '_');
    const dirname = `pgns/${siteSlug}`;

    const date = dayjs().format('YYYYMMDD_HHmm');
    const filename = slugify(`${date}_${white.name}_vs_${black.name}`, '_');
    const filepath = `${dirname}/${filename}.pgn`;

    try {
      await mkdirp(dirname);
      await fs.writeFile(filepath, pgn);
    } catch (err) {
      logger.error(`Unable to write to ${filepath}! - ${err}`, { port: this._broadcast.port });
    }

    this._broadcast.reloadResults();

    return [EmitType.CHAT, true, message];
  }

  async onMessages(messages: string[]): Promise<void> {
    // We emit after processing all messages.
    // UpdateEmit is the board result after the last processed message
    // ChatEmit is all the chats received across these messages
    let updateEmit: SerializedBroadcast | null = null;
    const chatEmit: string[] = [];

    const processLowPrio = this._broadcast.browserCount > 0;
    if (!processLowPrio)
      logger.info('No one viewing broadcast, skipping processing of low-priority messages.', {
        port: this._broadcast.port,
      });

    const highPrioMessages: [Command, string][] = [];
    const lowPriorityMessages = new Map<Command, string>();

    messages
      .map((msg) => splitOnCommand(msg))
      .forEach(([cmd, rest]) => {
        const config = this._commandConfig[cmd] as ConfigItem | undefined;
        if (!config) {
          logger.warn(`Unable to process ${cmd}!`, { port: this._broadcast.port });
          return;
        }

        if (config.lowPrio) {
          lowPriorityMessages.set(cmd, rest);
        } else {
          highPrioMessages.push([cmd, rest]);
        }
      });

    for (const [cmd, rest] of [...highPrioMessages, ...(processLowPrio ? lowPriorityMessages : [])]) {
      const commandConfig = this._commandConfig[cmd];

      const [emit, updated, ...updateData] = await commandConfig.fn(
        commandConfig.split ? [cmd, ...rest.trim().split(/\s+/)] : [cmd, rest],
      );

      if (updated) {
        switch (emit) {
          case EmitType.UPDATE:
            updateEmit = this._broadcast.toJSON();
            break;
          case EmitType.CHAT:
            chatEmit.push(updateData[0]);
            break;
        }
      }
    }

    if (updateEmit) io.to(String(this._broadcast.port)).emit(EmitType.UPDATE, updateEmit);
    if (chatEmit.length) io.to(String(this._broadcast.port)).emit(EmitType.CHAT, chatEmit);

    logger.info(`Successfully processed ${messages.length} message(s)`, { port: this._broadcast.port });
  }
}

export default Handler;
