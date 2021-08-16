import { Chess } from 'chess.js';
import ChessGame from './chess-game';
import { logger } from './util';
import { Broadcast } from './broadcast';

type Color = 'white' | 'black';

enum Command {
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

type CommandTokens = [Command, ...string[]];

class Handler {
  private commands: {
    [key: string]: ((tokens: CommandTokens) => void) | undefined;
  };

  private shouldSplit: {
    [cmd in Command]: boolean;
  };

  public game: ChessGame;
  public broadcast: Broadcast | null;

  constructor(game: ChessGame) {
    this.game = game;
    this.broadcast = null;

    this.commands = {
      [Command.FEN]: this.onFen.bind(this),
      [Command.WPLAYER]: this.onPlayer.bind(this),
      [Command.BPLAYER]: this.onPlayer.bind(this),
      [Command.WPV]: this.onPV.bind(this),
      [Command.BPV]: this.onPV.bind(this),
      [Command.WTIME]: this.onTime.bind(this),
      [Command.BTIME]: this.onTime.bind(this),
      [Command.WMOVE]: this.onMove.bind(this),
      [Command.BMOVE]: this.onMove.bind(this),
      [Command.SITE]: this.onSite.bind(this),
      [Command.CTRESET]: this.onCTReset.bind(this),
      [Command.CT]: this.onCT.bind(this),
      [Command.PONG]: (_) => _, // no op
    };

    this.shouldSplit = {
      [Command.FEN]: true,
      [Command.WPLAYER]: false,
      [Command.BPLAYER]: false,
      [Command.WPV]: true,
      [Command.BPV]: true,
      [Command.WTIME]: true,
      [Command.BTIME]: true,
      [Command.WMOVE]: true,
      [Command.BMOVE]: true,
      [Command.SITE]: false,
      [Command.CTRESET]: false,
      [Command.CT]: false,
      [Command.PONG]: false,
    };
  }

  private splitOnCommand(line: string): [Command, string] {
    const argSplit = line.indexOf(':');

    if (argSplit < 0) return [line as Command, ''];

    return [line.substring(0, argSplit) as Command, line.substring(argSplit + 1)];
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
  }

  private onTime(tokens: CommandTokens): void {
    const [command, ...rest] = tokens;

    if (command != Command.WTIME && command != Command.BTIME) return;

    const color: Color = command == Command.WTIME ? 'white' : 'black';
    this.game[color].clockTime = parseInt(rest[0]) * 10;

    logger.info(`Updated game ${this.game.name} - Color: ${color}, ClockTime: ${this.game[color].clockTime}`);
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
  }

  private onSite(tokens: CommandTokens): void {
    const site = tokens.slice(1).join(' ');

    this.game.site = site.replace('GrahamCCRL.dyndns.org\\', '').replace('.e1e', '').replace('.ele', '');

    logger.info(`Updated game ${this.game.name} - Site: ${this.game.site}`);
  }

  private onCTReset(): void {
    if (!this.broadcast) return;

    this.broadcast.results = '';
  }

  private onCT(tokens: CommandTokens): void {
    if (!this.broadcast) return;

    const line = tokens.slice(1).join('\t');
    this.broadcast.results += line + '\n';
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

    const [cmd, rest] = this.splitOnCommand(str);
    const commandMethod = this.commands[cmd];
    if (!commandMethod) {
      logger.warn(`Unable to process ${cmd}!`);
    } else {
      commandMethod(this.shouldSplit[cmd] ? [cmd, ...rest.trim().split(/\s+/)] : [cmd, rest]);
    }

    return messageId;
  }
}

export default Handler;
