import { Chess, Move, validateFen } from 'chess.js';
import { logger } from './util/index.js';
import dayjs from 'dayjs';

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
};

export type MoveMetaData = {
  number: number;
  move: string;
  depth: number;
  score: number;
  nodes: number;
};

export type LichessExplorerResponse = {
  opening: { eco: string; name: string } | null;
};

export type LichessTablebaseResponse = {
  category: string | null;
};

export class ChessGame {
  private _name: string;
  private _site: string;
  private _white: Player;
  private _black: Player;
  private _instance: Chess;
  private _loaded: boolean;
  private _fen: string;
  private _opening: string;
  private _tablebase: string;
  private _moveNumber: number;
  private _fmr: number;

  constructor(name: string) {
    this._name = name;
    this._site = '';
    this._white = new Player();
    this._black = new Player();

    this._instance = new Chess();
    this._loaded = false;

    this._fen = this._instance.fen();
    this._opening = 'Unknown';
    this._tablebase = '';
    this._moveNumber = 1;
    this._fmr = 0;

    this.setPGNHeaders();
  }

  private setPGNHeaders(): void {
    this._instance.header('Site', this._site);
    this._instance.header('Date', dayjs().format('YYYY.MM.DD'));
    this._instance.header('White', this._white.name);
    this._instance.header('Black', this._black.name);
  }

  reset(): void {
    this._instance = new Chess();
    this._loaded = true;

    this._fen = this._instance.fen();
    this._opening = 'Unknown';
    this._tablebase = '';
    this._moveNumber = this._instance.moveNumber();
    this._fmr = 0;

    this.setPGNHeaders();
  }

  resetFromFen(): void {
    const fen = [this._fen, this._fmr, this._moveNumber].join(' ');

    const { ok: valid, ...err } = validateFen(fen);

    if (valid) {
      logger.info(`Setting fen for game ${this._name} to ${fen}`, { port: this.name });
      this._instance.load(fen);
      this._loaded = true;
      this.setPGNHeaders();
    } else {
      logger.error(`Unable to load fen ${fen} for game ${this._name} - ${err.error}`, { port: this.name });
    }
  }

  async setOpening(): Promise<void> {
    const history = this._instance.history({ verbose: true });
    if (!history.length) return;

    const moves = history.map((move) => `${move.from}${move.to}`).join(',');
    const url = `https://explorer.lichess.ovh/master?play=${moves}`;

    logger.info(`Requesting opening for game ${this._name} from ${url}`, { port: this.name });

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data: LichessExplorerResponse = await response.json();
      const { opening } = data;

      logger.info(`Received opening response for game ${this._name} - ${opening}`, { port: this.name });

      if (opening) {
        const { eco, name } = opening;

        logger.info(`Setting opening for game ${this._name} to ${eco} ${name}`, { port: this.name });
        this._opening = `${eco} ${name}`;
      }
    } catch {
      logger.warn(`Error requesting opening for game ${this._name} @ ${url}`, { port: this.name });
    }
  }

  async setTablebase(): Promise<void> {
    const url = `https://tablebase.lichess.ovh/standard?fen=${this._fen}`;

    logger.info(`Requesting tablebase for game ${this._name} from ${url}`, { port: this.name });

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data: LichessTablebaseResponse = await response.json();
      const { category } = data;

      logger.info(`Received tb category response for game ${this._name}: ${category}`, { port: this.name });

      if (category) {
        switch (category) {
          case 'win':
          case 'maybe-win':
            this._tablebase = this._instance.turn() === 'w' ? 'White Win' : 'Black Win';
            break;
          case 'cursed-win':
          case 'draw':
          case 'cursed-loss':
            this._tablebase = 'Draw';
            break;
          case 'loss':
          case 'maybe-loss':
            this._tablebase = this._instance.turn() === 'w' ? 'Black Win' : 'White Win';
            break;
          case 'unknown':
            this._tablebase = '';
            break;
          default:
            logger.warn(`Unknown tablebase category ${category} for game ${this._name}, setting tablebase to blank`, {
              port: this.name,
            });
            this._tablebase = '';
        }
        logger.info(`Set tablebase for game ${this._name} to ${this._tablebase}`, { port: this.name });
      } else {
        logger.info(`Setting tablebase for game ${this._name} to blank`, { port: this.name });
        this._tablebase = '';
      }
    } catch {
      logger.warn(`Error requesting tablebase for game ${this._name} @ ${url}`, { port: this.name });
      this._tablebase = '';
    }
  }

  toJSON(): SerializedGame {
    return {
      name: this._name,
      site: this._site,
      white: this._white.toJSON(),
      black: this._black.toJSON(),
      fen: this._instance.fen(),
      opening: this._opening,
      tablebase: this._tablebase,
      stm: this._instance.turn(),
      moveNumber: this._moveNumber,
    };
  }

  public get name(): string {
    return this._name;
  }

  public get site(): string {
    return this._site;
  }

  public set site(v: string) {
    this._site = v;
  }

  public get white(): Player {
    return this._white;
  }

  public get black(): Player {
    return this._black;
  }

  public get instance(): Chess {
    return this._instance;
  }

  public get loaded(): boolean {
    return this._loaded;
  }

  public get fen(): string {
    return this._fen;
  }

  public set fen(v: string) {
    this._fen = v;
  }

  public get opening(): string {
    return this._opening;
  }

  public get moveNumber(): number {
    return this._moveNumber;
  }

  public set moveNumber(v: number) {
    this._moveNumber = v;
  }

  public get fmr(): number {
    return this._fmr;
  }

  public set fmr(v: number) {
    this._fmr = v;
  }
}

