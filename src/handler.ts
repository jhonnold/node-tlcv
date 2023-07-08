import { Chess } from 'chess.js';
import { ChessGame } from './chess-game';
import { logger, splitOnCommand } from './util';
import { Broadcast, SerializedBroadcast, username } from './broadcast';
import { io } from './io';

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

type ConfigItem = {
  fn: (tokens: CommandTokens) => Promise<UpdateResult> | UpdateResult;
  split: boolean;
};

type CommandConfig = {
  [key in Command]: ConfigItem;
};

type CommandTokens = [Command, ...Array<string>];

type UpdateResult = [EmitType, boolean, ...Array<any>];

class Handler {
  private _commandConfig: CommandConfig;
  private _broadcast: Broadcast;
  private _game: ChessGame;

  constructor(broadcast: Broadcast) {
    this._broadcast = broadcast;
    this._game = this._broadcast.game;

    this._commandConfig = {
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
      [Command.FMR]: { fn: () => [EmitType.UPDATE, false], split: false },
    };
  }

  private onFen(tokens: CommandTokens): UpdateResult {
    const [, ...fenTokens] = tokens;
    const lastToken = fenTokens.slice(-1)[0];

    // Sometimes we don't get castling info
    if (lastToken == 'w' || lastToken == 'b') fenTokens.push('-');

    fenTokens.push('-', '0', '1');

    this._game.fen = fenTokens.join(' '); // build the fen
    if (!this._game.loaded) this._game.resetFromFen();

    logger.info(`Updated game ${this._game.name} - FEN: ${this._game.fen}`);

    // Never update on the FEN since we maintain our own state
    return [EmitType.UPDATE, false];
  }

  private onPlayer(tokens: CommandTokens): UpdateResult {
    const [command, ...rest] = tokens;
    const name = rest.join(' ');

    if (command != Command.WPLAYER && command != Command.BPLAYER) return [EmitType.UPDATE, false];

    const color: Color = command == Command.WPLAYER ? 'white' : 'black';

    if (this._game[color].name != name) {
      this._game[color].reset();
      this._game[color].name = name;
      this._game.reset();

      logger.info(`Updated game ${this._game.name} - Color: ${color}, Name: ${this._game[color].name}`);
      return [EmitType.UPDATE, true];
    }

    return [EmitType.UPDATE, false];
  }

  private onPV(tokens: CommandTokens): UpdateResult {
    const [command, ...rest] = tokens;

    if (command != Command.WPV && command != Command.BPV) return [EmitType.UPDATE, false];

    const color: Color = command == Command.WPV ? 'white' : 'black';

    this._game[color].depth = parseInt(rest[0]);
    this._game[color].score = parseInt(rest[1]) / 100;
    this._game[color].nodes = parseInt(rest[3]);
    this._game[color].usedTime = parseInt(rest[2]) * 10;

    const copy = new Chess();
    copy.load_pgn(this._game.instance.pgn());

    const pv = rest.slice(4);
    const parsed = new Array<string>();

    // If the PV is not for the current STM then we undo the last move
    // and attempt to parse the PV from that position. This will happen when
    // the final pv is sent after the best move was sent. (See issue #9)
    if (!color.startsWith(copy.turn())) copy.undo();

    for (let i = 0; i < pv.length; i++) {
      const alg = pv[i];
      const move = copy.move(alg, { sloppy: true });
      if (!move) break;

      if (i == 0) this._game[color].pvAlg = `${move.from}${move.to}`;
      parsed.push(move.san);
    }

    // Only if we could parse at least 1 do
    if (parsed.length) {
      this._game[color].pv = parsed;

      this._game[color].pvFen = this._game[color].pv
        .reduce((board, move) => {
          board.move(move);
          return board;
        }, new Chess(this._game.fen))
        .fen();
    }

    logger.info(
      `Updated game ${this._game.name} - Color: ${color}, Depth: ${this._game[color].depth}, Score: ${this._game[color].score}, Nodes: ${this._game[color].nodes}, UsedTime: ${this._game[color].usedTime}`,
    );
    logger.info(`Updated game ${this._game.name} - Color: ${color}, PV: ${this._game[color].pv.join(' ')}`);

    return [EmitType.UPDATE, true];
  }

  private onTime(tokens: CommandTokens): UpdateResult {
    const [command, ...rest] = tokens;

    if (command != Command.WTIME && command != Command.BTIME) return [EmitType.UPDATE, false];

    const color: Color = command == Command.WTIME ? 'white' : 'black';
    this._game[color].clockTime = parseInt(rest[0]) * 10;

    logger.info(`Updated game ${this._game.name} - Color: ${color}, ClockTime: ${this._game[color].clockTime}`);
    return [EmitType.UPDATE, true];
  }

