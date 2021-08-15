import { Chess, ChessInstance, Move } from 'chess.js';
import { logger } from './util';

type SerializedGame = {
  name: string;
  site: string;
  white: Player;
  black: Player;
  fen: string;
  stm: 'w' | 'b';
  moveNumber: number;
};

class Player {
  public name: string;
  public depth: number;
  public score: number;
  public nodes: number;
  public usedTime: number;
  public clockTime: number;
  public startTime: number;
  public lastMove: Move | null;
  public pv: string[]; // san representation

  constructor() {
    this.name = 'Unknown';
    this.depth = 0;
    this.score = 0.0;
    this.nodes = 0;
    this.usedTime = 0;
    this.clockTime = 0;
    this.startTime = 0;
    this.lastMove = null;
    this.pv = [];
  }

  reset(): void {
    this.name = 'Unknown';
    this.depth = 0;
    this.score = 0.0;
    this.nodes = 0;
    this.usedTime = 0;
    this.clockTime = 0;
    this.startTime = 0;
    this.lastMove = null;
    this.pv = [];
  }
}

class ChessGame {
  public name: string;
  public site: string;
  public white: Player;
  public black: Player;
  public instance: ChessInstance;
  public loaded: boolean;
  public fen: string;
  public moveNumber: number;

  constructor(name: string) {
    this.name = name;
    this.site = '';
    this.white = new Player();
    this.black = new Player();
    this.instance = new Chess();
    this.loaded = false;
    this.fen = this.instance.fen();
    this.moveNumber = 1;

    this.setPGNHeaders();
  }

  private setPGNHeaders(): void {
    this.instance.header('White', this.white.name);
    this.instance.header('Black', this.black.name);
    this.instance.header('Date', new Date().toDateString());
  }

  reset(): void {
    this.instance = new Chess();
    this.loaded = true;
    this.fen = this.instance.fen();

    this.setPGNHeaders();
  }

  resetFromFen(): void {
    const { valid, ...err } = this.instance.validate_fen(this.fen);

    if (valid) {
      logger.info(`Setting fen for game ${this.name} to ${this.fen}`);
      this.loaded = this.instance.load(this.fen);
      this.setPGNHeaders();
    } else {
      logger.error(`Unable to load fen ${this.fen} for game ${this.name}`);
      logger.error(err.error);
    }
  }

  toJSON(): SerializedGame {
    return {
      name: this.name,
      site: this.site,
      white: this.white,
      black: this.black,
      fen: this.instance.fen(),
      stm: this.instance.turn(),
      moveNumber: this.moveNumber,
    };
  }
}

export default ChessGame;
