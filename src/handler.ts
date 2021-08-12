import ChessGame from './chess-game';
import { logger } from './util';

class Handler {
  public game: ChessGame;

  constructor(game: ChessGame) {
    this.game = game;
  }

  private onFenCommand(msg: string) {
    const tokens = msg.split(/\s+/g);

    this.game.fen = tokens.slice(1).join(' ').trim();
    this.game.stm = tokens[2].trim();

    logger.info(`Updated game ${this.game.name}, FEN: ${this.game.fen}, STM: ${this.game.stm}`);
  }

  private onPlayerCommand(msg: string) {
    const tokens = msg.split(/\s+/g);

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
      this.game.white.pv = tokens.slice(5);
      logger.info(`Updated game ${this.game.name}, White Player: ${tokens[1]}d ${tokens[2]}cp ${tokens[3]}ms ${tokens[4]}n`);
    } else if (tokens[0] == 'BPV:') {
      this.game.black.depth = tokens[1] || '1';
      this.game.black.score = tokens[2] || '0';
      this.game.black.think = tokens[3] || '0';
      this.game.black.nodes = tokens[4] || '0';
      this.game.black.pv = tokens.slice(5);
      logger.info(`Updated game ${this.game.name}, Black Player: ${tokens[1]}d ${tokens[2]}cp ${tokens[3]}ms ${tokens[4]}n`);
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
    }

    return messageId;
  }
}

export default Handler;