  private async onMove(tokens: CommandTokens): Promise<UpdateResult> {
    const [command, ...rest] = tokens;

    if (command != Command.WMOVE && command != Command.BMOVE) return [EmitType.UPDATE, false];

    const color: Color = command == Command.WMOVE ? 'white' : 'black';
    const notColor: Color = command == Command.WMOVE ? 'black' : 'white';

    this._game.moveNumber = parseInt(rest[0].replace('.', ''));
    if (color == 'white') this._game.black.pvMoveNumber = this._game.moveNumber;
    else this._game.white.pvMoveNumber = this._game.moveNumber + 1;

    const move = this._game.instance.move(rest[1]);
    if (move) {
      this._game[color].lastMove = move;
      logger.info(`Updated game ${this._game.name} - Color: ${color}, Last Move: ${this._game[color].lastMove?.san}`);
    } else {
      logger.warn(
        `Failed to parse ${rest[1]} for game ${this._game.name}, fen ${this._game.instance.fen()}! Loading from FEN...`,
      );
      this._game.resetFromFen();
    }

    // start the timer for the other side
    this._game[notColor].startTime = new Date().getTime();
    await this._game.setOpening();

    return [EmitType.UPDATE, true];
  }

  private onSite(tokens: CommandTokens): UpdateResult {
    const site = tokens.slice(1).join(' ');

    this._game.site = site.replace('GrahamCCRL.dyndns.org\\', '').replace(/\.[\w]+$/, '');

    logger.info(`Updated game ${this._game.name} - Site: ${this._game.site}`);
    return [EmitType.UPDATE, true];
  }

  private onCTReset(): UpdateResult {
    this._broadcast.results = '';

    return [EmitType.UPDATE, false];
  }

  private onCT(tokens: CommandTokens): UpdateResult {
    this._broadcast.results += tokens[1] + '\n';

    return [EmitType.UPDATE, false];
  }

  private onAddUser(tokens: CommandTokens): UpdateResult {
    if (username == tokens[1] || this._broadcast.spectators.has(tokens[1])) return [EmitType.UPDATE, false];

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

    if (nameIdx == -1 || valueIdx == -1) return [EmitType.UPDATE, false];

    const name = tokens[nameIdx].slice(6, -1).toLowerCase(); // chop NAME="
    const url = tokens[valueIdx].slice(5, -1); // chop URL="

    this._broadcast.menu.set(name, url);

    logger.info(`Updated broadcast ${this._broadcast.port} Menu - Name: ${name}, Value: ${url}`);
    return [EmitType.UPDATE, true];
  }

  private onResult(tokens: CommandTokens): UpdateResult {
    const message = `[Server] - ${this._game.white.name} - ${this._game.black.name} (${tokens[1].trim()})`;
    this._broadcast.chat.push(message);

    return [EmitType.CHAT, true, message];
  }

  async onMessages(messages: string[]): Promise<string[]> {
    const messageIds: string[] = [];

    // We emit after processing all messages.
    // UpdateEmit is the board result after the last processed message
    // ChatEmit is all the chats received across these messages
    let updateEmit: SerializedBroadcast | null = null;
    const chatEmit: string[] = [];

    for (let msg of messages) {
      let messageId: string | null = null;
      const idMatch = /^<\s*(\d+)>/g.exec(msg);
      if (idMatch) {
        messageId = idMatch[1];
        logger.debug(`${messageId} parsed as Message Id for ${msg}`);

        msg = msg.replace(/^<\s*(\d+)>/g, '');
      } else {
        logger.debug(`No Message Id found for ${msg}`);
      }

      const [cmd, rest] = splitOnCommand(msg);

      const commandConfig = this._commandConfig[cmd] as ConfigItem | undefined;

      if (!commandConfig) logger.warn(`Unable to process ${cmd}!`);
      else {
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

      if (messageId) messageIds.push(messageId);
    }

    if (updateEmit) io.to(String(this._broadcast.port)).emit(EmitType.UPDATE, updateEmit);
    if (chatEmit.length) io.to(String(this._broadcast.port)).emit(EmitType.CHAT, chatEmit);

    logger.info(`Successfully processed ${messages.length} message(s) with ids - ${messageIds.join(',')}`);
    return messageIds;
  }
}

export default Handler;
