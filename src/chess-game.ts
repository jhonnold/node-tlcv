import { Chess, Move, validateFen } from 'chess.js';
import dayjs from 'dayjs';
import { logger } from './util/index.js';

export type MoveMetaData = {
  color: 'w' | 'b';
  number: number;
  move: string;
  depth: number | null;
  score: number | null;
  nodes: number | null;
  time: number | null;
  pv: string[] | null;
  pvFen: string | null;
  pvMoveNumber: number | null;
  pvFollowup: string | null;
};

export type SerializedPlayer = {
  name: string;
  depth: number;
  score: number;
  nodes: number;
  usedTime: number;
  clockTime: number;
  startTime: number;
  pvAlg: Array<string>;
  pv: Array<string>;
  pvFen: string;
  pvMoveNumber: number;
};

export type SerializedGame = {
  site: string;
  white: SerializedPlayer;
  black: SerializedPlayer;
  fen: string;
  opening: string;
  tablebase: string;
  stm: 'w' | 'b';
  moves: MoveMetaData[];
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
    this.pvMoveNumber = 1;
    this.pvAlg = [];
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
    this.pvMoveNumber = 1;
    this.pvAlg = [];
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
      pv: this.pv,
      pvFen: this.pvFen,
      pvMoveNumber: this.pvMoveNumber,
      pvAlg: this.pvAlg,
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
  moveMeta: Array<MoveMetaData>;

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
    this.moveMeta = [];

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
    this.moveMeta = [];

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
      this.moveMeta = [];
      this.setPGNHeaders();
    } else {
      logger.error(`Unable to load fen ${fen} for game ${this.name} - ${err.error}`, { port: this.name });
    }
  }

  toJSON(): SerializedGame {
    return {
      site: this.site,
      white: this.white.toJSON(),
      black: this.black.toJSON(),
      fen: this.instance.fen(),
      opening: this.opening,
      tablebase: this.tablebase,
      stm: this.instance.turn(),
      moves: this.moveMeta,
      startFen: this.startFen,
    };
  }
}
