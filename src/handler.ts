import ChessGame from './chess-game';
import { logger } from './util';

class Handler {
  public game: ChessGame;

  constructor(game: ChessGame) {
    this.game = game;
  }

  private onFenCommand(msg: string) {
    const fen = msg.substr(5).trim();
    this.game.fen = fen;
    this.game.stm = fen.slice(-1);

    logger.info(`Updated game ${this.game.name}, FEN: ${this.game.fen}, STM: ${this.game.stm}`);
  }

  private onPlayerCommand(msg: string) {
    const name = msg.substr(9);

    if (msg.startsWith('W')) {
      this.game.white.name = name;
      logger.info(`Updated game ${this.game.name}, White Player: ${this.game.white.name}`);
    } else {
      this.game.black.name = name;
      logger.info(`Updated game ${this.game.name}, Black Player: ${this.game.black.name}`);
    }
  }

  private onPV(msg: string) {
    const tokens = msg.split(/\s+/g);

    if (tokens[0] == 'WPV:') {
      this.game.white.depth = tokens[1] || '1';
      this.game.white.score = tokens[2] || '0';
      logger.info(`Updated game ${this.game.name}, White Player: ${tokens[1]}d ${tokens[2]}cp`);
    } else if (tokens[0] == 'BPV:') {
      this.game.black.depth = tokens[1] || '1';
      this.game.black.score = tokens[2] || '0';
      logger.info(`Updated game ${this.game.name}, Black Player: ${tokens[1]}d ${tokens[2]}cp`);
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

    if (str.startsWith('FEN: ')) {
      this.onFenCommand(str);
    } else if (str.startsWith('WPLAYER: ') || str.startsWith('BPLAYER: ')) {
      this.onPlayerCommand(str);
    } else if (/^(W|B)PV:/.test(str)) {
      this.onPV(str);
    }

    return messageId;
  }
}

export default Handler;
