import { Chess, ChessInstance, Move } from 'chess.js';
import { logger } from './util';

export type SerializedGame = {
  name: string;
  site: string;
  white: SerializedPlayer;
  black: SerializedPlayer;
  fen: string;
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
  pv: Array<string>;
};

export class ChessGame {
  private _name: string;
  private _site: string;
  private _white: Player;
  private _black: Player;
  private _instance: ChessInstance;
  private _loaded: boolean;
  private _fen: string;
  private _moveNumber: number;

  constructor(name: string) {
    this._name = name;
    this._site = '';
    this._white = new Player();
    this._black = new Player();

    this._instance = new Chess();
    this._loaded = false;

    this._fen = this._instance.fen();
    this._moveNumber = 1;

    this.setPGNHeaders();
  }

  private setPGNHeaders(): void {
    this._instance.header('Site', this._site);
    this._instance.header('Date', new Date().toDateString());
    this._instance.header('White', this._white.name);
    this._instance.header('Black', this._black.name);
  }

  reset(): void {
    this._instance = new Chess();
    this._loaded = true;

    this._fen = this._instance.fen();

    this.setPGNHeaders();
  }

  resetFromFen(): void {
    const { valid, ...err } = this._instance.validate_fen(this._fen);

    if (valid) {
      logger.info(`Setting fen for game ${this._name} to ${this._fen}`);
      this._loaded = this._instance.load(this._fen);
      this.setPGNHeaders();
    } else {
      logger.error(`Unable to load fen ${this._fen} for game ${this._name}`);
      logger.error(err.error);
    }
  }

  toJSON(): SerializedGame {
    return {
      name: this._name,
      site: this._site,
      white: this._white.toJSON(),
      black: this._black.toJSON(),
      fen: this._instance.fen(),
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

  public get instance(): ChessInstance {
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

  public get moveNumber(): number {
    return this._moveNumber;
  }

  public set moveNumber(v: number) {
    this._moveNumber = v;
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
}
