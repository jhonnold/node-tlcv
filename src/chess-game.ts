import { Chess, Move, validateFen } from 'chess.js';
import dayjs from 'dayjs';
import { logger } from './util/index.js';

export type MoveMetaData = {
  number: number;
  move: string;
  depth: number;
  score: number;
  nodes: number;
  time: number;
};

export type SerializedPlayer = {
  name: string;
  depth: number;
  score: number;
  nodes: number;
  usedTime: number;
  clockTime: number;
  startTime: number;
  lastMove: Move | null;
  pvAlg: Array<string>;
  pv: Array<string>;
  pvFen: string;
  pvMoveNumber: number;
  moves: Array<MoveMetaData>;
};

export type SerializedGame = {
  name: string;
  site: string;
  white: SerializedPlayer;
  black: SerializedPlayer;
  fen: string;
  opening: string;
  tablebase: string;
  stm: 'w' | 'b';
  moveNumber: number;
  moves: string[];
  startFen: string | null;
};

export class Player {
  name: string;
  depth: number;
  score: number;
  nodes: number;
  usedTime: number;
  clockTime: number;
  startTime: number;
  lastMove: Move | null;
  pv: Array<string>;
  pvFen: string;
  pvMoveNumber: number;
  pvAlg: Array<string>;
  moves: Array<MoveMetaData>;

  constructor() {
    this.name = 'Unknown';
    this.depth = 0;
    this.score = 0.0;
    this.nodes = 0;
    this.usedTime = 0;
    this.clockTime = 0;
    this.startTime = 0;
    this.lastMove = null;
    this.pv = new Array<string>();
    this.pvFen = '8/8/8/8/8/8/8/8 w - - 0 1';
    this.pvMoveNumber = 0;
    this.pvAlg = [];
    this.moves = [];
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
    this.pv = new Array<string>();
    this.pvMoveNumber = 0;
    this.pvAlg = [];
    this.moves = [];
  }

  toJSON(): SerializedPlayer {
    return {
      name: this.name,
      depth: this.depth,
      score: this.score,
      nodes: this.nodes,
      usedTime: this.usedTime,
      clockTime: this.clockTime,
      startTime: this.startTime,
      lastMove: this.lastMove,
      pv: this.pv,
      pvFen: this.pvFen,
      pvMoveNumber: this.pvMoveNumber,
      pvAlg: this.pvAlg,
      moves: this.moves,
    };
  }
}

export class ChessGame {
  readonly name: string;
  readonly white: Player;
  readonly black: Player;
  site: string;
  fen: string;
  opening: string;
  tablebase: string;
  moveNumber: number;
  fmr: number;
  instance: Chess;
  loaded: boolean;
  startFen: string | null;

  constructor(name: string) {
    this.name = name;
    this.site = '';
    this.white = new Player();
    this.black = new Player();

    this.instance = new Chess();
    this.loaded = false;
    this.startFen = null;

    this.fen = this.instance.fen();
    this.opening = 'Unknown';
    this.tablebase = '';
    this.moveNumber = 1;
    this.fmr = 0;

    this.setPGNHeaders();
  }

  private setPGNHeaders(): void {
    this.instance.header('Site', this.site);
    this.instance.header('Date', dayjs().format('YYYY.MM.DD'));
    this.instance.header('White', this.white.name);
    this.instance.header('Black', this.black.name);
  }

  reset(): void {
    this.instance = new Chess();
    this.loaded = true;
    this.startFen = null;

    this.fen = this.instance.fen();
    this.opening = 'Unknown';
    this.tablebase = '';
    this.moveNumber = this.instance.moveNumber();
    this.fmr = 0;

    this.setPGNHeaders();
  }

  resetFromFen(): void {
    const fen = [this.fen, this.fmr, this.moveNumber].join(' ');

    const { ok: valid, ...err } = validateFen(fen);

    if (valid) {
      logger.info(`Setting fen for game ${this.name} to ${fen}`, { port: this.name });
      this.instance.load(fen);
      this.loaded = true;
      this.startFen = fen;
      this.setPGNHeaders();
    } else {
      logger.error(`Unable to load fen ${fen} for game ${this.name} - ${err.error}`, { port: this.name });
    }
  }

  toJSON(): SerializedGame {
    return {
      name: this.name,
      site: this.site,
      white: this.white.toJSON(),
      black: this.black.toJSON(),
      fen: this.instance.fen(),
      opening: this.opening,
      tablebase: this.tablebase,
      stm: this.instance.turn(),
      moveNumber: this.moveNumber,
      moves: this.instance.history(),
      startFen: this.startFen,
    };
  }
}
