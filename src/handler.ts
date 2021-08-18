import { Chess } from 'chess.js';
import { ChessGame } from './chess-game';
import { logger, splitOnCommand } from './util';
import { Broadcast } from './broadcast';
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
}

type ConfigItem = {
  fn: (tokens: CommandTokens) => void;
  split: boolean;
};

type CommandConfig = {
  [key in Command]: ConfigItem;
};

type CommandTokens = [Command, ...string[]];

class Handler {
  private commandConfig: CommandConfig;
  public game: ChessGame;
  public broadcast: Broadcast | null;

  constructor(game: ChessGame) {
    this.game = game;
    this.broadcast = null;

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
      [Command.PONG]: { fn: (_) => _, split: false },
    };
  }

  private onFen(tokens: CommandTokens): void {
    const [, ...fenTokens] = tokens;
    const lastToken = fenTokens.slice(-1)[0];

    // Sometimes we don't get castling info
    if (lastToken == 'w' || lastToken == 'b') fenTokens.push('-');

    fenTokens.push('-', '0', '1');

    this.game.fen = fenTokens.join(' '); // build the fen

    if (!this.game.loaded) this.game.resetFromFen();

    logger.info(`Updated game ${this.game.name} - FEN: ${this.game.fen}`);
  }

  private onPlayer(tokens: CommandTokens): void {
    const [command, ...rest] = tokens;
    const name = rest.join(' ');

    if (command != Command.WPLAYER && command != Command.BPLAYER) return;

    const color: Color = command == Command.WPLAYER ? 'white' : 'black';

    if (this.game[color].name != name) {
      this.game[color].reset();
      this.game[color].name = name;
      this.game.reset();

      logger.info(`Updated game ${this.game.name} - Color: ${color}, Name: ${this.game[color].name}`);

      io.to(this.game.name).emit('update', this.game.toJSON());
    }
  }

  private onPV(tokens: CommandTokens): void {
    const [command, ...rest] = tokens;

    if (command != Command.WPV && command != Command.BPV) return;

    const color: Color = command == Command.WPV ? 'white' : 'black';

    this.game[color].depth = parseInt(rest[0]);
    this.game[color].score = parseInt(rest[1]) / 100;
    this.game[color].nodes = parseInt(rest[3]);
    this.game[color].usedTime = parseInt(rest[2]) * 10;

    const copy = new Chess(this.game.instance.fen());
    const pv = rest.slice(4);
    const parsed: string[] = [];
    for (const alg of pv) {
      const move = copy.move(alg, { sloppy: true });
      if (!move) break;

      parsed.push(move.san);
    }

    // Only if we could parse at least 1 do
    if (parsed.length) this.game[color].pv = parsed;

    logger.info(
      `Updated game ${this.game.name} - Color: ${color}, Depth: ${this.game[color].depth}, Score: ${this.game[color].score}, Nodes: ${this.game[color].nodes}, UsedTime: ${this.game[color].usedTime}`,
    );
    logger.debug(`Updated game ${this.game.name} - Color: ${color}, PV: ${this.game[color].pv.join(' ')}`);

    io.to(this.game.name).emit('update', this.game.toJSON());
  }

  private onTime(tokens: CommandTokens): void {
    const [command, ...rest] = tokens;

    if (command != Command.WTIME && command != Command.BTIME) return;

    const color: Color = command == Command.WTIME ? 'white' : 'black';
    this.game[color].clockTime = parseInt(rest[0]) * 10;

    logger.info(`Updated game ${this.game.name} - Color: ${color}, ClockTime: ${this.game[color].clockTime}`);

    io.to(this.game.name).emit('update', this.game.toJSON());
  }

  private onMove(tokens: CommandTokens): void {
    const [command, ...rest] = tokens;

    if (command != Command.WMOVE && command != Command.BMOVE) return;

    const color: Color = command == Command.WMOVE ? 'white' : 'black';
    const notColor: Color = command == Command.WMOVE ? 'black' : 'white';

    this.game.moveNumber = parseInt(rest[0].replace('.', ''));

    const move = this.game.instance.move(rest[1]);
    if (move) {
      this.game[color].lastMove = move;
      logger.info(`Updated game ${this.game.name} - Color: ${color}, Last Move: ${this.game[color].lastMove?.san}`);
    } else {
      logger.warn(
        `Failed to parse ${rest[1]} for game ${this.game.name}, fen ${this.game.instance.fen()}! Loading from FEN...`,
      );
      this.game.resetFromFen();
    }

    // start the timer for the other side
    this.game[notColor].startTime = new Date().getTime();

    io.to(this.game.name).emit('update', this.game.toJSON());
  }

  private onSite(tokens: CommandTokens): void {
    const site = tokens.slice(1).join(' ');

    this.game.site = site.replace('GrahamCCRL.dyndns.org\\', '').replace(/\.[\w]+$/, '');

    logger.info(`Updated game ${this.game.name} - Site: ${this.game.site}`);

    io.to(this.game.name).emit('update', this.game.toJSON());
  }

  private onCTReset(): void {
    if (!this.broadcast) return;

    this.broadcast.results = '';
  }

  private onCT(tokens: CommandTokens): void {
    if (!this.broadcast) return;

    this.broadcast.results += tokens[1] + '\n';
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
    const commandConfig = this.commandConfig[cmd] as ConfigItem | undefined;

    if (!commandConfig) logger.warn(`Unable to process ${cmd}!`);
    else commandConfig.fn(commandConfig.split ? [cmd, ...rest.trim().split(/\s+/)] : [cmd, rest]);

    return messageId;
  }
}

export default Handler;
