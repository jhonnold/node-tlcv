import { Chess, Square } from 'chess.js';
import ChessGame from './chess-game';
import { logger } from './util';

class Handler {
  public game: ChessGame;

  constructor(game: ChessGame) {
    this.game = game;
  }

  private onFenCommand(msg: string) {
    const tokens = msg.split(/\s+/g);

    logger.info(tokens.slice(1).join(' '));

    this.game.fen = tokens.slice(1).join(' ');
    if (tokens.length == 3) this.game.fen += ' - - 0 1';
    else if (tokens.length == 4) this.game.fen += ' - 0 1';
    else {
      this.game.fen += ' 0 1';
    }

    if (!this.game.loaded) {
      this.game.instance = new Chess(this.game.fen);
      this.game.loaded = true;
    }

    const newStm = tokens[2].trim();
    if (newStm != this.game.stm) {
      this.game.stm = newStm;

      if (this.game.stm == 'w') {
        this.game.white.startThink = new Date().getTime();
      } else {
        this.game.black.startThink = new Date().getTime();
      }
    }

    logger.info(`Updated game ${this.game.name}, FEN: ${this.game.fen}, STM: ${this.game.stm}`);
  }

  private onPlayerCommand(msg: string) {
    const tokens = msg.split(/\s+/g);

    // New game
    this.game.instance = new Chess();
    this.game.loaded = true;

    if (tokens[0] == 'WPLAYER:') {
      this.game.white.name = tokens.slice(1).join(' ');
      logger.info(`Updated game ${this.game.name}, White Player: ${this.game.white.name}`);
    } else if (tokens[0] == 'BPLAYER:') {
      this.game.black.name = tokens.slice(1).join(' ');
      logger.info(`Updated game ${this.game.name}, Black Player: ${this.game.black.name}`);
    }
  }

  private onPV(msg: string) {
    const tokens = msg.split(/\s+/g);

    if (tokens[0] == 'WPV:') {
      this.game.white.depth = tokens[1] || '1';
      this.game.white.score = tokens[2] || '0';
      this.game.white.think = tokens[3] || '0';
      this.game.white.nodes = tokens[4] || '0';

      const gameCopy = new Chess(this.game.instance.fen());
      const pv = tokens.slice(5);
      for (let i = 0; i < pv.length; i++) {
        const m = gameCopy.move(pv[i], { sloppy: true });
        if (m) pv[i] = m.san;
        else break;
      }
      this.game.white.pv = pv;

      logger.info(
        `Updated game ${this.game.name}, White Player: ${tokens[1]}d ${tokens[2]}cp ${tokens[3]}ms ${tokens[4]}n`,
      );
    } else if (tokens[0] == 'BPV:') {
      this.game.black.depth = tokens[1] || '1';
      this.game.black.score = tokens[2] || '0';
      this.game.black.think = tokens[3] || '0';
      this.game.black.nodes = tokens[4] || '0';

      const gameCopy = new Chess(this.game.instance.fen());
      const pv = tokens.slice(5);
      for (let i = 0; i < pv.length; i++) {
        const m = gameCopy.move(pv[i], { sloppy: true });
        if (m) pv[i] = m.san;
        else break;
      }
      this.game.black.pv = pv;

      logger.info(
        `Updated game ${this.game.name}, Black Player: ${tokens[1]}d ${tokens[2]}cp ${tokens[3]}ms ${tokens[4]}n`,
      );
    }
  }

  private onTime(msg: string) {
    const tokens = msg.split(/\s+/g);

    if (tokens[0] == 'WTIME:') {
      this.game.white.time = tokens[1];
      logger.info(`Updated game ${this.game.name}, White Time: ${this.game.white.time}`);
    } else if (tokens[0] == 'BTIME:') {
      this.game.black.time = tokens[1];
      logger.info(`Updated game ${this.game.name}, Black Time: ${this.game.black.time}`);
    }
  }

  private onMove(msg: string) {
    const tokens = msg.split(/\s+/g);

    const res = this.game.instance.move(tokens[2]);

    if (res) {
      if (tokens[0] == 'WMOVE:') {
        this.game.white.lastStart = res.from;
        this.game.white.lastEnd = res.to;
        logger.info(
          `Updated game ${this.game.name}, White Last Move: ${this.game.white.lastStart}${this.game.white.lastEnd}`,
        );
      } else if (tokens[0] == 'BMOVE:') {
        this.game.black.lastStart = res.from;
        this.game.black.lastEnd = res.to;
        logger.info(
          `Updated game ${this.game.name}, Black Last Move: ${this.game.black.lastStart}${this.game.black.lastEnd}`,
        );
      }
    } else {
      logger.warn(`Unable to update game ${this.game.name} as ${tokens[2]} could not be parsed!`);

      this.game.instance = new Chess(this.game.fen);
    }
  }

  onMessage(buff: Buffer): string | null {
    let messageId: string | null = null;
    let str = buff.toString();

    const idMatch = /^<\s*(\d+)>/g.exec(str);
    if (idMatch) {
      messageId = idMatch[1];
      logger.debug(`${messageId} parsed as Message Id for ${str}`);

      str = str.replace(/^<\s*(\d+)>/g, '');
    } else {
      logger.debug(`No Message Id found for ${str}`);
    }

    if (/^FEN:/.test(str)) {
      this.onFenCommand(str);
    } else if (/^(W|B)PLAYER/.test(str)) {
      this.onPlayerCommand(str);
    } else if (/^(W|B)PV:/.test(str)) {
      this.onPV(str);
    } else if (/^(W|B)TIME:/.test(str)) {
      this.onTime(str);
    } else if (/^(W|B)MOVE:/.test(str)) {
      this.onMove(str);
    }

    return messageId;
  }
}

export default Handler;
