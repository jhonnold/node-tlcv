import { Chess } from 'chess.js';
import { ChessGame } from './chess-game';
import { logger, splitOnCommand } from './util';
import { Broadcast, username } from './broadcast';
import { io } from './io';

type Color = 'white' | 'black';

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
}

type ConfigItem = {
  fn: (tokens: CommandTokens) => boolean;
  split: boolean;
};

type CommandConfig = {
  [key in Command]: ConfigItem;
};

type CommandTokens = [Command, ...Array<string>];

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
      [Command.PONG]: { fn: () => false, split: false },
      [Command.ADDUSER]: { fn: this.onAddUser.bind(this), split: false },
      [Command.DELUSER]: { fn: this.onDelUser.bind(this), split: false },
      [Command.CHAT]: { fn: this.onChat.bind(this), split: false },
    };
  }

  private onFen(tokens: CommandTokens): boolean {
    const [, ...fenTokens] = tokens;
    const lastToken = fenTokens.slice(-1)[0];

    // Sometimes we don't get castling info
    if (lastToken == 'w' || lastToken == 'b') fenTokens.push('-');

    fenTokens.push('-', '0', '1');

    this._game.fen = fenTokens.join(' '); // build the fen
    if (!this._game.loaded) this._game.resetFromFen();

    logger.info(`Updated game ${this._game.name} - FEN: ${this._game.fen}`);

    // Never update on the FEN since we maintain our own state
    return false;
  }

  private onPlayer(tokens: CommandTokens): boolean {
    const [command, ...rest] = tokens;
    const name = rest.join(' ');

    if (command != Command.WPLAYER && command != Command.BPLAYER) return false;

    const color: Color = command == Command.WPLAYER ? 'white' : 'black';

    if (this._game[color].name != name) {
      this._game[color].reset();
      this._game[color].name = name;
      this._game.reset();

      logger.info(`Updated game ${this._game.name} - Color: ${color}, Name: ${this._game[color].name}`);
      return true;
    }

    return false;
  }

  private onPV(tokens: CommandTokens): boolean {
    const [command, ...rest] = tokens;

    if (command != Command.WPV && command != Command.BPV) return false;

    const color: Color = command == Command.WPV ? 'white' : 'black';

    this._game[color].depth = parseInt(rest[0]);
    this._game[color].score = parseInt(rest[1]) / 100;
    this._game[color].nodes = parseInt(rest[3]);
    this._game[color].usedTime = parseInt(rest[2]) * 10;

    const copy = new Chess(this._game.instance.fen());
    const pv = rest.slice(4);
    const parsed = new Array<string>();
    for (const alg of pv) {
      const move = copy.move(alg, { sloppy: true });
      if (!move) break;

      parsed.push(move.san);
    }

    // Only if we could parse at least 1 do
    if (parsed.length) this._game[color].pv = parsed;

    logger.info(
      `Updated game ${this._game.name} - Color: ${color}, Depth: ${this._game[color].depth}, Score: ${this._game[color].score}, Nodes: ${this._game[color].nodes}, UsedTime: ${this._game[color].usedTime}`,
    );
    logger.info(`Updated game ${this._game.name} - Color: ${color}, PV: ${this._game[color].pv.join(' ')}`);

    return true;
  }

  private onTime(tokens: CommandTokens): boolean {
    const [command, ...rest] = tokens;

    if (command != Command.WTIME && command != Command.BTIME) return false;

    const color: Color = command == Command.WTIME ? 'white' : 'black';
    this._game[color].clockTime = parseInt(rest[0]) * 10;

    logger.info(`Updated game ${this._game.name} - Color: ${color}, ClockTime: ${this._game[color].clockTime}`);
    return true;
  }

  private onMove(tokens: CommandTokens): boolean {
    const [command, ...rest] = tokens;

    if (command != Command.WMOVE && command != Command.BMOVE) return false;

    const color: Color = command == Command.WMOVE ? 'white' : 'black';
    const notColor: Color = command == Command.WMOVE ? 'black' : 'white';

    this._game.moveNumber = parseInt(rest[0].replace('.', ''));

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
    return true;
  }

  private onSite(tokens: CommandTokens): boolean {
    const site = tokens.slice(1).join(' ');

    this._game.site = site.replace('GrahamCCRL.dyndns.org\\', '').replace(/\.[\w]+$/, '');

    logger.info(`Updated game ${this._game.name} - Site: ${this._game.site}`);
    return true;
  }

  private onCTReset(): boolean {
    this._broadcast.results = '';

    return false;
  }

  private onCT(tokens: CommandTokens): boolean {
    this._broadcast.results += tokens[1] + '\n';

    return false;
  }

  private onAddUser(tokens: CommandTokens): boolean {
    if (username == tokens[1] || this._broadcast.spectators.has(tokens[1])) return false;

    this._broadcast.spectators.add(tokens[1]);
    return true;
  }

  private onDelUser(tokens: CommandTokens): boolean {
    return this._broadcast.spectators.delete(tokens[1]);
  }

  private onChat(tokens: CommandTokens): boolean {
    this._broadcast.chat.push(tokens[1]);

    return true;
  }

  onMessage(buff: Buffer): string | null {
    let messageId: string | null = null;
    let str = buff.toString().trim();

    const idMatch = /^<\s*(\d+)>/g.exec(str);
    if (idMatch) {
      messageId = idMatch[1];
      logger.debug(`${messageId} parsed as Message Id for ${str}`);

      str = str.replace(/^<\s*(\d+)>/g, '');
    } else {
      logger.debug(`No Message Id found for ${str}`);
    }

    const [cmd, rest] = splitOnCommand(str);
    const commandConfig = this._commandConfig[cmd] as ConfigItem | undefined;

    if (!commandConfig) logger.warn(`Unable to process ${cmd}!`);
    else {
      const updated = commandConfig.fn(commandConfig.split ? [cmd, ...rest.trim().split(/\s+/)] : [cmd, rest]);

      if (updated)
        io.to(String(this._broadcast.port)).emit('update', this._broadcast.toJSON());
    }

    return messageId;
  }
}

export default Handler;