export class Player {
  private _name: string;
  private _depth: number;
  private _score: number;
  private _nodes: number;
  private _usedTime: number;
  private _clockTime: number;
  private _startTime: number;
  private _lastMove: Move | null;
  private _pv: Array<string>; // san representation
  private _pvFen: string;
  private _pvMoveNumber: number;
  private _pvAlg: Array<string>;

  _moves: Array<MoveMetaData>;

  constructor() {
    this._name = 'Unknown';
    this._depth = 0;
    this._score = 0.0;
    this._nodes = 0;
    this._usedTime = 0;
    this._clockTime = 0;
    this._startTime = 0;
    this._lastMove = null;
    this._pv = new Array<string>();
    this._pvFen = '8/8/8/8/8/8/8/8 w - - 0 1';
    this._pvMoveNumber = 0;
    this._pvAlg = [];
    this._moves = [];
  }

  reset(): void {
    this._name = 'Unknown';
    this._depth = 0;
    this._score = 0.0;
    this._nodes = 0;
    this._usedTime = 0;
    this._clockTime = 0;
    this._startTime = 0;
    this._lastMove = null;
    this._pv = new Array<string>();
    this._pvMoveNumber = 0;
    this._pvAlg = [];
    this._moves = [];
  }

  toJSON(): SerializedPlayer {
    return {
      name: this._name,
      depth: this._depth,
      score: this._score,
      nodes: this._nodes,
      usedTime: this._usedTime,
      clockTime: this._clockTime,
      startTime: this._startTime,
      lastMove: this._lastMove,
      pv: this._pv,
      pvFen: this._pvFen,
      pvMoveNumber: this._pvMoveNumber,
      pvAlg: this._pvAlg,
    };
  }

  public get name(): string {
    return this._name;
  }

  public set name(v: string) {
    this._name = v;
  }

  public get depth(): number {
    return this._depth;
  }

  public set depth(v: number) {
    this._depth = v;
  }

  public get score(): number {
    return this._score;
  }

  public set score(v: number) {
    this._score = v;
  }

  public get nodes(): number {
    return this._nodes;
  }

  public set nodes(v: number) {
    this._nodes = v;
  }

  public get usedTime(): number {
    return this._usedTime;
  }

  public set usedTime(v: number) {
    this._usedTime = v;
  }

  public get clockTime(): number {
    return this._clockTime;
  }

  public set clockTime(v: number) {
    this._clockTime = v;
  }

  public get startTime(): number {
    return this._startTime;
  }

  public set startTime(v: number) {
    this._startTime = v;
  }

  public get lastMove(): Move | null {
    return this._lastMove;
  }

  public set lastMove(v: Move | null) {
    this._lastMove = v;
  }

  public get pv(): Array<string> {
    return this._pv;
  }

  public set pv(v: Array<string>) {
    this._pv = v;
  }

  public set pvFen(fen: string) {
    this._pvFen = fen;
  }

  public get pvFen(): string {
    return this._pvFen;
  }

  public set pvAlg(move: Array<string>) {
    this._pvAlg = move;
  }

  public get pvAlg(): Array<string> {
    return this._pvAlg;
  }

  public get pvMoveNumber(): number {
    return this._pvMoveNumber;
  }

  public set pvMoveNumber(v: number) {
    this._pvMoveNumber = v;
  }
}
