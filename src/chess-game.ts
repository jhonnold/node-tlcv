import { Chess, Move, validateFen } from 'chess.js';
import dayjs from 'dayjs';
import { logger } from './util/index.js';
import type { MoveMetaData, SerializedLiveData, SerializedPlayer, SerializedGame } from '../shared/types.js';

export type { MoveMetaData, SerializedLiveData, SerializedPlayer, SerializedGame } from '../shared/types.js';

const EMPTY_FEN = '8/8/8/8/8/8/8/8 w - - 0 1';

export class LiveData {
  color: 'w' | 'b';
  depth: number;
  score: number;
  nodes: number;
  usedTime: number;
  pv: Array<string>;
  pvAlg: Array<string>;
  pvFen: string;
  pvMoveNumber: number;

  constructor() {
    this.color = 'w';
    this.depth = 0;
    this.score = 0;
    this.nodes = 0;
    this.usedTime = 0;
    this.pv = [];
    this.pvAlg = [];
    this.pvFen = EMPTY_FEN;
    this.pvMoveNumber = 1;
  }

  reset(color: 'w' | 'b', pvMoveNumber: number): void {
    this.color = color;
    this.depth = 0;
    this.score = 0;
    this.nodes = 0;
    this.usedTime = 0;
    this.pv = [];
    this.pvAlg = [];
    this.pvFen = EMPTY_FEN;
    this.pvMoveNumber = pvMoveNumber;
  }

  toJSON(): SerializedLiveData {
    return {
      color: this.color,
      depth: this.depth,
      score: this.score,
      nodes: this.nodes,
      usedTime: this.usedTime,
      pv: this.pv,
      pvAlg: this.pvAlg,
      pvFen: this.pvFen,
      pvMoveNumber: this.pvMoveNumber,
    };
  }
}

export class Player {
  name: string;
  clockTime: number;
  startTime: number;
  lastMove: Move | null;

  constructor() {
    this.name = 'Unknown';
    this.clockTime = 0;
    this.startTime = 0;
    this.lastMove = null;
  }

  reset(): void {
    this.name = 'Unknown';
    this.clockTime = 0;
    this.startTime = 0;
    this.lastMove = null;
  }

  toJSON(): SerializedPlayer {
    return {
      name: this.name,
      clockTime: this.clockTime,
      startTime: this.startTime,
    };
  }
}

export class ChessGame {
  readonly name: string;
  readonly white: Player;
  readonly black: Player;
  readonly liveData: LiveData;
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
    this.liveData = new LiveData();

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
    this.liveData.reset('w', 1);

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
      this.liveData.reset(this.instance.turn(), this.moveNumber);
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
      liveData: this.liveData.toJSON(),
      fen: this.instance.fen(),
      opening: this.opening,
      tablebase: this.tablebase,
      stm: this.instance.turn(),
      moves: this.moveMeta,
      startFen: this.startFen,
    };
  }
}
